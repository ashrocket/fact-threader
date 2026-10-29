# Fact records

The launch target is **100 distinct, sourced, human-reviewed posts**. An empty or incomplete library is allowed in the disconnected preview. Never invent records to reach the target.

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
    "evidence": "A short exact evidence span supporting the bounded claim."
  }],
  "postText": "The exact post, including its primary-source URL and date. https://www.gao.gov/example-report",
  "review": null
}
```

Categories: plain descriptive strings. Classifications: `official_finding`, `reported_data`, `allegation`. Status: `needs_review`, `reviewed`, `withdrawn`.

Only a maintainer may change status to `reviewed`, after reading the primary source and verifying every material claim. Add `review: { "reviewedBy": "github-handle", "reviewedAt": "YYYY-MM-DD", "sourceChecked": true }`. Automated validation checks structure and length; it cannot verify truth or reviewer independence. Allegations must be explicitly described as allegations in both claim and post. Prefer official audits, court records, published agency data, and direct records. Distinguish historical findings from current conditions. Do not add private personal data, targeted appeals, inflammatory generalizations, or variants of one fact to inflate the count.

The service prepends `Scheduled post · `; the **complete result must fit within 500 Unicode code points**, including the source URL and disclosure. Each post must include at least one record source URL. Evidence excerpts should be short; use a precise locator for longer passages.

Approval stores exact post text and a hash of the entire fact record. A changed, withdrawn, or newly added record never silently enters an existing user's queue. A changed record stops the queue until the person reviews a new selection.
