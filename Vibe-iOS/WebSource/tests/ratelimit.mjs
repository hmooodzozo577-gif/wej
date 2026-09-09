import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {readFileSync} from 'node:fs';
import {DatabaseSync} from 'node:sqlite';

const source=await fs.readFile('server/worker.mjs','utf8');
// Each tag produces a distinct module URL, so every load gets its own module state.
// That is exactly what a second Worker isolate looks like from the counter's point of view.
const isolate=tag=>import('data:text/javascript;base64,'+Buffer.from('const ASSETS={};\n// isolate '+tag+'\n'+source).toString('base64')).then(m=>m.default);

const sqlite=new DatabaseSync(':memory:');
for(const file of ['0000_blushing_lake.sql','0001_bitter_star_brand.sql'])
 sqlite.exec(readFileSync(new URL('../drizzle/'+file,import.meta.url),'utf8'));
const DB={prepare(sql){const make=args=>({
  async run(){const r=sqlite.prepare(sql).run(...args);return {meta:{changes:r.changes}};},
  async first(){return sqlite.prepare(sql).get(...args)??null;}});
 return {bind(...args){return make(args);},...make([])};}};

const origin='https://vibe-social-nights.bb0949.chatgpt.site';
let id=0; const nextId=()=>String(id++).padStart(11,'v');
const preview=(worker,env,ip)=>worker.fetch(new Request(origin+'/api/video-preview?id='+nextId(),{headers:{'CF-Connecting-IP':ip}}),env);

const realFetch=globalThis.fetch, realNow=Date.now;
let upstream=0;
globalThis.fetch=async()=>{upstream++;return new Response(JSON.stringify({title:'t'}));};
let clock=1_000_000_000_000; Date.now=()=>clock;

try{
 // 1. Without a shared store each isolate keeps its own tally, so the published limit of 20
 //    is really 20 per isolate. This is the defect the shared counter exists to remove.
 {
  const [a,b]=[await isolate('unshared-a'),await isolate('unshared-b')];
  let accepted=0;
  for(const w of [a,b])for(let i=0;i<20;i++)if((await preview(w,{},'1.1.1.1')).status===200)accepted++;
  assert.equal(accepted,40,'two isolates without a shared store admit double the limit');
 }

 // 2. With D1 both isolates share one row: 20 in total, then refusal, whichever isolate is hit.
 {
  const [a,b]=[await isolate('d1-a'),await isolate('d1-b')];
  let accepted=0;
  for(let i=0;i<10;i++){
   if((await preview(a,{DB},'2.2.2.2')).status===200)accepted++;
   if((await preview(b,{DB},'2.2.2.2')).status===200)accepted++;
  }
  assert.equal(accepted,20,'the shared counter admits exactly the limit across both isolates');
  assert.equal((await preview(a,{DB},'2.2.2.2')).status,429);
  assert.equal((await preview(b,{DB},'2.2.2.2')).status,429,'refusal is shared, not per isolate');
  const row=sqlite.prepare('SELECT count FROM rate_limits WHERE bucket_key=?').get('video:2.2.2.2');
  assert.equal(row.count,22,'every attempt is counted, including refused ones');
 }

 // 3. A different caller is unaffected by another caller's exhausted window.
 assert.equal((await preview(await isolate('d1-c'),{DB},'3.3.3.3')).status,200);

 // 4. The window rolls over: the same caller is admitted again once it has passed.
 {
  const w=await isolate('window');
  clock+=60_000;
  assert.equal((await preview(w,{DB},'2.2.2.2')).status,200,'a new window resets the tally');
  assert.equal(sqlite.prepare('SELECT count FROM rate_limits WHERE bucket_key=?').get('video:2.2.2.2').count,1);
 }

 // 5. A Durable Object binding takes precedence and D1 is left untouched.
 {
  const store=new Map();
  const stub={async fetch(_u,init){
   const {key,windowMs,now}=JSON.parse(init.body);
   const slot=Math.floor(now/windowMs)*windowMs;
   const prev=store.get(key);
   const count=(prev&&prev.slot===slot?prev.count:0)+1;
   store.set(key,{slot,count});
   return new Response(JSON.stringify({count}));}};
  const RATE_LIMITER={idFromName:n=>n,get:()=>stub};
  const w=await isolate('do');
  const before=sqlite.prepare('SELECT COUNT(*) AS n FROM rate_limits').get().n;
  for(let i=0;i<20;i++)assert.equal((await preview(w,{DB,RATE_LIMITER},'4.4.4.4')).status,200);
  assert.equal((await preview(w,{DB,RATE_LIMITER},'4.4.4.4')).status,429,'the Durable Object enforces the limit');
  assert.equal(sqlite.prepare('SELECT COUNT(*) AS n FROM rate_limits').get().n,before,'D1 is not written when a Durable Object is bound');
  assert.equal(store.get('video:4.4.4.4').count,21);
 }

 // 6. A Durable Object that fails falls through to D1 rather than dropping the limit.
 {
  const RATE_LIMITER={idFromName:n=>n,get:()=>({fetch(){throw new Error('object unavailable');}})};
  const w=await isolate('do-broken');
  assert.equal((await preview(w,{DB,RATE_LIMITER},'5.5.5.5')).status,200);
  assert.equal(sqlite.prepare('SELECT count FROM rate_limits WHERE bucket_key=?').get('video:5.5.5.5').count,1,'the D1 counter still recorded the request');
 }

 // 7. Expired rows are removed, and live rows survive the sweep.
 {
  sqlite.prepare('INSERT INTO rate_limits (bucket_key,window_start,count,expires_at) VALUES (?,?,?,?)').run('video:stale',0,9,clock-1);
  const w=await isolate('prune');
  const random=Math.random; Math.random=()=>0;      // force the probabilistic sweep
  try{ await preview(w,{DB},'6.6.6.6'); } finally { Math.random=random; }
  assert.equal(sqlite.prepare('SELECT COUNT(*) AS n FROM rate_limits WHERE bucket_key=?').get('video:stale').n,0,'the expired row is gone');
  assert(sqlite.prepare('SELECT COUNT(*) AS n FROM rate_limits WHERE bucket_key=?').get('video:6.6.6.6').n>0,'the live row survived');
 }

 // 8. Support requests are counted per authenticated user, not per isolate.
 {
  const env={DB,SUPPORT_ENABLED:'true',OPENAI_API_KEY:'k',OPENAI_MODEL:'m',SUPPORT_ALLOWED_USER_IDS:'tester'};
  globalThis.fetch=async()=>Response.json({output:[{type:'message',content:[{type:'output_text',text:'ok'}]}]});
  const ask=w=>w.fetch(new Request(origin+'/api/support',{method:'POST',
   headers:{Origin:origin,'Content-Type':'application/json','oai-authenticated-user-id':'tester'},
   body:JSON.stringify({consent:true,messages:[{role:'user',content:'hi'}]})}),env);
  const [a,b]=[await isolate('support-a'),await isolate('support-b')];
  let ok=0;
  for(let i=0;i<3;i++){ if((await ask(a)).status===200)ok++; if((await ask(b)).status===200)ok++; }
  assert.equal(ok,5,'five support calls in total, not five per isolate');
  assert.equal((await ask(b)).status,429);
 }

 console.log('PASS shared rate limits: one tally across isolates via D1, Durable Object preferred and enforcing, failure falls through to D1, windows roll over, expired rows pruned, support counted per user. Durable Object stubbed; no deployed binding tested.');
}finally{ globalThis.fetch=realFetch; Date.now=realNow; }
