# Official API evidence and open questions

Checked 2026-10-29. This is an implementation evidence log, not a certification of platform approval.

| Capability | Primary reference | Implementation |
| --- | --- | --- |
| Confidential code exchange, exact redirect URI, Threads-specific app credentials | [Meta Threads API Postman collection](https://www.postman.com/meta/threads/documentation/dht3nzz/threads-api) and [Meta sample source](https://github.com/fbsamples/threads_api/blob/main/src/index.js) | POST form to `https://graph.threads.com/oauth/access_token` |
| Authorization host and HTTPS callback | [Meta sample](https://github.com/fbsamples/threads_api) | `https://www.threads.com/oauth/authorize`; no localhost live callback |
| Long-lived token exchange | [Meta collection](https://www.postman.com/meta/threads/documentation/dht3nzz/threads-api) | `th_exchange_token`; expiry from returned `expires_in` |
| Text auto-publish | [Meta collection](https://www.postman.com/meta/threads/documentation/dht3nzz/threads-api) | `/me/threads`, `media_type=TEXT`, `auto_publish_text=true` |
| Dynamic quota | [Meta sample](https://github.com/fbsamples/threads_api/blob/main/src/index.js) | `/me/threads_publishing_limit?fields=quota_usage,config`; missing/invalid quota blocks posting |
| Cloudflare static delivery | [Pages Direct Upload](https://developers.cloudflare.com/pages/get-started/direct-upload/) | Disconnected, public static preview |
| Worker storage and scheduling | [D1 prepared statements](https://developers.cloudflare.com/d1/worker-api/prepared-statements/), [Cron triggers](https://developers.cloudflare.com/workers/configuration/cron-triggers/) | Parameterized SQL, conditional claims, bounded scheduling |

Minimal scopes are `threads_basic` and `threads_content_publish`. Do not copy the sample's optional scopes. The 500-code-point budget is conservatively enforced including disclosure and source URL; confirm current platform character accounting before launch.

Meta developer pages returned rate limits/access errors during research. The exact public App Review and advanced access requirements, any business verification requirement, applicable automated/repetitive political posting and anti-spam rules, PKCE support, provider revocation API, and provider-required data deletion/deauthorization flow are **not freshly certified**. They are launch gates. A recommendation-policy change is not permission to automate publishing, and a numerical quota is not a spam exemption.

OAuth state is mandatory even if sample code omits it. No `code_challenge` is invented without verified provider support. The token exchange's documented long-token GET includes `client_secret` in the query, so request query strings must be redacted in every log/trace sink before enabling OAuth. Never log provider error bodies.
