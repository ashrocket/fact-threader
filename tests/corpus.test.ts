import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { digest, factVersion, renderedPost, validateFacts } from '../src/facts.ts';
import { entriesStillValid } from '../src/scheduler.ts';
import { fixture } from './fixtures.ts';

test('original research selection preserves 100 distinct supported drafts and source access limits',async()=>{
  const raw=await readFile(new URL('../content/research/selection.jsonl',import.meta.url),'utf8');
  assert.equal(await digest(raw),'b983a069563989b776604dedc82659e9cf272c6c225cdd45f2f28ec26777a2bd');
  const records=raw.trim().split('\n').map(line=>JSON.parse(line));
  assert.equal(records.length,100);
  assert.equal(new Set(records.map(r=>r.id)).size,100);
  assert.equal(new Set(records.map(r=>r.post_text)).size,100);
  assert.equal(new Set(records.map(r=>r.source_url)).size,39);
  assert.deepEqual(records.filter(r=>r.source_access==='official_summary').map(r=>r.id),['ice-det-001','ice-det-002','ice-det-003','ice-det-004','ice-det-005']);
  for(const record of records){
    assert.equal(record.review_status,'supported');
    assert.equal(record.publication_status,'not_authorized');
    assert.ok(record.temporal_scope);
    assert.ok(record.source_locator||record.review_source_location);
    assert.ok(record.post_text.includes(record.source_url));
    assert.match(record.post_text.replace(record.source_url,''),/\b(?:FY)?(?:19|20)\d{2}\b/);
    assert.ok([...('Scheduled post · '+record.post_text)].length<=500);
  }
});

test('source dates keep their known precision and evidence must distinguish paraphrases from quotations',()=>{
  const fact=fixture();fact.sources[0].publishedAt='2025-09';
  assert.deepEqual(validateFacts([fact]),[]);
  for(const date of ['2025-00','2025-13','2025-02-30','2025']){
    fact.sources[0].publishedAt=date;
    assert.ok(validateFacts([fact]).some(e=>e.includes('publishedAt')));
  }
  const missingKind=structuredClone(fixture()) as unknown as {sources:Array<Record<string,unknown>>};
  delete missingKind.sources[0].evidenceKind;
  assert.ok(validateFacts([missingKind]).some(e=>e.includes('summary or quote')));
});

test('a source-supported PR draft remains ineligible without maintainer review',async()=>{
  const draft=fixture(101);draft.id='ice-new-101';draft.status='needs_review';draft.review=null;
  draft.researchReview={status:'supported',reviewedAt:'2026-01-03',scope:'Synthetic source-check fixture.',publicationStatus:'not_authorized'};
  assert.deepEqual(validateFacts([fixture(),draft]),[]);
  const entries=[{factId:draft.id,version:await factVersion(draft),text:renderedPost(draft)}];
  assert.equal(await entriesStillValid(entries,[draft]),false);
  draft.status='reviewed';
  assert.ok(validateFacts([draft]).some(e=>e.includes('completed review')));
  const invalidSource=structuredClone(draft);invalidSource.sources[0].retrievedAt='';
  assert.ok(validateFacts([invalidSource]).some(e=>e.includes('retrievedAt')));
});
