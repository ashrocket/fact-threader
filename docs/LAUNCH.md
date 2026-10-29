# Live launch gates

The published preview must remain disconnected until every item is complete. Owner authorization is needed for new permissions, credentials, provider grants, paid changes, or live publishing.

1. Finish and independently review at least 100 distinct sourced fact records. Set `CORPUS_APPROVED=true` only after a real maintainer review. Do not change status merely to satisfy a counter.
2. Verify the current Meta rules and required public app review/advanced access for `threads_basic` and `threads_content_publish`, any required business verification, automated/repetitive posting rules, and a tested deletion/deauthorization path. Record the outcome. Only then set `APP_REVIEW_APPROVED=true` and `PLATFORM_POLICY_APPROVED=true`.
3. Establish a private support/deletion channel and name the operator, retention terms, Cloudflare backup window, and provider-required callbacks in the privacy notice. Current placeholder policy explicitly blocks live launch until these are ready.
4. With explicit authorization, create or select the personal Meta Threads app and a new dedicated Cloudflare D1 database. The existing account's Pages permission does not grant Worker/D1 deployment. Do not change unrelated Workers, domains, applications, or accounts.
5. Copy `wrangler.jsonc` to ignored `wrangler.live.jsonc`, enter the verified D1 ID and public HTTPS `APP_ORIGIN`, and apply migrations to that new database. Register **exactly** `<APP_ORIGIN>/oauth/callback` in Meta. Confirm all log and trace destinations redact query strings, including redirects and outgoing token requests. Confirm no provider headers/bodies are captured.
6. Generate a fresh 32-byte encryption key through an approved local secret workflow. Set `TOKEN_ENCRYPTION_KEY` as base64, `THREADS_APP_SECRET` through Wrangler's protected secret input, and the non-secret `THREADS_APP_ID` in config. Never put values in chat, command arguments, screenshots, Git, or CI output. Do not reuse private app code or credentials.
7. Run tests, local runtime smoke checks, secret scanning and `wrangler deploy --dry-run --config wrangler.live.jsonc`. Test a consenting developer account end-to-end in the provider's permitted test mode, including deny/replay, token expiry, pause/delete, quota and uncertain outcomes. Do not enable public OAuth based only on mocked tests.
8. Enable `OAUTH_ENABLED=true` only after the connection gates are satisfied. Keep `PUBLISHING_ENABLED=false` and the database emergency stop set to `1` until live publishing has been explicitly authorized and operational review is complete.
9. After approval, set `PUBLISHING_ENABLED=true`, choose a supported cron interval (for example `*/5 * * * *` for a small tested deployment), and change the single `controls.emergency_stop` row to `0`. Users must still approve their own finite batch and cadence. No post is sent merely by connecting.

All configuration flags default to false, the migration defaults the stop switch to 1, and the repository has **no live cron trigger**. These are independent gates.

## Emergency stop

For the confirmed live database, set `controls.emergency_stop=1`. Scheduler checks it before work and before each external write. Disable `PUBLISHING_ENABLED` and the cron as an additional stop. Requests already sent to Meta can still finish. There is no public admin mutation endpoint.

## Unknown outcomes

An interrupted/failed publishing call is stored as `uncertain` and pauses its account. Reconcile against the provider/account evidence before making any manual database correction. Never automatically resend an uncertain job. The application has no force-retry button. A safe preflight failure before the external write uses bounded exponential backoff, up to five attempts, then needs attention.

## Maintenance

No catch-up bursts: after a completed post the next due time is at least the chosen interval later. Cron delivery is best effort, so exact minute-level delivery is not promised. A finite batch is capped at 100; each scheduled pass handles at most 10 accounts. Capacity beyond this requires explicit load testing and architecture review. Expired tokens stop the account; no token refresh daemon exists yet.

Delete stale rate-limit, session and OAuth state records during scheduled maintenance even when publishing is disabled. Review infrastructure backup retention and account-deletion recovery policy before opening connections. Periodically re-check sources and platform terms; source withdrawals stop impacted batches.
