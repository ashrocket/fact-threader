import { after, before, test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { Miniflare, convertV4MiniflareOptions } from 'miniflare';
import worker from '../src/index.ts';
import corpus from '../content/facts.json' with { type: 'json' };
import type { Fact } from '../src/facts.ts';
import { digest, libraryVersion } from '../src/facts.ts';
import { randomToken, seal } from '../src/security.ts';
import { runScheduled } from '../src/scheduler.ts';
import type { Environment } from '../src/types.ts';
import { fixture } from './fixtures.ts';
let mf:Miniflare,env:Environment,sessionToken:string,csrf:string;
const records=corpus as Fact[],original=records.slice();
const sourceFetch=globalThis.fetch;
before(async()=>{
  mf=new Miniflare(convertV4MiniflareOptions({workers:[{name:'test',modules:true,script:'export default {fetch(){return new Response("test")}}',compatibilityDate:'2026-10-29',d1Databases:['DB'],bindings:{APP_ORIGIN:'https://test.example',THREADS_APP_ID:'synthetic-app-id',OAUTH_ENABLED:'true',PUBLISHING_ENABLED:'true',APP_REVIEW_APPROVED:'true',PLATFORM_POLICY_APPROVED:'true',CORPUS_APPROVED:'true'}}]}));
  env=await mf.getBindings<Environment>();
  env.TOKEN_ENCRYPTION_KEY=btoa(String.fromCharCode(...crypto.getRandomValues(new Uint8Array(32))));env.THREADS_APP_SECRET='synthetic-test-only';
  const migration=await readFile(new URL('../migrations/0001_initial.sql',import.meta.url),'utf8');
  await env.DB.exec(migration.replaceAll('\n',' '));
  await env.DB.prepare('UPDATE controls SET emergency_stop=0').run();
  records.splice(0,records.length,...Array.from({length:100},(_,i)=>fixture(i+1)));
});
after(async()=>{records.splice(0,records.length,...original);globalThis.fetch=sourceFetch;await mf?.dispose();});
async function account(id='a'){
  await env.DB.prepare('DELETE FROM accounts WHERE id=?').bind(id).run();
  await env.DB.prepare('INSERT INTO accounts(id,threads_id,username,token_cipher,token_expires_at,created_at) VALUES(?,?,?,?,?,?)').bind(id,`test-${id}`,`synthetic-${id}`,await seal('synthetic-access-token',env.TOKEN_ENCRYPTION_KEY!,id),Date.now()+86400000,Date.now()).run();
  sessionToken=randomToken();csrf=randomToken();await env.DB.prepare('INSERT INTO sessions(token_hash,account_id,csrf,expires_at) VALUES(?,?,?,?)').bind(await digest(sessionToken),id,csrf,Date.now()+86400000).run();
}
function request(path:string,method='GET',data?:unknown,headers:Record<string,string>={}){return new Request('https://test.example'+path,{method,headers:{Cookie:`__Host-ft-session=${sessionToken}`,Origin:'https://test.example','Content-Type':'application/json','X-CSRF-Token':csrf,...headers},body:data?JSON.stringify(data):undefined});}
async function approve(){const response=await worker.fetch(request('/api/approve','POST',{factIds:[fixture().id],libraryVersion:await libraryVersion(records),cadenceHours:1,consent:true,disclosureAccepted:true}),env);assert.equal(response.status,200,await response.text());await env.DB.prepare('UPDATE accounts SET next_due_at=? WHERE id=?').bind(Date.now()-1000,'a').run();}
test('default gates deny connection and publishing',async()=>{const response=await worker.fetch(request('/oauth/start','POST',{}),{...env,OAUTH_ENABLED:'false'});assert.equal(response.status,503);let calls=0;globalThis.fetch=async()=>{calls++;return Response.json({});};await runScheduled({...env,PUBLISHING_ENABLED:'false'},records);assert.equal(calls,0);});
test('CSRF/origin checks prevent writes and account data stays isolated',async()=>{
  await account('a');const tokenA=sessionToken;await account('b');
  const response=await worker.fetch(request('/api/account'),env);assert.equal((await response.json() as {username:string}).username,'synthetic-b');
  const bad=await worker.fetch(request('/api/pause','POST',{}, {'X-CSRF-Token':'wrong'}),env);assert.equal(bad.status,403);
  const cross=await worker.fetch(request('/api/pause','POST',{}, {Origin:'https://attacker.example'}),env);assert.equal(cross.status,403);
  const own=await worker.fetch(request('/api/account','GET',undefined,{Cookie:`__Host-ft-session=${tokenA}`}),env);assert.equal((await own.json() as {username:string}).username,'synthetic-a');
});
test('OAuth state is browser-bound, single-use and expiring',async()=>{
  globalThis.fetch=async()=>{throw Error('Provider intentionally unavailable in test');};
  const start=await worker.fetch(request('/oauth/start','POST',{}),env);assert.equal(start.status,200);
  const target=new URL((await start.json() as {url:string}).url),state=target.searchParams.get('state');
  const cookie=start.headers.get('set-cookie')!.split(';')[0];
  const mismatch=await worker.fetch(new Request(`https://test.example/oauth/callback?code=fixture&state=${state}`,{headers:{Cookie:'__Host-ft-oauth='+randomToken()}}),env);assert.equal(mismatch.status,403);
  const first=await worker.fetch(new Request(`https://test.example/oauth/callback?code=fixture&state=${state}`,{headers:{Cookie:cookie}}),env);assert.equal(first.status,500);
  const replay=await worker.fetch(new Request(`https://test.example/oauth/callback?code=fixture&state=${state}`,{headers:{Cookie:cookie}}),env);assert.equal(replay.status,403);
  const expiredState=randomToken(),expiredBrowser=randomToken();
  await env.DB.prepare('INSERT INTO oauth_states(state_hash,browser_hash,expires_at) VALUES(?,?,?)').bind(await digest(expiredState),await digest(expiredBrowser),Date.now()-1).run();
  const expired=await worker.fetch(new Request(`https://test.example/oauth/callback?code=fixture&state=${expiredState}`,{headers:{Cookie:`__Host-ft-oauth=${expiredBrowser}`}}),env);assert.equal(expired.status,403);
});
test('consent is required and stale library approval is rejected',async()=>{
  await account();const response=await worker.fetch(request('/api/approve','POST',{factIds:['ice-0001'],libraryVersion:await libraryVersion(records),cadenceHours:1,consent:false,disclosureAccepted:true}),env);assert.equal(response.status,400);
  const stale=await worker.fetch(request('/api/approve','POST',{factIds:['ice-0001'],libraryVersion:'old',cadenceHours:1,consent:true,disclosureAccepted:true}),env);assert.equal(stale.status,409);
});
test('concurrent scheduler ticks publish once and exhaust a finite batch',async()=>{
  await account();await approve();let posts=0;
  globalThis.fetch=async(input,init)=>{if(init?.method==='POST'){posts++;return Response.json({id:'synthetic-post-id'});}assert.match(String(input),/threads_publishing_limit/);return Response.json({data:[{quota_usage:0,config:{quota_total:24}}]});};
  await Promise.all([runScheduled(env,records),runScheduled(env,records)]);assert.equal(posts,1);
  const row=await env.DB.prepare('SELECT status,cursor FROM accounts WHERE id=?').bind('a').first<{status:string;cursor:number}>();assert.equal(row?.status,'exhausted');assert.equal(row?.cursor,1);
});
test('unknown publish outcomes pause and are never automatically resent',async()=>{
  await account();await approve();let posts=0;globalThis.fetch=async(_input,init)=>{if(init?.method==='POST'){posts++;throw Error('Synthetic timeout after send');}return Response.json({data:[{quota_usage:0,config:{quota_total:24}}]});};
  await runScheduled(env,records);await runScheduled(env,records,Date.now()+7200000);assert.equal(posts,1);
  const job=await env.DB.prepare('SELECT status FROM jobs WHERE account_id=?').bind('a').first<{status:string}>();assert.equal(job?.status,'uncertain');
  const response=await worker.fetch(request('/api/approve','POST',{factIds:['ice-0001'],libraryVersion:await libraryVersion(records),cadenceHours:1,consent:true,disclosureAccepted:true}),env);assert.equal(response.status,409);
});
test('quota preflight failure backs off without writing, and emergency stop prevents calls',async()=>{
  await account();await approve();let calls=0;globalThis.fetch=async()=>{calls++;return Response.json({data:[{quota_usage:24,config:{quota_total:24}}]});};
  await runScheduled(env,records);await runScheduled(env,records);assert.equal(calls,1);
  const job=await env.DB.prepare('SELECT status,attempt FROM jobs WHERE account_id=?').bind('a').first<{status:string;attempt:number}>();assert.equal(job?.status,'retry');assert.equal(job?.attempt,1);
  await env.DB.prepare('UPDATE controls SET emergency_stop=1').run();await runScheduled(env,records,Date.now()+7200000);assert.equal(calls,1);await env.DB.prepare('UPDATE controls SET emergency_stop=0').run();
});
test('withdrawn approval stops publishing; disconnect cascades all private rows',async()=>{
  await account();await approve();let calls=0;globalThis.fetch=async()=>{calls++;throw Error('Must not call');};const changed=records.map(f=>f.id==='ice-0001'?{...f,status:'withdrawn' as const}:f);await runScheduled(env,changed);assert.equal(calls,0);
  const paused=await worker.fetch(request('/api/pause','POST',{}),env);assert.equal(paused.status,200);
  const response=await worker.fetch(request('/api/account','DELETE'),env);assert.equal(response.status,200);
  assert.equal((await response.json() as {providerRevoked:boolean}).providerRevoked,false);
  for(const table of ['accounts','sessions','approvals','jobs','audit']){const column=table==='accounts'?'id':'account_id';const row=await env.DB.prepare(`SELECT COUNT(*) AS count FROM ${table} WHERE ${column}=?`).bind('a').first<{count:number}>();assert.equal(row?.count,0,table);}
  const lost=await worker.fetch(request('/api/account'),env);assert.equal(lost.status,401);
});
