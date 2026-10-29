import corpus from '../content/facts.json' with { type: 'json' };
import { digest, factVersion, libraryVersion, renderedPost, TARGET_FACTS } from './facts.ts';
import type { Fact } from './facts.ts';
import type { Account, ApprovalEntry, Environment } from './types.ts';
import { authorizationUrl, exchangeCode, exchangeLongToken, profile } from './threads.ts';
import { cookies, oauthCookie, randomToken, seal, securityHeaders, sessionCookie } from './security.ts';
import { launchGaps, publishingConfigured } from './gates.ts';
import { audit, limited, stopped } from './store.ts';
import { runScheduled } from './scheduler.ts';
const facts=corpus as Fact[];
const json=(value:unknown,status=200)=>Response.json(value,{status});
class HttpError extends Error { status:number; constructor(message:string,status=400){super(message);this.status=status;} }
async function body(request: Request): Promise<Record<string,unknown>> {
  if(!request.headers.get('Content-Type')?.startsWith('application/json')) throw new HttpError('Use application/json',415);
  const reader=request.body?.getReader(); if(!reader) throw new HttpError('Request body required');
  const chunks:Uint8Array[]=[];let size=0;
  while(true){const {value,done}=await reader.read();if(done)break;size+=value.length;if(size>16384){await reader.cancel();throw new HttpError('Request too large',413);}chunks.push(value);}
  const bytes=new Uint8Array(size);let offset=0;for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.length;}
  try { const value=JSON.parse(new TextDecoder().decode(bytes));if(!value||Array.isArray(value)||typeof value!=='object') throw Error();return value; }
  catch{throw new HttpError('Invalid JSON');}
}
async function session(request:Request,env:Environment,write=false):Promise<{account:Account;csrf:string}> {
  const raw=cookies(request)['__Host-ft-session'];
  if(!raw || !/^[a-f0-9]{64}$/.test(raw)) throw new HttpError('Connect your Threads account first',401);
  const saved=await env.DB.prepare('SELECT account_id,csrf FROM sessions WHERE token_hash=? AND expires_at>?').bind(await digest(raw),Date.now()).first<{account_id:string;csrf:string}>();
  if(!saved)throw new HttpError('Your session expired. Connect again.',401);
  if(write && await digest(request.headers.get('X-CSRF-Token')??'')!==await digest(saved.csrf)) throw new HttpError('Session verification failed',403);
  const account=await env.DB.prepare('SELECT * FROM accounts WHERE id=?').bind(saved.account_id).first<Account>();
  if(!account) throw new HttpError('Account disconnected',401);
  return {account,csrf:saved.csrf};
}
async function route(request:Request,env:Environment):Promise<Response> {
  const url=new URL(request.url),path=url.pathname,method=request.method;
  if(path==='/api/health') return json({ok:true,mode:launchGaps(env,facts).length?'preview':'connected',publishing:publishingConfigured(env,facts)&&!await stopped(env)});
  if(path==='/api/status')return json({mode:launchGaps(env,facts).length?'preview':'connected',launchGaps:launchGaps(env,facts),publishingEnabled:publishingConfigured(env,facts)&&!await stopped(env),reviewedCount:facts.filter(f=>f.status==='reviewed').length,target:TARGET_FACTS});
  if(path==='/api/facts' && method==='GET')return json({version:await libraryVersion(facts),facts});
  if(!path.startsWith('/api/') && !path.startsWith('/oauth/'))return env.ASSETS.fetch(request);
  if(!['GET','POST','DELETE'].includes(method))throw new HttpError('Method not allowed',405);
  if(method!=='GET' && request.headers.get('Origin')!==env.APP_ORIGIN) throw new HttpError('Request origin rejected',403);
  if(path==='/oauth/start' && method==='POST') {
    const gaps=launchGaps(env,facts);if(gaps.length)return json({error:'Connections are not open yet',gaps},503);
    if(await limited(env,request,'oauth',5))throw new HttpError('Wait a minute, then try again.',429);
    const state=randomToken(),browser=randomToken();
    await env.DB.prepare('INSERT INTO oauth_states(state_hash,browser_hash,expires_at) VALUES(?,?,?)').bind(await digest(state),await digest(browser),Date.now()+600000).run();
    const response=json({url:authorizationUrl(env.THREADS_APP_ID,`${env.APP_ORIGIN}/oauth/callback`,state)});
    response.headers.append('Set-Cookie',oauthCookie(browser));return response;
  }
  if(path==='/oauth/callback' && method==='GET') {
    if(launchGaps(env,facts).length)throw new HttpError('Connections are not open yet',503);
    const state=url.searchParams.get('state')??'',browser=cookies(request)['__Host-ft-oauth']??'';
    if(!/^[a-f0-9]{64}$/.test(state)||!/^[a-f0-9]{64}$/.test(browser))throw new HttpError('Invalid connection state',403);
    const saved=await env.DB.prepare('DELETE FROM oauth_states WHERE state_hash=? AND browser_hash=? AND expires_at>? RETURNING state_hash').bind(await digest(state),await digest(browser),Date.now()).first();
    if(!saved)throw new HttpError('Connection request expired or already used',403);
    if(url.searchParams.has('error'))throw new HttpError('Connection was declined');
    const code=url.searchParams.get('code');if(!code || code.length>4096)throw new HttpError('Missing or invalid authorization code');
    const short=await exchangeCode(env.THREADS_APP_ID,env.THREADS_APP_SECRET!,code,`${env.APP_ORIGIN}/oauth/callback`);
    const long=await exchangeLongToken(short.access_token,env.THREADS_APP_SECRET!);
    const who=await profile(long.access_token);
    if(String(who.id)!==String(short.user_id))throw new HttpError('Provider account mismatch',502);
    const existing=await env.DB.prepare('SELECT id FROM accounts WHERE threads_id=?').bind(String(who.id)).first<{id:string}>();
    const accountId=existing?.id??crypto.randomUUID(),tokenCipher=await seal(long.access_token,env.TOKEN_ENCRYPTION_KEY!,accountId);
    await env.DB.prepare("INSERT INTO accounts(id,threads_id,username,token_cipher,token_expires_at,created_at) VALUES(?,?,?,?,?,?) ON CONFLICT(threads_id) DO UPDATE SET username=excluded.username,token_cipher=excluded.token_cipher,token_expires_at=excluded.token_expires_at,status='paused'").bind(accountId,String(who.id),who.username,tokenCipher,Date.now()+long.expires_in*1000,Date.now()).run();
    // Reconnection pauses scheduling and invalidates previous browser sessions.
    const token=randomToken(),csrf=randomToken();
    await env.DB.batch([
      env.DB.prepare('DELETE FROM sessions WHERE account_id=?').bind(accountId),
      env.DB.prepare("UPDATE jobs SET status='cancelled' WHERE account_id=? AND status IN ('claimed','retry')").bind(accountId),
      env.DB.prepare('INSERT INTO sessions(token_hash,account_id,csrf,expires_at) VALUES(?,?,?,?)').bind(await digest(token),accountId,csrf,Date.now()+604800000)
    ]);
    await audit(env,accountId,'account_connected');
    const response=new Response(null,{status:303,headers:{Location:`${env.APP_ORIGIN}/?connected=1`}});
    response.headers.append('Set-Cookie',sessionCookie(token));response.headers.append('Set-Cookie',oauthCookie('',0));return response;
  }
  if(path.startsWith('/api/')) {
    const {account,csrf}=await session(request,env,method!=='GET');
    if(method!=='GET'&&await limited(env,request,'account-write'))throw new HttpError('Wait a minute, then try again.',429);
    if(path==='/api/account'&&method==='GET') {
      const approval=account.approval_id?await env.DB.prepare('SELECT entries_json FROM approvals WHERE id=? AND account_id=?').bind(account.approval_id,account.id).first<{entries_json:string}>():null;
      const events=await env.DB.prepare('SELECT event,created_at FROM audit WHERE account_id=? ORDER BY created_at DESC LIMIT 20').bind(account.id).all();
      return json({username:account.username,status:account.status,cadenceHours:account.cadence_hours,nextDueAt:account.next_due_at,cursor:account.cursor,entries:approval?JSON.parse(approval.entries_json):[],csrf,events:events.results});
    }
    if(path==='/api/approve'&&method==='POST') {
      if(!publishingConfigured(env,facts)||await stopped(env))throw new HttpError('Publishing is currently disabled',503);
      const input=await body(request);
      if(input.consent!==true || input.disclosureAccepted!==true)throw new HttpError('Read the posts and accept both approval checkboxes.');
      const cadence=Number(input.cadenceHours);if(![1,6,12,24].includes(cadence))throw new HttpError('Choose a supported cadence');
      if(input.libraryVersion!==await libraryVersion(facts))throw new HttpError('The library changed. Reload and read the current posts before approving.',409);
      if(!Array.isArray(input.factIds)||input.factIds.length<1||input.factIds.length>100||new Set(input.factIds).size!==input.factIds.length)throw new HttpError('Choose between 1 and 100 different facts.');
      const entries:ApprovalEntry[]=[];
      for(const id of input.factIds){const fact=facts.find(f=>f.id===id&&f.status==='reviewed');if(!fact)throw new HttpError('Choose facts that have finished source review.');entries.push({factId:fact.id,version:await factVersion(fact),text:renderedPost(fact)});}
      const unresolved=await env.DB.prepare("SELECT id FROM jobs WHERE account_id=? AND status IN ('sending','uncertain') LIMIT 1").bind(account.id).first();
      if(unresolved)throw new HttpError('An earlier post may already be on Threads. Its result needs checking before you start another queue.',409);
      const approvalId=crypto.randomUUID(),now=Date.now();
      await env.DB.batch([
        env.DB.prepare("UPDATE jobs SET status='cancelled' WHERE account_id=? AND status IN ('claimed','retry')").bind(account.id),
        env.DB.prepare('INSERT INTO approvals(id,account_id,library_version,entries_json,cadence_hours,approved_at) VALUES(?,?,?,?,?,?)').bind(approvalId,account.id,input.libraryVersion,JSON.stringify(entries),cadence,now),
        env.DB.prepare("UPDATE accounts SET approval_id=?,status='active',cadence_hours=?,cursor=0,next_due_at=? WHERE id=?").bind(approvalId,cadence,now+cadence*3600000,account.id)
      ]);
      await audit(env,account.id,'batch_approved');return json({ok:true,count:entries.length,nextDueAt:now+cadence*3600000});
    }
    if(path==='/api/pause'&&method==='POST') {
      await env.DB.batch([
        env.DB.prepare("UPDATE accounts SET status='paused' WHERE id=?").bind(account.id),
        env.DB.prepare("UPDATE jobs SET status='cancelled' WHERE account_id=? AND status IN ('claimed','retry')").bind(account.id)
      ]);await audit(env,account.id,'schedule_paused');return json({ok:true,note:'Future jobs are stopped. A request already sent to Threads may still finish.'});
    }
    if(path==='/api/account'&&method==='DELETE') {
      // CASCADE removes approval snapshots, pending jobs, sessions, and audit events.
      await env.DB.prepare('DELETE FROM accounts WHERE id=?').bind(account.id).run();
      const response=json({ok:true,providerRevoked:false,note:'Local data and tokens deleted. Remove Fact Threader in Threads app permissions to revoke at Meta. A request already sent may still finish.'});response.headers.append('Set-Cookie',sessionCookie('',0));return response;
    }
  }
  throw new HttpError('Not found',404);
}
export default {
  async fetch(request:Request,env:Environment):Promise<Response> {
    try { return securityHeaders(await route(request,env),new URL(request.url).pathname.startsWith('/api/')||new URL(request.url).pathname.startsWith('/oauth/')); }
    catch(error) {
      if(error instanceof HttpError)return securityHeaders(json({error:error.message},error.status),true);
      // Do not log thrown provider errors, URLs, request headers, tokens, or bodies.
      console.error(JSON.stringify({event:'request_failed',reference:crypto.randomUUID()}));
      return securityHeaders(json({error:'The service could not complete this request. Try again in a few minutes.'},500),true);
    }
  },
  async scheduled(_event:ScheduledController,env:Environment):Promise<void> { await runScheduled(env,facts); }
} satisfies ExportedHandler<Environment>;
