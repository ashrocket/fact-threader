import type { Fact } from '../src/facts.ts';
// Synthetic records are test-only. They are never loaded into the public corpus.
export function fixture(index=1):Fact {
  return {id:`ice-${String(index).padStart(4,'0')}`,claim:`Synthetic test fixture ${index}; not a real claim.`,asOf:'2026-01-01',category:'Test only',classification:'official_finding',status:'reviewed',sources:[{url:`https://example.org/test/${index}`,title:'Synthetic test document',publisher:'Test fixture',publishedAt:'2026-01-01',retrievedAt:'2026-01-02',locator:'Test page 1',evidence:'Synthetic test evidence.',evidenceKind:'summary'}],postText:`Test fixture ${index}, dated 2026-01-01. https://example.org/test/${index}`,review:{reviewedBy:'test-only',reviewedAt:'2026-01-03',sourceChecked:true}};
}
