import type { Account, Approval, ApprovalEntry, Environment, Job } from './types.ts';
import type { Fact } from './facts.ts';
import { factVersion } from './facts.ts';
import { publishingConfigured } from './gates.ts';
import { unseal } from './security.ts';
import { audit, stopped } from './store.ts';
import * as threads from './threads.ts';
export function retryDelay(attempt: number): number { return Math.min(3600000, 60000 * 2 ** Math.min(attempt,6)); }
export async function entriesStillValid(entries: ApprovalEntry[], facts: Fact[]): Promise<boolean> {
  for(const entry of entries) {
    const fact=facts.find(f=>f.id===entry.factId && f.status==='reviewed');
    if(!fact || await factVersion(fact)!==entry.version) return false;
  }
  return true;
}
async function attention(env: Environment, account: Account, event: string): Promise<void> {
  await env.DB.prepare("UPDATE accounts SET status='attention' WHERE id=? AND approval_id=?").bind(account.id,account.approval_id).run();
  await audit(env,account.id,event);
}
async function retry(env: Environment, job: Job, account: Account, now: number, reason: string): Promise<void> {
  await env.DB.prepare("UPDATE jobs SET status='retry',attempt=attempt+1,available_at=?,error_code=? WHERE id=? AND status='claimed'").bind(now+retryDelay(job.attempt),reason,job.id).run();
  if(job.attempt>=4) await attention(env,account,'preflight_retries_exhausted');
}
export async function runScheduled(env: Environment, facts: Fact[], now=Date.now()): Promise<void> {
  // Housekeeping does not depend on whether publishing is enabled.
  await env.DB.batch([
    env.DB.prepare('DELETE FROM sessions WHERE expires_at<?').bind(now),
    env.DB.prepare('DELETE FROM oauth_states WHERE expires_at<?').bind(now),
    env.DB.prepare('DELETE FROM rate_limits WHERE expires_at<?').bind(now),
    env.DB.prepare('DELETE FROM audit WHERE created_at<?').bind(now-90*86400000)
  ]);
  if(!publishingConfigured(env,facts) || await stopped(env)) return;
  // Never resend a write whose outcome is unknown. A crash after successful remote
  // publication is intentionally held for reconciliation rather than duplicated.
  const uncertain=await env.DB.prepare("UPDATE jobs SET status='uncertain',error_code='interrupted_write' WHERE status='sending' AND lease_until<? RETURNING account_id").bind(now).all<{account_id:string}>();
  for(const row of uncertain.results) await env.DB.prepare("UPDATE accounts SET status='attention' WHERE id=?").bind(row.account_id).run();
  const due=await env.DB.prepare("SELECT * FROM accounts WHERE status='active' AND next_due_at<=? ORDER BY next_due_at LIMIT 10").bind(now).all<Account>();
  for(const account of due.results) {
    if(await stopped(env)) break;
    if(account.token_expires_at<=now+60000) { await attention(env,account,'token_expired'); continue; }
    const approval=await env.DB.prepare('SELECT * FROM approvals WHERE id=? AND account_id=?').bind(account.approval_id,account.id).first<Approval>();
    if(!approval) { await attention(env,account,'approval_missing'); continue; }
    const entries=JSON.parse(approval.entries_json) as ApprovalEntry[];
    if(!await entriesStillValid(entries,facts)) { await attention(env,account,'library_changed'); continue; }
    const entry=entries[account.cursor];
    if(!entry) { await env.DB.prepare("UPDATE accounts SET status='exhausted' WHERE id=? AND approval_id=?").bind(account.id,account.approval_id).run(); continue; }
    const jobId=crypto.randomUUID();
    let job=await env.DB.prepare("INSERT OR IGNORE INTO jobs(id,account_id,approval_id,position,post_text,status,available_at,lease_until,created_at) VALUES(?,?,?,?,?,'claimed',?,?,?) RETURNING *").bind(jobId,account.id,approval.id,account.cursor,entry.text,now,now+120000,now).first<Job>();
    if(!job) job=await env.DB.prepare("UPDATE jobs SET status='claimed',lease_until=? WHERE account_id=? AND approval_id=? AND position=? AND ((status='retry' AND available_at<=?) OR (status='claimed' AND lease_until<?)) RETURNING *").bind(now+120000,account.id,approval.id,account.cursor,now,now).first<Job>();
    if(!job) continue;
    let token:string;
    try {
      token=await unseal(account.token_cipher,env.TOKEN_ENCRYPTION_KEY!,account.id);
      if(!await threads.hasQuota(token)) { await retry(env,job,account,now,'quota_unavailable'); continue; }
    } catch { await retry(env,job,account,now,'preflight_failed'); continue; }
    const sending=await env.DB.prepare("UPDATE jobs SET status='sending' WHERE id=? AND status='claimed' AND EXISTS(SELECT 1 FROM accounts WHERE id=? AND status='active' AND approval_id=? AND cursor=?) AND EXISTS(SELECT 1 FROM controls WHERE id=1 AND emergency_stop=0) RETURNING id").bind(job.id,account.id,approval.id,account.cursor).first();
    if(!sending) continue;
    try {
      const remoteId=await threads.publish(token,job.post_text);
      const next=now+account.cadence_hours*3600000;
      await env.DB.batch([
        env.DB.prepare("UPDATE jobs SET status='sent',remote_id=? WHERE id=? AND status='sending'").bind(remoteId,job.id),
        env.DB.prepare("UPDATE accounts SET cursor=cursor+1,next_due_at=?,status=CASE WHEN status='active' AND cursor+1>=? THEN 'exhausted' ELSE status END WHERE id=? AND approval_id=? AND cursor=?").bind(next,entries.length,account.id,approval.id,account.cursor)
      ]);
      await audit(env,account.id,'post_published');
    } catch {
      await env.DB.prepare("UPDATE jobs SET status='uncertain',error_code='publish_outcome_unknown' WHERE id=? AND status='sending'").bind(job.id).run();
      // An account may have been deleted during the request. Do not recreate it.
      const exists=await env.DB.prepare('SELECT id FROM accounts WHERE id=?').bind(account.id).first();
      if(exists) await attention(env,account,'publish_outcome_unknown');
    }
  }
}
