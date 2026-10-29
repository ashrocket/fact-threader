export function randomToken(): string { return Array.from(crypto.getRandomValues(new Uint8Array(32)), b => b.toString(16).padStart(2, '0')).join(''); }
const encoder = new TextEncoder();
function encode(data: Uint8Array): string { return btoa(String.fromCharCode(...data)); }
function decode(value: string): Uint8Array<ArrayBuffer> { return Uint8Array.from(atob(value), c => c.charCodeAt(0)); }
async function aesKey(secret: string): Promise<CryptoKey> {
  const raw = decode(secret);
  if (raw.length !== 32) throw new Error('Invalid encryption key');
  return crypto.subtle.importKey('raw', raw, 'AES-GCM', false, ['encrypt','decrypt']);
}
export async function seal(token: string, secret: string, owner: string): Promise<string> {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ciphertext = await crypto.subtle.encrypt({ name:'AES-GCM', iv, additionalData: encoder.encode(owner) }, await aesKey(secret), encoder.encode(token));
  return `v1.${encode(iv)}.${encode(new Uint8Array(ciphertext))}`;
}
export async function unseal(value: string, secret: string, owner: string): Promise<string> {
  const [version, iv, ciphertext] = value.split('.');
  if (version !== 'v1' || !iv || !ciphertext) throw Error('Invalid ciphertext');
  const plaintext = await crypto.subtle.decrypt({ name:'AES-GCM', iv:decode(iv), additionalData:encoder.encode(owner) }, await aesKey(secret), decode(ciphertext));
  return new TextDecoder().decode(plaintext);
}
export function cookies(request: Request): Record<string,string> {
  return Object.fromEntries((request.headers.get('Cookie') ?? '').split(';').map(v => v.trim().split('=')).filter(p=>p.length===2));
}
export function sessionCookie(value: string, maxAge = 604800): string { return `__Host-ft-session=${value}; Path=/; Secure; HttpOnly; SameSite=Lax; Max-Age=${maxAge}`; }
export function oauthCookie(value: string, maxAge = 600): string { return `__Host-ft-oauth=${value}; Path=/; Secure; HttpOnly; SameSite=Lax; Max-Age=${maxAge}`; }
export function securityHeaders(response: Response, api = false): Response {
  const result = new Response(response.body, response);
  result.headers.set('X-Content-Type-Options','nosniff');
  result.headers.set('Referrer-Policy','no-referrer');
  result.headers.set('X-Frame-Options','DENY');
  result.headers.set('Permissions-Policy','camera=(), microphone=(), geolocation=()');
  result.headers.set('Content-Security-Policy',"default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; connect-src 'self'; frame-ancestors 'none'; base-uri 'none'; form-action 'self'");
  result.headers.set('Strict-Transport-Security','max-age=31536000');
  if (api) result.headers.set('Cache-Control','no-store');
  return result;
}
