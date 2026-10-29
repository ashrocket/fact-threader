# Launch corpus provenance

The first 100 records were researched and checked against primary-source text on October 29, 2026. They cover enforcement (30), oversight/spending (35), and detention (35), drawing on **39 source URLs**. Multiple facts can describe different findings from one report. This is not a representative statistical sample or 100 independent reports.

`selection.jsonl` preserves the supplied, source-checked records without rewriting their dates, post text, context, or access/review metadata. Its SHA-256 is `b983a069563989b776604dedc82659e9cf272c6c225cdd45f2f28ec26777a2bd`. The source archive's SHA-256 was `412f7e1c5fce488868e7f69254cccd820bb8794575a7260cf175dcdac96d19c3` (46,736 bytes). The import script checks the selected data's hash.

## What was checked

Research agents separately checked whether each historical claim was supported by the opened primary evidence. Sources included GAO summaries and recommendation-status pages, DHS OIG reports on official government mirrors, and official catalog descriptions/bulletins. Search snippets alone were not accepted. Superseded, blocked research leads are not part of this selection.

The 35 detention drafts include 30 full-report-backed findings and **five official-summary-backed findings** (`ice-det-001` through `ice-det-005`). Those five retain their consulted summary URLs and month-precision publication dates. No record implies that a summary was a full-report review. All evidence passages in this import are paraphrases and are labelled as summaries, not quotations.

The records preserve potential-citizenship uncertainty; mixed ICE/CBP attribution; facility-specific scope; possible versus proven overpayments; and the distinction between missing documentation and missing care. The provided posts already include the significant corrective context identified during the factual audit, including later tracking fixes, recommendation acceptance, facility remedies, and the end of the Irwin contract. Additional context stays visible alongside the post.

## What has not been approved

Source support is **not maintainer editorial approval or an account owner's publication consent**. Every imported record has `status: needs_review`, `review: null`, a separate `researchReview` record, and the original `publication_status: not_authorized` in `selection.jsonl`. No human GitHub reviewer has been invented. Real OAuth and publishing stay disabled.

The findings are historical. The source dates and known subsequent actions matter; do not imply every defect continues today. Recheck current source/recommendation status during editorial approval. The five summary-backed detention entries should receive full-report review where available.

## Reproducing the import

`node --experimental-strip-types scripts/import-corpus.ts` rebuilds the initial draft library from the pinned selection. Do not run it over later maintainer edits: it intentionally restores the original draft states. Normal contributions edit `content/facts.json` using the PR workflow. The original selection remains a provenance record.
