import Dexie, { type Table } from 'dexie';
import { createClient } from '@supabase/supabase-js';
import { ledgerSchema, type Ledger } from '../domain/model.ts';
import type { Analysis } from '../domain/engine.ts';
const url=import.meta.env.VITE_SUPABASE_URL,key=import.meta.env.VITE_SUPABASE_ANON_KEY;
export const supabase=url&&key?createClient(url,key):null;
export type Mode='local'|'cloud'|'demo';
class Database extends Dexie {ledgers!:Table<{id:string;ledger:Ledger},string>;constructor(){super('pocketwise-v1');this.version(1).stores({ledgers:'id'});}}
export const db=new Database();
export interface StorageAdapter{load():Promise<Ledger|null>;save(ledger:Ledger,expectedRevision:number):Promise<Ledger>;clear():Promise<void>}
export const localAdapter=(id='local'):StorageAdapter=>({async load(){const v=await db.ledgers.get(id);return v?ledgerSchema.parse(v.ledger):null;},async save(ledger,expected){return db.transaction('rw',db.ledgers,async()=>{const old=await db.ledgers.get(id);if(old&&old.ledger.revision!==expected)throw new Error('Your data changed in another tab. Reload before saving.');const parsed=ledgerSchema.parse({...ledger,revision:expected+1});await db.ledgers.put({id,ledger:parsed});return parsed;});},async clear(){await db.ledgers.delete(id);}});
export async function cloudCall<T>(body:Record<string,unknown>):Promise<T>{if(!supabase)throw new Error('Cloud is not configured. Use device-only mode.');const {data,error}=await supabase.functions.invoke('finance',{body});if(error){let message='Cloud request failed. Please retry.';try{const parsed=await error.context.json();message=parsed.error??message;}catch{/* No sensitive transport details */}throw new Error(message);}return data as T;}
export const cloudAdapter:StorageAdapter={load:()=>cloudCall<Ledger|null>({action:'load'}),save:(ledger,expectedRevision)=>cloudCall<Ledger>({action:'save',ledger,expectedRevision}),clear:()=>cloudCall<void>({action:'delete'})};
export const adapter=(mode:Mode)=>mode==='cloud'?cloudAdapter:localAdapter(mode);
let worker:Worker|null=null;let request=0;
export async function calculate(l:Ledger,asOf:string,mode:Mode):Promise<Analysis>{if(mode==='cloud')return cloudCall<Analysis>({action:'analyze',asOf});if(!worker)worker=new Worker(new URL('../domain/worker.ts',import.meta.url),{type:'module'});const id=++request;return new Promise((resolve,reject)=>{const timer=setTimeout(()=>{worker?.removeEventListener('message',handler);reject(new Error('Analysis timed out'));},10000);const handler=(e:MessageEvent)=>{if(e.data.id!==id)return;clearTimeout(timer);worker!.removeEventListener('message',handler);e.data.error?reject(new Error(e.data.error)):resolve(e.data.result);};worker!.addEventListener('message',handler);worker!.postMessage({id,ledger:l,asOf});});}
export function releaseWorker(){worker?.terminate();worker=null;}
