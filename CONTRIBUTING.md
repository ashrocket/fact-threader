# Contributing facts

The first release targets 100 well-supported facts. Count does not substitute for evidence.

1. Fork the repository and add a distinct record to `content/facts.json` using [the schema](content/SCHEMA.md).
2. Cite a primary source: an audit, court record, original agency data, or another direct record. Include publication and retrieval dates, a short exact evidence span, and a precise page/section locator. Explain historical scope and limitations. Do not silently turn an allegation into an established finding.
3. Write one bounded claim and a readable proposed post with its date/attribution and source URL. The application adds `Scheduled post · `; the total must be at most 500 Unicode code points. Avoid unsupported causation, broad claims about every facility or staff member, dehumanizing language, and personal data.
4. Set `status` to `needs_review` and `review` to `null`. Do not self-certify a submission as reviewed.
5. Run `npm ci && npm run check`. Open a pull request using the fact review checklist.

A maintainer must read the source and verify the exact claim, date, denominator, comparison, context and proposed wording. Review should be independent of the contributor where practicable. The reviewer records their public GitHub handle/date and `sourceChecked: true` only after verification. Automated checks do not approve truth. Source/code changes are never automatically merged or published.

Approved records are offered for a person's new batch. Existing users' approved snapshots never gain records from a pull request. An edited or withdrawn record makes affected queues stop for renewed review.

## Corrections

Open a correction issue referencing the ID and evidence. Maintainers should mark potentially material errors `withdrawn` while investigating, preserve a public correction trail, and update the record only with support. Previously published posts cannot be silently replaced; the account owner chooses how to correct them.

## Code contributions

Keep the disconnected preview usable and real publishing disabled by default. Add meaningful tests for changes to OAuth, consent, tenant isolation, token storage, scheduling, quota, deletion, or fact validation. Do not add hidden telemetry, audience targeting, engagement automation, new permissions, secrets, or automatic deployment from untrusted pull requests. Keep scopes minimal and follow the security notes in the README.
