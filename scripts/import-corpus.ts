// One-time, reproducible import of the independently source-checked launch drafts.
// It does not create editorial approval or user consent.
import { readFile, writeFile } from 'node:fs/promises';
import { digest, validateFacts } from '../src/facts.ts';
import type { Fact } from '../src/facts.ts';
type RecordInput = {
  id: string; claim: string; post_text: string; source_url: string; title: string;
  published_at: string; retrieved_at: string; evidence_summary: string; temporal_scope: string;
  review_status: string; publication_status: string; reviewed_at: string;
  context_note?: string; review_note?: string; review_scope?: string; review_source_location?: string;
  source_locator?: string; source_access?: string; evidence_document_type?: string; report_number?: string;
  supporting_url?: string; supplementary_source_url?: string; quoted_span?: string;
  claim_type?: string;
};
const raw=await readFile(new URL('../content/research/selection.jsonl',import.meta.url),'utf8');
if(await digest(raw)!=='b983a069563989b776604dedc82659e9cf272c6c225cdd45f2f28ec26777a2bd')throw Error('Unexpected source corpus checksum');
const records=raw.trim().split('\n').map(line=>JSON.parse(line) as RecordInput);
if(records.length!==100)throw Error('Expected exactly 100 launch records');
const facts:Fact[]=records.map(r=>{
  if(r.review_status!=='supported'||r.publication_status!=='not_authorized')throw Error(`Unexpected source status for ${r.id}`);
  const publisher=/DHS OIG|OIG-|govdelivery|oversight\.gov|govinfo\.gov/.test(r.post_text+' '+r.title+' '+r.source_url)?'Department of Homeland Security Office of Inspector General':'U.S. Government Accountability Office';
  return {
    id:r.id,
    shortTitle:r.claim,
    claim:r.post_text.replace(r.source_url,'').trim(),
    asOf:r.retrieved_at,
    category:r.id.startsWith('ice-enf-')?'Enforcement':r.id.startsWith('ice-det-')?'Detention':'Oversight and spending',
    classification:r.claim_type==='inspector_general_recommendation'?'official_recommendation':'official_finding',status:'needs_review',
    temporalScope:r.temporal_scope,contextNote:r.context_note??'',
    sources:[{
      url:r.source_url,title:r.title,publisher,publishedAt:r.published_at,retrievedAt:r.retrieved_at,
      locator:r.source_locator??r.review_source_location??'',
      evidence:r.quoted_span?.trim()||r.evidence_summary,
      evidenceKind:r.quoted_span?.trim()?'quote':'summary',
      sourceAccess:r.source_access,
      documentType:r.evidence_document_type,
      supportingUrls:[...new Set([r.supporting_url,r.supplementary_source_url].filter((u):u is string=>!!u&&u!==r.source_url))],
      reportNumber:r.report_number
    }],
    postText:r.post_text,review:null,
    researchReview:{status:'supported',reviewedAt:r.reviewed_at,scope:r.review_scope??'Historical claim checked against primary-source text. Maintainer review and user approval are separate.',note:r.review_note??'',publicationStatus:'not_authorized'}
  };
});
const errors=validateFacts(facts);if(errors.length)throw Error(errors.join('\n'));
await writeFile(new URL('../content/facts.json',import.meta.url),JSON.stringify(facts,null,2)+'\n');
console.log(`Imported ${facts.length} source-checked drafts from ${new Set(facts.map(f=>f.sources[0].url)).size} primary-source URLs. Maintainer review and publishing remain unapproved.`);
