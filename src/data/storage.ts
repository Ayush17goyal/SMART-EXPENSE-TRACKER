import Dexie, { type Table } from 'dexie';
import { ledgerSchema, type Ledger } from '../domain/model.ts';
import type { Analysis } from '../domain/engine.ts';
import {supabase} from '../lib/supabase.ts';
export {supabase};
export type Mode='local'|'cloud'|'demo';
class Database extends Dexie {ledgers!:Table<{id:string;ledger:Ledger},string>;constructor(){super('pocketwise-v1');this.version(1).stores({ledgers:'id'});}}
export const db=new Database();
export interface StorageAdapter{load():Promise<Ledger|null>;save(ledger:Ledger,expectedRevision:number):Promise<Ledger>;clear():Promise<void>}
export const localAdapter=(id='local'):StorageAdapter=>({async load(){const v=await db.ledgers.get(id);return v?ledgerSchema.parse(v.ledger):null;},async save(ledger,expected){return db.transaction('rw',db.ledgers,async()=>{const old=await db.ledgers.get(id);if(old&&old.ledger.revision!==expected)throw new Error('Your data changed in another tab. Reload before saving.');const parsed=ledgerSchema.parse({...ledger,revision:expected+1});await db.ledgers.put({id,ledger:parsed});return parsed;});},async clear(){await db.ledgers.delete(id);}});
export async function cloudCall<T>(body:Record<string,unknown>):Promise<T>{if(!supabase)throw new Error('Cloud is not configured. Use device-only mode.');const {data,error}=await supabase.functions.invoke('finance',{body});if(error){let message='Cloud request failed. Please retry.';try{const parsed=await error.context.json();message=parsed.error??message;}catch{/* No sensitive transport details */}throw new Error(message);}return data as T;}
async function cloudUserId(){
 if(!supabase)throw new Error('Cloud is not configured.');
 const {data,error}=await supabase.auth.getUser();
 if(error||!data.user)throw new Error('Your session has expired. Please sign in again.');
 return data.user.id;
}
export const cloudAdapter:StorageAdapter={
 async load(){
  if(!supabase)throw new Error('Cloud is not configured.');
  const userId=await cloudUserId();
  const {data,error}=await supabase.from('user_ledgers').select('ledger').eq('user_id',userId).maybeSingle();
  if(error)throw new Error(error.code==='42P01'?'Cloud storage is not initialized. Apply the Supabase database migrations, then reload.':'Your cloud data could not be loaded. Please retry.');
  return data?.ledger?ledgerSchema.parse(data.ledger):null;
 },
 async save(ledger,expectedRevision){
  if(!supabase)throw new Error('Cloud is not configured.');
  const parsed=ledgerSchema.parse(ledger);
  const {data,error}=await supabase.rpc('save_ledger',{p_ledger:parsed,p_expected_revision:expectedRevision});
  if(error)throw new Error(error.message.includes('Revision')?'Your data changed in another session. Reload before saving.':'Your cloud data could not be saved. Please retry.');
  return ledgerSchema.parse(data);
 },
 async clear(){
  if(!supabase)throw new Error('Cloud is not configured.');
  const userId=await cloudUserId();
  const {error}=await supabase.from('user_ledgers').delete().eq('user_id',userId);
  if(error)throw new Error('Your cloud data could not be deleted. Please retry.');
 }
};
export const adapter=(mode:Mode)=>mode==='cloud'?cloudAdapter:localAdapter(mode);
let worker:Worker|null=null;let request=0;
export async function calculate(l:Ledger,asOf:string,_mode:Mode):Promise<Analysis>{if(!worker)worker=new Worker(new URL('../domain/worker.ts',import.meta.url),{type:'module'});const id=++request;return new Promise((resolve,reject)=>{const timer=setTimeout(()=>{worker?.removeEventListener('message',handler);reject(new Error('Analysis timed out'));},10000);const handler=(e:MessageEvent)=>{if(e.data.id!==id)return;clearTimeout(timer);worker!.removeEventListener('message',handler);e.data.error?reject(new Error(e.data.error)):resolve(e.data.result);};worker!.addEventListener('message',handler);worker!.postMessage({id,ledger:l,asOf});});}
export function releaseWorker(){worker?.terminate();worker=null;}
