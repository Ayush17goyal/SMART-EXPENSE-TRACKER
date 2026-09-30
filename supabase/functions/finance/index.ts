import {createClient} from 'https://esm.sh/@supabase/supabase-js@2';
import {ledgerSchema,emptyLedger} from '../../../src/domain/model.ts';
import {analyze} from '../../../src/domain/engine.ts';
import {answerQuestion} from '../../../src/domain/language.ts';

const allowedOrigin=Deno.env.get('APP_ORIGIN')??'';
const headers={'Content-Type':'application/json','Access-Control-Allow-Origin':allowedOrigin,'Access-Control-Allow-Headers':'authorization, x-client-info, apikey, content-type','Vary':'Origin'};
const response=(body:unknown,status=200)=>new Response(JSON.stringify(body),{status,headers});
Deno.serve(async req=>{
 if(req.method==='OPTIONS')return new Response('ok',{headers});
 const origin=req.headers.get('origin')??'';if(allowedOrigin&&origin!==allowedOrigin)return response({error:'Origin not allowed'},403);
 if(req.method!=='POST')return response({error:'Method not allowed'},405);
 try{
  const auth=req.headers.get('Authorization');if(!auth)return response({error:'Authentication required'},401);
  const client=createClient(Deno.env.get('SUPABASE_URL')!,Deno.env.get('SUPABASE_ANON_KEY')!,{global:{headers:{Authorization:auth}}});
  const {data:{user}}=await client.auth.getUser();if(!user)return response({error:'Authentication required'},401);
  const body=await req.json();if(!body||typeof body.action!=='string')return response({error:'Invalid request'},400);
  const {data:row,error:loadError}=await client.from('user_ledgers').select('ledger').eq('user_id',user.id).maybeSingle();
  if(loadError)throw loadError;const ledger=row?.ledger?ledgerSchema.parse(row.ledger):emptyLedger();
  if(body.action==='load')return response(row?.ledger??null);
  if(body.action==='save'){const parsed=ledgerSchema.parse(body.ledger);const {data,error}=await client.rpc('save_ledger',{p_ledger:parsed,p_expected_revision:body.expectedRevision});if(error)return response({error:error.message.includes('Revision')?'Your data changed in another session. Reload before saving.':'Data could not be saved.'},error.message.includes('Revision')?409:400);return response(data);}
  if(body.action==='analyze'){if(typeof body.asOf!=='string')return response({error:'Invalid date'},400);return response(analyze(ledger,body.asOf));}
  if(body.action==='ask'){
   if(!ledger.preferences.aiConsent)return response({error:'AI consent is disabled.'},403);
   if(typeof body.question!=='string'||body.question.length>500)return response({error:'Invalid question'},400);
   const deterministic=answerQuestion(ledger,String(body.asOf),body.question);
   // The provider can only polish already-calculated prose. It receives no raw ledger,
   // cannot call tools, and its result cannot replace evidence or numeric fields.
   const key=Deno.env.get('OPENAI_API_KEY'),model=Deno.env.get('OPENAI_MODEL');if(!key||!model)return response(deterministic);
   const admin=createClient(Deno.env.get('SUPABASE_URL')!,Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
   const day=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Kolkata'}).format(new Date());
   const {data:usage}=await admin.from('ai_usage').select('request_count').eq('user_id',user.id).eq('bucket_date',day).maybeSingle();if((usage?.request_count??0)>=25)return response({error:'Daily AI quota reached. Local financial answers remain available.'},429);
   await admin.from('ai_usage').upsert({user_id:user.id,bucket_date:day,request_count:(usage?.request_count??0)+1});
   const ai=await fetch('https://api.openai.com/v1/responses',{method:'POST',headers:{Authorization:`Bearer ${key}`,'Content-Type':'application/json'},body:JSON.stringify({model,store:false,max_output_tokens:180,input:[{role:'system',content:'Rewrite the supplied grounded answer in concise, warm language. Preserve every number, date, limitation, and claim exactly. Never add financial facts or advice. Output plain text only.'},{role:'user',content:JSON.stringify({question:body.question,title:deterministic.title,grounded_answer:deterministic.text})}]})});
   if(ai.ok){const json=await ai.json();const text=json.output_text;if(typeof text==='string'&&text.length<1500)deterministic.text=text;}
   return response(deterministic);
  }
  if(body.action==='delete'){const {error}=await client.from('user_ledgers').delete().eq('user_id',user.id);if(error)throw error;return response({ok:true});}
  return response({error:'Unsupported operation'},400);
 }catch(e){console.error('finance_request_failed',{name:e instanceof Error?e.name:'unknown'});return response({error:'Request could not be completed.'},500);}
});
