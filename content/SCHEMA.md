# Fact records

The library starts with **100 source-checked drafts**. Live launch requires at least 100 distinct posts with maintainer review. Research support, maintainer review and each user's permission to publish are separate steps. Never invent records to reach a target.

`facts.json` is an array of records:

```json
{
  "id": "ice-0001",
  "claim": "A narrowly bounded factual claim, with date and attribution.",
  "asOf": "2026-10-29",
  "category": "Oversight",
  "classification": "official_finding",
  "status": "needs_review",
  "sources": [{
    "url": "https://www.gao.gov/example-report",
    "title": "Full primary-source report title",
    "publisher": "U.S. Government Accountability Office",
    "publishedAt": "2025-01-01",
    "retrievedAt": "2026-10-29",
    "locator": "Page 4, paragraph 2",
    "evidence": "A short paraphrase of the passage supporting this claim.",
    "evidenceKind": "summary"
  }],
  "postText": "The exact post, including its primary-source URL and date. https://www.gao.gov/example-report",
  "review": null
}
```

IDs: `ice-0001` or a category prefix such as `ice-det-001`; keep IDs stable across corrections. Categories are plain descriptive strings. Classifications: `official_finding`, `official_recommendation`, `reported_data`, `allegation`. Status: `needs_review`, `reviewed`, `withdrawn`.

Use `evidenceKind: "summary"` for a paraphrase or `"quote"` for exact source language. Never put a paraphrase in quotation marks. The locator must point to the supporting passage. `publishedAt` accepts `YYYY-MM-DD` or `YYYY-MM` when only the month is known; do not invent a day. Retrieval, review and `asOf` dates require a full date. `asOf` records when this entry was checked, not the date the historical event occurred.

Optional fields preserve useful context: `shortTitle`, `temporalScope`, and `contextNote` on the fact; `sourceAccess`, `documentType`, `supportingUrls` (HTTPS), and `reportNumber` on a source. Record whether evidence came from a full report or an official summary. Keep known later fixes and limitations in `contextNote`, and include material corrective context in the post itself.

The initial import also has `researchReview: { "status": "supported", "reviewedAt": "YYYY-MM-DD", "scope": "What the source check covered", "note": "Limitations or corrections", "publicationStatus": "not_authorized" }`. This records research provenance. It never substitutes for the maintainer `review` or a user's approval. The original [selection and method notes](research/README.md) remain separate from later editorial changes.

Only a maintainer may change status to `reviewed`, after reading the primary source and verifying every material claim. Add `review: { "reviewedBy": "github-handle", "reviewedAt": "YYYY-MM-DD", "sourceChecked": true }`. Automated validation checks structure and length; it cannot verify truth or reviewer independence. Allegations must be explicitly described as allegations in both claim and post. Prefer official audits, court records, published agency data, and direct records. Distinguish historical findings from current conditions. Do not add private personal data, targeted appeals, inflammatory generalizations, or variants of one fact to inflate the count.

The service prepends `Scheduled post · `; the **complete result must fit within 500 Unicode code points**, including the source URL and disclosure. Each post must include at least one record source URL and enough date/attribution context to stand on its own. Evidence excerpts should be short; use a precise locator for longer passages.

Approval stores exact post text and a hash of the entire fact record. A changed, withdrawn, or newly added record never silently enters an existing user's queue. A changed record stops the queue until the person reviews a new selection.
