import { analyze } from './engine.ts';
self.onmessage=e=>{try{self.postMessage({id:e.data.id,result:analyze(e.data.ledger,e.data.asOf)});}catch{self.postMessage({id:e.data.id,error:'Analysis could not be calculated.'});}};
