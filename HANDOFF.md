# Handoff: ryanhennebry.xyz

## Cross-repo status (4 Oct 2026)

A pointer, not a plan change: product decisions stay gated until Ryan approves the grill summary.

- Parent grill handoff: `../docs/plans/active/itl-grill-handoff.md`. Ledger:
  `../docs/plans/active/itl-grill-2026-09-28-progress.md`. Both live in the private parent
  workspace at `~/Projects/in-the-loop/`.
- `../PRODUCT-DIRECTION.md` is unchanged and remains the authority until the grill write-back.
- Closed in code: the `visitor_hash` privacy item (quick tab Q-1, C15-1). Ryan approved it on
  4 Oct 2026 as one reviewed change: a random daily salt, no fingerprint fields, 90-day retention
  and a short notice. It is live only once Ryan runs `./deploy.sh`. Merging does not deploy.
  `migrations/2026-10-04-clear-old-identifiers.sql` is optional and unrun; it clears the old month-salted
  hashes now instead of letting them age out over 90 days.

## Built

The finished static identity page is live at `https://ryanhennebry.xyz/`. Since 2026-09-24
(`b73fa14`) Startup Skills is the first project link and link names no longer wrap; that commit's
deployment is not recorded here. Otherwise the visible body and stylesheet remain as approved: final copy, 550px measure, one 15px type size, the locked spacing
system, and no content imagery or client-side runtime dependency. The Worker described below sits
in front of it and does not alter a byte of it.

The browser title, Open Graph title and Twitter title are `Ryan Hennebry`. The page, Open Graph and
Twitter descriptions are all explicitly empty so sharing clients have no fallback description. No
preview image is declared or deployed. Twitter uses its compact summary card. The 48px browser
favicon, ICO and 180px Apple touch icon are fully opaque solid fields of the approved LinkedIn
banner colour, `#24303C`, with no text or mark. `robots.txt`, `sitemap.xml`, canonical metadata and
the WebSite and Person JSON-LD graph use the live apex origin.

Cloudflare version `ca1f7099-f461-4217-8e60-f942b201b034`, deployed 2026-08-27, serves the site.
Version `c91ef044-f896-41f5-9b2d-39da0a1730e2` was the last assets-only deployment before it. The
account-level Bulk Redirect rule `Redirect www to apex` sends `www` to the apex with HTTP 301 while
preserving paths and query strings. The `workers.dev` and preview surfaces are disabled.

`src/index.js` is a Worker entrypoint that runs first on every request. It serves the page through
the ASSETS binding and returns that response untouched, then logs one row per request to the D1
database `ryanhennebry-visits` inside `ctx.waitUntil`, so no latency is added. Since 2026-09-02 (`6e9cc0c`) genuine visits are
also enriched (reverse DNS, IPLocate) and emailed to Ryan through Email Routing, so the Worker
does make external calls off the response path. The row holds timestamp, path, status, ASN, AS organisation, country, city,
region, timezone, colo, referer, user agent, a classification of `human`, `scanner`, `bot_ua`,
`datacenter` or `asset`, and a visitor hash. From the v3 deploy the hash is HMAC-SHA256 of a
version tag, address scope, normalised IPv4 address or IPv6 /64 and user agent, under a random salt
made each UTC day and kept only in KV (`salt:v3:YYYY-MM-DD`, 48-hour TTL). It links visits within
one UTC day; with no salt it is NULL. Accept-language, HTTP protocol, TLS version and TCP
round-trip time are no longer written. A daily cron at 03:17 UTC deletes rows older than 90 days
from `visits`, `enrichment`, `alerts_sent` and `alert_log`; on the live data the first rows go
around 25 Nov 2026. No table has an IP address column, but for a visit that clears
`isGenuineVisit` the reverse DNS name is stored in `enrichment.ptr` and printed in the alert email,
and that name often embeds the address (`host86-181-229-144.range86-181.btcentralplus.com`). Alert
emails stay in Ryan's inbox outside the 90-day purge. Rows written before the deploy keep the
public month-salted hash (`hash_scope` NULL or without the `v3:` prefix) until the purge or the
optional migration removes it. `privacy.html` states all of this, with the purpose, the lawful basis
(legitimate interests), the right to object and the right to complain to the ICO. `privacy.html`
exists but is deliberately unlinked from `index.html`; Ryan chose this on 4 Oct 2026 after being
told it probably does not meet UK GDPR Art 13's 'easy to access' requirement. `deploy.sh` still
ships it, so it is served at `/privacy.html`; it is not in `sitemap.xml`. `schema.sql` holds the
schema and `queries.sql` the reads.

Google Search Console has the verified domain property `ryanhennebry.xyz`. The verification TXT
record is public in Cloudflare DNS and must remain in place. The sitemap has been submitted. URL
Inspection reports that the homepage is indexed, available to Google and served over HTTPS. A new
indexing request for the updated homepage was accepted into Google's priority crawl queue.

## Test

Run `./verify.sh`. It checks pure ASCII, the locked visible page and the privacy notice, metadata,
crawler files, identity asset formats, dimensions and exact hashes, canonical URLs, accessibility
structure, typography, spacing, motion and public destinations, then runs the Worker tests with
`node --test test/*.test.mjs` (Node 24, `node:sqlite`). A missing `index.html` fails. It does not
query the live visit log. `deploy.sh` runs it first, so a failing Worker test blocks a deploy.

On 2026-08-26:

- `./verify.sh`, `git diff --check`, JSON-LD parsing and sitemap XML parsing passed.
- The W3C HTML validator returned zero messages for the live page.
- The live HTML matched the local file byte-for-byte, and the old share-card URL returned HTTP 404.
- Meta, WhatsApp and normal-browser user agents all received only the title, three empty
  descriptions and the compact summary-card declaration. None received an Open Graph or Twitter
  image field or the retired description copy.
- The live sitemap returned HTTP 200 as `application/xml` to both a normal client and Googlebot.
- Google's live URL test reported the sitemap URL as available to Google and indexable.
- The `www` path-and-query probe returned HTTP 301 to the equivalent apex URL.
- Public DNS returned the Search Console verification TXT record.
- A fresh-context reviewer confirmed the visible `<body>` and `assets/site.css` are byte-identical
  to the approved page before this metadata update, and the deployment package contains nine files.

## Next

Search Console still displays `Couldn't fetch` for the submitted sitemap even though the same
Google account's live URL test says the sitemap is available and indexable, and the endpoint passes
all local and public checks. Recheck the Sitemaps report after Google has processed the new property.
Do not resubmit repeatedly; the homepage indexing request is already accepted.

WhatsApp may continue showing its previously cached preview for the exact apex URL until Meta
refreshes that cache. Meta's Sharing Debugger requires a Facebook login to force a fresh scrape. The
live crawler response is already corrected; do not reintroduce metadata to work around the cache.
