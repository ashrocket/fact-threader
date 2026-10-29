import { TARGET_FACTS, validateFacts } from './facts.ts';
import type { Fact } from './facts.ts';
import type { Environment } from './types.ts';
export function launchGaps(env: Environment, facts: Fact[]): string[] {
  const gaps:string[]=[];
  if(env.OAUTH_ENABLED!=='true') gaps.push('Connections are disabled');
  if(env.APP_REVIEW_APPROVED!=='true') gaps.push('Meta app review is pending');
  if(env.PLATFORM_POLICY_APPROVED!=='true') gaps.push('Platform-policy verification is pending');
  if(env.CORPUS_APPROVED!=='true' || facts.filter(f=>f.status==='reviewed').length<TARGET_FACTS || validateFacts(facts).length) gaps.push('The 100-post launch library is awaiting approval');
  if(!env.THREADS_APP_ID || !env.THREADS_APP_SECRET || !env.TOKEN_ENCRYPTION_KEY) gaps.push('Connection credentials are not configured');
  try { const u=new URL(env.APP_ORIGIN); if(u.protocol!=='https:' || u.pathname!=='/' || ['localhost','127.0.0.1'].includes(u.hostname)) gaps.push('A public HTTPS origin is required'); } catch { gaps.push('A public HTTPS origin is required'); }
  return gaps;
}
export function publishingConfigured(env: Environment, facts: Fact[]): boolean { return env.PUBLISHING_ENABLED==='true' && launchGaps(env,facts).length===0; }
