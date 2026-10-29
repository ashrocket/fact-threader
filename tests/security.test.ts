import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fixture } from './fixtures.ts';
import { validateFacts, factVersion, renderedPost } from '../src/facts.ts';
import { seal, unseal, randomToken, sessionCookie } from '../src/security.ts';
import { entriesStillValid, retryDelay } from '../src/scheduler.ts';
import { quotaAvailable, authorizationUrl, SCOPES } from '../src/threads.ts';
test('tokens encrypt with fresh nonces and are bound to one account',async()=>{
  const key=btoa(String.fromCharCode(...crypto.getRandomValues(new Uint8Array(32))));
  const a=await seal('synthetic-token',key,'account-a'),b=await seal('synthetic-token',key,'account-a');
  assert.notEqual(a,b);assert.ok(!a.includes('synthetic-token'));assert.equal(await unseal(a,key,'account-a'),'synthetic-token');
  await assert.rejects(()=>unseal(a,key,'account-b'));await assert.rejects(()=>unseal(a.slice(0,-4)+'AAAA',key,'account-a'));
});
test('session cookies are secure and random bearer tokens are 256 bits',()=>{const cookie=sessionCookie(randomToken());assert.match(cookie,/^__Host-ft-session=[a-f0-9]{64};/);for(const flag of ['Secure','HttpOnly','SameSite=Lax','Path=/'])assert.ok(cookie.includes(flag));});
test('minimal scope authorization retains exact redirect and random state',()=>{const url=new URL(authorizationUrl('test-id','https://test.example/oauth/callback','test-state'));assert.equal(url.origin,'https://www.threads.com');assert.deepEqual(SCOPES,['threads_basic','threads_content_publish']);assert.equal(url.searchParams.get('state'),'test-state');assert.equal(url.searchParams.get('redirect_uri'),'https://test.example/oauth/callback');});
test('validator rejects duplicates, unsupported states, overlong posts and unlabelled allegations',()=>{
  assert.deepEqual(validateFacts([fixture()]),[]);
  assert.ok(validateFacts([fixture(),fixture()]).some(e=>e.includes('duplicate')));
  const long=fixture();long.postText='😀'.repeat(500)+long.sources[0].url;assert.ok(validateFacts([long]).some(e=>e.includes('500')));
  const allegation=fixture();allegation.classification='allegation';assert.ok(validateFacts([allegation]).some(e=>e.includes('allegation')));
  const missing=fixture();missing.review=null;assert.ok(validateFacts([missing]).some(e=>e.includes('completed review')));
  const date=fixture();date.asOf='2026-02-30';assert.ok(validateFacts([date]).some(e=>e.includes('asOf')));
  const source=fixture();source.sources[0].url='http://example.org';assert.ok(validateFacts([source]).some(e=>e.includes('HTTPS')));
});
test('changed or withdrawn facts invalidate consent; unrelated additions do not expand it',async()=>{
  const original=fixture(),entries=[{factId:original.id,version:await factVersion(original),text:renderedPost(original)}];
  assert.equal(await entriesStillValid(entries,[original,fixture(2)]),true);assert.equal(entries.length,1);
  assert.equal(await entriesStillValid(entries,[{...original,postText:original.postText+' edited'}]),false);
  assert.equal(await entriesStillValid(entries,[{...original,status:'withdrawn'}]),false);
});
test('quota is dynamic and missing, invalid or exhausted quota fails closed',()=>{
  assert.equal(quotaAvailable({data:[{quota_usage:9,config:{quota_total:10}}]}),true);
  for(const value of [null,{}, {data:[]},{data:[{quota_usage:10,config:{quota_total:10}}]},{data:[{quota_usage:-1,config:{quota_total:10}}]},{data:[{quota_usage:1}]}])assert.equal(quotaAvailable(value),false);
});
test('preflight backoff grows and remains bounded',()=>{assert.equal(retryDelay(0),60000);assert.equal(retryDelay(2),240000);assert.equal(retryDelay(1000),3600000);});
