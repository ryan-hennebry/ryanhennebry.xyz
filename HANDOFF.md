# Handoff: ryanhennebry.xyz

## Status (4 Oct 2026)

4 Oct 2026: cross-repo planning closed. The `visitor_hash` privacy fix is deployed and its
migration has run.

- The fix, approved on 4 Oct 2026, uses a random daily salt, no fingerprint fields, 90-day
  retention and a short notice. `deploy.sh`, using wrangler 4.125.0, deployed it on 4 Oct 2026 at
  19:31:50Z as Worker version `4ea93d17-cba1-4a3a-8779-9d4650a21bbf` and registered the cron
  `17 3 * * *`. The live homepage was confirmed byte-identical, and `/privacy.html` returns a 307
  to `/privacy`, which returns 200. The first v3 row was written at 19:32:14Z; no old-style hashed
  row was written after it.
- `migrations/2026-10-04-clear-old-identifiers.sql` ran against production D1 at 19:38:01Z with
  Ryan's approval. It cleared 48,425 old visitor hashes and the fingerprint fields on 48,425 rows,
  cleared 391 `alert_log` hashes and deleted 337 pre-cutover `alerts_sent` rows. `visits` still
  holds 48,432 rows. The old `hash_scope` labels are deliberately left in place.
- A D1 Time Travel restore point was taken immediately before the migration: bookmark
  `00000a0d-00000000-000050fa-ccffac10c2ec074a78cba01e46e1b090`, usable until about 3 Nov 2026.
  Restore with `npx --yes wrangler@4.125.0 d1 time-travel restore ryanhennebry-visits
  --bookmark=00000a0d-00000000-000050fa-ccffac10c2ec074a78cba01e46e1b090`. It rolls back all D1
  writes after that point, not just the migration, including every visit logged since.
- The first purge deletions are due around 25 Nov 2026.
- A further redeploy follows for the `privacy.html` wording ("a later day", not "a later visit").
  Its version is not recorded here; `npx --yes wrangler@4.125.0 deployments list` shows the latest.
- Open for Ryan: coarsening the reverse DNS name kept in `enrichment.ptr` and printed in the alert
  email; whether to drop or coarsen `ua`; the title of `queries.sql` query 2, which says "this
  calendar month" although a v3 hash links visits only within one UTC day; and the BT reverse DNS
  name used as a fixture in `test/enrichment.test.mjs`, which embeds an address.

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

Cloudflare version `4ea93d17-cba1-4a3a-8779-9d4650a21bbf`, deployed 2026-10-04, or a later one
serves the site; `npx --yes wrangler@4.125.0 deployments list` shows the latest. Version
`ca1f7099-f461-4217-8e60-f942b201b034`, deployed 2026-08-27, is the earlier one this file recorded.
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
emails stay in Ryan's inbox outside the 90-day purge. Rows written before the deploy keep their
old `hash_scope` label (NULL or without the `v3:` prefix), but the migration cleared their
month-salted hashes and fingerprint fields on 4 Oct 2026. `privacy.html` states the retention,
hashing, enrichment and email terms, with the purpose, the lawful basis (legitimate interests), the
right to object and the right to complain to the ICO. Its daily-key claim holds for every stored
row, because `migrations/2026-10-04-clear-old-identifiers.sql` has run. `privacy.html`
exists but is deliberately unlinked from `index.html`; Ryan chose this on 4 Oct 2026 after being
told it probably does not meet UK GDPR Art 13's 'easy to access' requirement. `deploy.sh` still
ships it: `/privacy.html` returns a 307 to `/privacy`, which returns 200. It is not in
`sitemap.xml`. `schema.sql` holds the
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
