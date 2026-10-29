export const DISCLOSURE = 'Scheduled post · ';
export const TARGET_FACTS = 100;
export type Source = {
  url: string; title: string; publisher: string; publishedAt: string; retrievedAt: string;
  locator: string; evidence: string; evidenceKind: 'summary' | 'quote';
  sourceAccess?: string; documentType?: string; supportingUrls?: string[]; reportNumber?: string;
};
export type Fact = {
  id: string; claim: string; asOf: string; category: string;
  classification: 'official_finding' | 'official_recommendation' | 'reported_data' | 'allegation';
  status: 'needs_review' | 'reviewed' | 'withdrawn'; sources: Source[]; postText: string;
  review: null | { reviewedBy: string; reviewedAt: string; sourceChecked: true };
  shortTitle?: string; temporalScope?: string; contextNote?: string;
  researchReview?: {
    status: 'supported'; reviewedAt: string; scope: string; note?: string;
    publicationStatus: 'not_authorized';
  };
};
export function dateValid(value: unknown): value is string {
  return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value) &&
    !Number.isNaN(Date.parse(value)) && new Date(value).toISOString().slice(0, 10) === value;
}
export function publicationDateValid(value: unknown): value is string {
  return dateValid(value) || (typeof value === 'string' && /^\d{4}-(0[1-9]|1[0-2])$/.test(value));
}
export function validateFacts(input: unknown, today = new Date().toISOString().slice(0, 10)): string[] {
  if (!Array.isArray(input)) return ['Library must be an array'];
  const errors: string[] = [], ids = new Set<string>(), texts = new Set<string>(), claims = new Set<string>();
  input.forEach((record, index) => {
    const key = `record ${index + 1}`;
    if (!record || typeof record !== 'object') { errors.push(`${key}: expected object`); return; }
    const f = record as Fact;
    if (!/^ice-(?:[a-z]+-)?\d{3,}$/.test(f.id ?? '') || ids.has(f.id)) errors.push(`${key}: invalid or duplicate id`);
    ids.add(f.id);
    for (const field of ['claim', 'category', 'postText'] as const)
      if (typeof f[field] !== 'string' || !f[field].trim()) errors.push(`${key}: missing ${field}`);
    if (!dateValid(f.asOf) || f.asOf > today) errors.push(`${key}: invalid/future asOf date`);
    if (!['official_finding','official_recommendation','reported_data','allegation'].includes(f.classification)) errors.push(`${key}: invalid classification`);
    if (!['needs_review','reviewed','withdrawn'].includes(f.status)) errors.push(`${key}: invalid status`);
    if (typeof f.postText === 'string') {
      if ([...(DISCLOSURE + f.postText)].length > 500) errors.push(`${key}: complete post exceeds 500 code points`);
      if (texts.has(f.postText.trim())) errors.push(`${key}: duplicate post`);
      texts.add(f.postText.trim());
      if (f.classification === 'allegation' && (!/alleg(?:e|es|ed|ation|ations)/i.test(f.postText) || !/alleg(?:e|es|ed|ation|ations)/i.test(f.claim))) errors.push(`${key}: allegation must be labelled`);
    }
    if (typeof f.claim === 'string') {
      const normalized = f.claim.toLowerCase().replace(/\s+/g, ' ').trim();
      if (claims.has(normalized)) errors.push(`${key}: duplicate claim`);
      claims.add(normalized);
    }
    if (!Array.isArray(f.sources) || !f.sources.length) errors.push(`${key}: primary source required`);
    else {
      for (const s of f.sources) {
        if (!s || typeof s !== 'object') { errors.push(`${key}: invalid source`); continue; }
        try { const u = new URL(s.url); if (u.protocol !== 'https:' || u.username || u.password) throw Error(); }
        catch { errors.push(`${key}: source must be an HTTPS URL without credentials`); }
        for (const field of ['title','publisher','locator','evidence'] as const)
          if (typeof s[field] !== 'string' || !s[field].trim()) errors.push(`${key}: source missing ${field}`);
        if (!publicationDateValid(s.publishedAt) || s.publishedAt > today) errors.push(`${key}: invalid/future publishedAt`);
        if (!dateValid(s.retrievedAt) || s.retrievedAt > today) errors.push(`${key}: invalid/future retrievedAt`);
        if (!['summary','quote'].includes(s.evidenceKind)) errors.push(`${key}: evidence must be labelled summary or quote`);
        if (s.supportingUrls !== undefined) {
          if (!Array.isArray(s.supportingUrls)) errors.push(`${key}: supportingUrls must be an array`);
          else for (const link of s.supportingUrls) {
            try { const u=new URL(link); if(u.protocol!=='https:' || u.username || u.password) throw Error(); }
            catch { errors.push(`${key}: supporting source must be an HTTPS URL without credentials`); }
          }
        }
        if (s.publishedAt > s.retrievedAt) errors.push(`${key}: source published after retrieval`);
      }
      if (typeof f.postText === 'string' && !f.sources.some(s => s && f.postText.includes(s.url))) errors.push(`${key}: post needs a source URL`);
    }
    if (f.status === 'reviewed' && (!f.review || !f.review.reviewedBy?.trim() || f.review.sourceChecked !== true || !dateValid(f.review.reviewedAt) || f.review.reviewedAt > today)) errors.push(`${key}: reviewed fact requires a completed review`);
    if (f.researchReview && (f.researchReview.status !== 'supported' || !dateValid(f.researchReview.reviewedAt) || f.researchReview.reviewedAt > today || !f.researchReview.scope?.trim() || f.researchReview.publicationStatus !== 'not_authorized')) errors.push(`${key}: invalid research review`);
  });
  return errors;
}
export function renderedPost(fact: Fact): string { return DISCLOSURE + fact.postText; }
export async function digest(text: string): Promise<string> {
  return [...new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text)))].map(b=>b.toString(16).padStart(2,'0')).join('');
}
export async function factVersion(fact: Fact): Promise<string> { return digest(JSON.stringify(fact)); }
export async function libraryVersion(facts: Fact[]): Promise<string> { return digest(JSON.stringify(facts)); }
