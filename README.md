# Fact Threader

A Threads publisher for sourced criticism of U.S. Immigration and Customs Enforcement (ICE). People choose the exact posts and a schedule, then approve that batch. The library starts with **100 source-checked drafts from 39 primary-source URLs**. Additions come through pull requests.

**Current state: disconnected preview.** All 100 drafts are available to read with their evidence, dates and later corrective actions. They still need maintainer editorial review. Source checks do not grant publication consent. Real OAuth and publishing are disabled; the schedule demo uses clearly labelled sample text. See [the corpus review notes](content/research/README.md) for the five detention entries backed by official summaries and the limits of the research.

[Open the public preview](https://fact-threader.pages.dev) · [Source and contributions](https://github.com/ashrocket/fact-threader)

## Try it locally

Node 22.18+ is required.

```sh
npm ci
npm run types
npm run check
npm run db:local
npm run dev
```

Open the local URL shown by Wrangler. The demo works without credentials. For a static preview only, run `npm run build` and serve `public/` with any static HTTP server.

## How it works

- **Review:** each record contains a dated claim, primary source, labelled evidence summary or quotation and locator, publication/retrieval dates, claim classification, review state, and exact post text. Automated validation checks structure, duplication and length; maintainers verify truth and context. Month-only source dates stay month-only.
- **Approve:** choose 1–100 reviewed posts and a 1, 6, 12 or 24-hour interval. One hour is explicit opt-in. Every post includes `Scheduled post · ` and a source URL. Approval pins the exact text, record hashes, order, and cadence.
- **Publish:** a Worker checks the service stop switch, consent, current source review, token expiry, and the quota returned by the official Threads API. It sends at most one due post per account per scheduler pass. The first post is one full interval after approval; missed runs do not create catch-up bursts. The queue ends when exhausted.
- **Control:** pause stops future work. Disconnect deletes the active account, tokens, sessions, approvals, jobs and activity records. A request already in flight can still finish. Provider revocation is a separate step in Threads settings until a supported revocation endpoint is verified.

No global blast button, unsolicited replies, automated engagement, follower scraping, targeted political appeals, account farming, recycled filler, or automatic news generation. New or changed facts do not silently enter existing queues.

## Project layout

| Path | Purpose |
| --- | --- |
| `public/` | Accessible static site and synthetic queue demo |
| `content/facts.json` | Source-controlled fact library |
| `content/SCHEMA.md` | Submission record format |
| `content/research/` | Original source-checked selection and research limitations |
| `src/` | Cloudflare Worker, OAuth, consent, scheduler and encryption |
| `migrations/` | D1 schema, default emergency stop enabled |
| `tests/` | Security, consent, quota, content and scheduler checks |
| `docs/LAUNCH.md` | Exact live launch gates and operational steps |
| `docs/API-EVIDENCE.md` | Official integration references and unresolved rules |

## Deployment

The disconnected site can be deployed using existing Cloudflare Pages access:

```sh
npm run check
npm run scan:secrets
npm run deploy:preview
```

These commands update the existing `fact-threader` Pages project. For a fork, create a separate project and change the deployment target first. The Pages preview is public and contains no secrets, account backend or publishing credentials. It uses manual Direct Upload; GitHub PRs do not automatically deploy code or facts. The live Worker and D1 database require additional account permissions and the steps in [the launch guide](docs/LAUNCH.md). Do not deploy the placeholder D1 ID to production.

## Contributing and corrections

See [CONTRIBUTING.md](CONTRIBUTING.md). Add facts as `needs_review`. A maintainer reads the primary evidence, checks the text and dates, and records review. CI never upgrades review status. A reviewed fact still requires each person's separate approval before publishing.

For corrections, use the GitHub correction issue template with the fact ID and supporting source. Withdraw disputed records promptly while reviewing. Withdrawal blocks affected queues; already-published posts require a separate correction decision by the account owner.

## Security and limitations

Tokens use AES-256-GCM with fresh nonces and account ID as authenticated additional data. Browser sessions are opaque, hashed in D1, and sent in Secure/HttpOnly/SameSite cookies. Writes enforce same-origin and CSRF tokens; OAuth state is random, browser-bound, expiring and single-use. Only `threads_basic` and `threads_content_publish` are requested. PKCE support has not been verified for this provider flow; this implementation is a confidential server client using the documented code exchange plus state.

The scheduler uses a unique account/approval/position key, an atomic claim and a durable `sending` state. A write with uncertain outcome pauses the account; it is **never automatically repeated**. Quota/preflight failures use bounded exponential backoff. This trades automatic recovery for duplicate avoidance; exactly-once delivery across an external API cannot be promised.

Capacity is intentionally bounded to 10 due accounts per tick. Before live launch, load-test the planned scale and choose an appropriate cron interval and queue architecture. No paid plan or usage increase is authorized by this repository. Long-lived tokens are exchanged on connection; automatic refresh is not yet implemented. Expired tokens stop the queue and require reconnection and new approval.

Do not claim the app has completed Meta review or that quota alone authorizes mass repetitive posting. Required advanced access, business verification, anti-spam rules, revocation and deletion callbacks still need direct verification. See [API evidence](docs/API-EVIDENCE.md) and [privacy/deletion](public/privacy.html).

MIT licensed. Independent of Meta and government agencies.
