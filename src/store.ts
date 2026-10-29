import { digest } from './facts.ts';
import type { Environment } from './types.ts';
export async function audit(env: Environment, accountId: string, event: string): Promise<void> {
  await env.DB.prepare('INSERT INTO audit(id,account_id,event,created_at) VALUES(?,?,?,?)').bind(crypto.randomUUID(),accountId,event,Date.now()).run();
}
export async function stopped(env: Environment): Promise<boolean> {
  const row=await env.DB.prepare('SELECT emergency_stop FROM controls WHERE id=1').first<{emergency_stop:number}>();
  return row?.emergency_stop !== 0;
}
export async function limited(env: Environment, request: Request, purpose: string, limit=30): Promise<boolean> {
  const slot=Math.floor(Date.now()/60000);
  // Short-lived, rotating keyed material. Raw IP addresses are never stored.
  const bucket=await digest(`${env.TOKEN_ENCRYPTION_KEY ?? ''}:${purpose}:${slot}:${request.headers.get('CF-Connecting-IP') ?? 'local'}`);
  const row=await env.DB.prepare('INSERT INTO rate_limits(bucket,hits,expires_at) VALUES(?,1,?) ON CONFLICT(bucket) DO UPDATE SET hits=hits+1 RETURNING hits').bind(bucket,(slot+2)*60000).first<{hits:number}>();
  return !row || row.hits>limit;
}
