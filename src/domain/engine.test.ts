import {describe,expect,it} from 'vitest';
import {emptyLedger,uid,type Ledger,type Transaction} from './model';
import {analyze,occurrences,simulate} from './engine';
import {demoLedger,DEMO_DATE} from './demo';
import {answerQuestion,parseExpense} from './language';

const tx=(date:string,amount:number,type:Transaction['type']='expense',extra:Partial<Transaction>={}):Transaction=>({id:uid(),date,type,amount,category:'food',merchant:'Campus cafe',description:'',source:'manual',exceptional:false,...extra});

describe('accounting and forecasts',()=>{
 it('applies only transactions after an end-of-day cash checkpoint',()=>{const l=emptyLedger('2026-09-01');l.profile.coverageConfirmed=true;l.checkpoint={date:'2026-09-10',amount:100000};l.transactions=[tx('2026-09-10',30000),tx('2026-09-11',10000),tx('2026-09-12',5000,'refund')];expect(analyze(l,'2026-09-12').currentBalance).toBe(95000)});
 it('nets refunds from spending while preserving positive stored amounts',()=>{const l=emptyLedger('2026-09-01');const original=tx('2026-09-03',50000);l.transactions=[original,tx('2026-09-04',20000,'refund',{refundOf:original.id})];expect(analyze(l,'2026-09-10').actual).toBe(30000)});
 it('does not create a personalized forecast before 14 confirmed days',()=>{const l=emptyLedger('2026-09-01');l.profile.coverageConfirmed=true;l.transactions=[tx('2026-09-02',10000)];const a=analyze(l,'2026-09-08');expect(a.variable).toBe(0);expect(a.trackingDays).toBe(7)});
 it('does not double count a linked recurring payment',()=>{const l=emptyLedger('2026-08-01');l.profile.coverageConfirmed=true;const id=uid();l.schedules=[{id,name:'Rent',amount:400000,type:'expense',category:'hostel',date:'2026-09-03',cadence:'monthly',confirmed:true,active:true,skipped:[]}];l.transactions=[tx('2026-09-03',400000,'expense',{category:'hostel',scheduleId:id})];expect(occurrences(l,'2026-09-01','2026-09-30')[0].paid).toBe(true);expect(analyze(l,'2026-09-10').committed).toBe(0)});
 it('produces deterministic scenario deltas and never changes the ledger',()=>{const l=demoLedger(),before=JSON.stringify(l);const result=simulate(l,DEMO_DATE,{id:uid(),name:'Reduce food',type:'reduction',amount:50000,category:'food',date:DEMO_DATE});expect(result.horizons[0].change).toBeGreaterThan(0);expect(result.horizons[3].change).toBeGreaterThan(result.horizons[0].change);expect(JSON.stringify(l)).toBe(before)});
});

describe('bounded language features',()=>{
 it('extracts an expense draft for user confirmation',()=>{const result=parseExpense('Had lunch at CCD for 320','2026-09-20');expect(result.draft.amount).toBe(32000);expect(result.draft.category).toBe('food');expect(result.draft.source).toBe('language')});
 it('rejects ambiguous multiple numbers',()=>{expect(()=>parseExpense('Paid 200 and 300','2026-09-20')).toThrow(/one amount/i)});
 it('answers from transaction IDs and states its period',()=>{const l=demoLedger();const a=answerQuestion(l,DEMO_DATE,'How much did I spend on food this month?');expect(a.text).toContain('net spending');expect(a.evidence?.transactionIds.length).toBeGreaterThan(0);expect(a.evidence?.period.from).toBe('2026-09-01')});
 it('requires semester dates rather than assuming them',()=>{const l=emptyLedger('2026-09-01');const a=answerQuestion(l,'2026-09-20','How much did I spend on Uber this semester?');expect(a.title).toBe('Define your semester')});
});
