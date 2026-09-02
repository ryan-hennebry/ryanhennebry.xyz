# Handoff: ryanhennebry.xyz

## Built

The finished static identity page is live at `https://ryanhennebry.xyz/`. The visible body and
stylesheet remain unchanged: final copy, 550px measure, one 15px type size, the locked spacing
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
database `ryanhennebry-visits` inside `ctx.waitUntil`, so no latency is added and no external
network call is made. The row holds timestamp, path, status, ASN, AS organisation, country, city,
region, timezone, colo, referer, user agent, accept-language, HTTP protocol, TLS version, TCP
round-trip time, a classification of `human`, `bot_ua`, `datacenter` or `asset`, and a visitor hash
that is SHA-256 of the IP, the user agent and the current `YYYY-MM`. No raw IP address is stored,
and the monthly salt makes hashes unjoinable across months. `schema.sql` holds the schema and
`queries.sql` the reads.

Google Search Console has the verified domain property `ryanhennebry.xyz`. The verification TXT
record is public in Cloudflare DNS and must remain in place. The sitemap has been submitted. URL
Inspection reports that the homepage is indexed, available to Google and served over HTTPS. A new
indexing request for the updated homepage was accepted into Google's priority crawl queue.

## Test

Run `./verify.sh`. It checks pure ASCII, the locked visible page, metadata, crawler files, identity
asset formats, dimensions and exact hashes, canonical URLs, accessibility structure, typography,
spacing, motion and public destinations. It does not check `src/index.js`, the D1 schema or the
visit log; those are verified by reading them and by querying the database.

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
