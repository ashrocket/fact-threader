// Only the official API. No scraping, browser cookies, unofficial clients, or engagement automation.
const API = 'https://graph.threads.com';
export const SCOPES = ['threads_basic', 'threads_content_publish'];
export class ThreadsError extends Error {
  status: number;
  constructor(status: number) { super('Threads request failed'); this.status = status; }
}
async function parse<T>(response: Response): Promise<T> {
  // Deliberately discard provider error bodies: they can contain sensitive request details.
  if (!response.ok) { await response.body?.cancel(); throw new ThreadsError(response.status); }
  const length = Number(response.headers.get('Content-Length') ?? 0);
  if (length > 65536) { await response.body?.cancel(); throw Error('Unexpected provider response'); }
  const reader = response.body?.getReader();
  if (!reader) throw Error('Empty provider response');
  const chunks: Uint8Array[]=[]; let size=0;
  while (true) { const { done,value }=await reader.read(); if(done) break; size+=value.length; if(size>65536){await reader.cancel();throw Error('Unexpected provider response');} chunks.push(value); }
  const joined = new Uint8Array(size); let offset=0; for(const c of chunks){joined.set(c,offset);offset+=c.length;}
  return JSON.parse(new TextDecoder().decode(joined)) as T;
}
export function authorizationUrl(appId: string, redirectUri: string, state: string): string {
  const url = new URL('https://www.threads.com/oauth/authorize');
  url.search = new URLSearchParams({client_id:appId, redirect_uri:redirectUri, scope:SCOPES.join(','), response_type:'code',state}).toString();
  return url.href;
}
export async function exchangeCode(appId: string, secret: string, code: string, redirectUri: string): Promise<{access_token:string; user_id:string}> {
  const result = await parse<{access_token:string;user_id:string}>(await fetch(`${API}/oauth/access_token`,{
    method:'POST',body:new URLSearchParams({client_id:appId,client_secret:secret,code,grant_type:'authorization_code',redirect_uri:redirectUri}),signal:AbortSignal.timeout(15000)
  }));
  if (!result.access_token || !result.user_id) throw Error('Invalid token response');
  return result;
}
export async function exchangeLongToken(token: string, secret: string): Promise<{access_token:string;expires_in:number}> {
  const url=new URL(`${API}/access_token`);
  url.search=new URLSearchParams({grant_type:'th_exchange_token',client_secret:secret}).toString();
  const result=await parse<{access_token:string;expires_in:number}>(await fetch(url,{headers:{Authorization:`Bearer ${token}`},signal:AbortSignal.timeout(15000)}));
  if (!result.access_token || !Number.isFinite(result.expires_in) || result.expires_in < 1) throw Error('Invalid token response');
  return result;
}
export async function profile(token: string): Promise<{id:string;username:string}> {
  const result=await parse<{id:string;username:string}>(await fetch(`${API}/me?fields=id,username`,{headers:{Authorization:`Bearer ${token}`},signal:AbortSignal.timeout(15000)}));
  if(!result.id || !result.username) throw Error('Invalid profile response');
  return result;
}
export function quotaAvailable(value: unknown): boolean {
  if(!value || typeof value!=='object' || !('data' in value) || !Array.isArray(value.data)) return false;
  const data=value.data[0];
  return typeof data?.quota_usage==='number' && Number.isFinite(data.quota_usage) && data.quota_usage>=0 &&
    typeof data?.config?.quota_total==='number' && Number.isFinite(data.config.quota_total) && data.config.quota_total>data.quota_usage;
}
export async function hasQuota(token: string): Promise<boolean> {
  const value=await parse<unknown>(await fetch(`${API}/me/threads_publishing_limit?fields=quota_usage,config`,{headers:{Authorization:`Bearer ${token}`},signal:AbortSignal.timeout(15000)}));
  return quotaAvailable(value);
}
export async function publish(token: string, text: string): Promise<string> {
  const value=await parse<{id:string}>(await fetch(`${API}/me/threads`,{
    method:'POST',headers:{Authorization:`Bearer ${token}`},
    body:new URLSearchParams({media_type:'TEXT',text,auto_publish_text:'true'}),signal:AbortSignal.timeout(20000)
  }));
  if(!value.id) throw Error('Uncertain publish result');
  return value.id;
}
