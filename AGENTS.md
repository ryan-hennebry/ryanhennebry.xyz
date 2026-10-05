# ryanhennebry.xyz

The identity page. One static document under Ryan's own name, and the only surface that is about the
person rather than the work. Parent workspace rules live in `../AGENTS.md`. This file wins on
conflict with it.

**Shared direction:** before changing the project list, cross-product positioning or any link that
defines Ryan's relationship to In The Loop, read `../PRODUCT-DIRECTION.md`. It owns the relationship
between the independent products and the `/grill-me` gate for major cross-repository changes; this
repository owns the identity page and its release gates.

## What this repo is

A single hand-written HTML page, one stylesheet, one self-hosted font. No build step, no framework,
no JavaScript beyond a JSON-LD `Person` block, no network requests, and it renders correctly from
`file://`. Those rules describe the page and they still hold; the Worker that now sits in front of
it is covered under What runs server-side. It exists so that a founder who has just been sent an
unsolicited report by Ryan, or a hiring manager already mid-process, can confirm who he is in ten
seconds. Nobody arrives cold from search. It is not a funnel and it carries no call to action
beyond its links.

## What is here now

The finished static page, crawler files and technical identity assets: `index.html`,
`privacy.html`, `assets/site.css`, one self-hosted Inter font, `robots.txt`, `sitemap.xml` and the
favicons. Read `HANDOFF.md` before changing them.

The server side is `src/index.js`, the Worker entrypoint, with `schema.sql` and `queries.sql` for
the visit log and `migrations/` for one-off data changes that nothing runs automatically.
`wrangler.jsonc` carries the `main` entrypoint, the ASSETS, DB and VISIT_ENRICH bindings and the
daily cron trigger. `test/` holds the Worker tests, run by `verify.sh`.

## What runs server-side

`src/index.js` runs first on every request. It hands the request to the static asset binding and
returns that response untouched, so it cannot change what a visitor sees. The log write happens
after the response is on its way, inside `ctx.waitUntil`, so the work is off the response path. Since 2 September 2026, qualifying visits also trigger
reverse DNS, IPLocate enrichment and email through Email Routing; those server-side calls are
separate from the unchanged static page. Read `HANDOFF.md` for their current state and approval gates.

One row per request is written to the D1 database `ryanhennebry-visits`, bound as `env.DB` and
running in WEUR: timestamp, path, status, ASN, AS organisation, country, city, region, timezone,
colo, referer, user agent, a classification of `human`, `scanner`, `bot_ua`, `datacenter` or
`asset`, and a visitor hash. Accept-language, HTTP protocol, TLS version and TCP round-trip time
are no longer written. The hash is HMAC-SHA256, under a random 32-byte salt made each UTC day, of
a version tag, address scope, normalised IPv4 address or IPv6 /64 and user agent. The salt lives
only in the `VISIT_ENRICH` KV namespace under `salt:v3:YYYY-MM-DD` and expires after 48 hours, so
a hash links visits within one UTC day and nobody can recompute it afterwards. With no salt the
hash is NULL; there is no fallback. `hash_scope` carries the version (`v3:ipv4`, `v3:ipv6-64`,
`v3:raw`) and identifies comparable rows. No table has an IP address column, but for a visit that
clears `isGenuineVisit` the reverse DNS name is stored in `enrichment.ptr` and printed in the alert
email, and that name often embeds the address (`host86-181-229-144.range86-181.btcentralplus.com`).
Alert emails stay in Ryan's inbox outside the 90-day purge. A daily cron
deletes rows older than 90 days from all four tables. Ryan approved this design on 4 October 2026
(C15-1, quick Q-1). The schema is `schema.sql` and the reads are `queries.sql`.

The Worker does not alter the visible page. The page carries no client JavaScript beyond the
JSON-LD block, makes no network requests and still renders from `file://`. `verify.sh` runs the
Worker tests in `test/`; it does not query the live visit log.

## The page as specified

Every value below was measured, argued and settled. Treat them as fixed, not as starting points.

| Layer | Locked |
|---|---|
| Body copy | Two narrative sentences, each set as two lines at the full measure |
| Measure | 550px, frozen for the final copy |
| Type | Inter, self-hosted variable latin subset. One size, 15px, for every element. Two weights, 400 and 500, with 500 used once on the `h1` |
| Colour | No hue anywhere. Two text tiers, ink and muted. Link signal lives entirely in the underline |
| Spacing | Seven distances, driven by tokens. The 117px void above the name and the 48px bottom padding are deliberately unequal |
| Motion | Zero. There is correctly no `prefers-reduced-motion` block, and adding one transition turns that omission into a defect |
| Structure | `h1`, two narrative paragraphs, then Previously, Projects and Links. Heading outline `H1 > H2 > H2 > H2` at every width |
| Links | Email, GitHub, LinkedIn. `privacy.html` exists but is deliberately unlinked from `index.html`; Ryan chose this on 4 Oct 2026 after being told it probably does not meet UK GDPR Art 13's 'easy to access' requirement. Do not re-link it without Ryan; `verify.sh` fails if `index.html` links it |
| Projects | Startup Skills, linked to startupskills.dev, then Competitor Intel, Growth Experiments and Career Matching, each linked to a public repository. Nothing unlinked, greyed or marked as coming |

## Never

- Keep the visible page free of imagery: no photograph, avatar, logo, illustration, icon or
  decorative SVG. The favicon is the only image asset. It uses the approved `#24303C` as a solid
  field with no text or mark. Link previews carry only `Ryan Hennebry`, with no description or
  preview image.
- No location anywhere, including inside the JSON-LD.
- No claim of clients, customers, users, readers, adoption, outcomes or prices.
- No rewriting the copy, adding a role line under the name, or changing the order of the Projects or Links without Ryan. Those get
  their own session with him.
- No second type size, no italic, no availability badge, no two-column layout for Projects or Links.
  Each was proposed, measured and rejected.

## How to work on it

- One writer owns `index.html` and `assets/site.css` per round. Whoever changed it does not certify
  it, and review runs in a fresh context.
- Measure, do not assert. Quote the probe behind every number, and re-derive any figure that a copy
  edit or a token change could have invalidated.
- Say what not to do alongside what to do. Naming the rejected options is what stopped them coming
  back.

## Read when relevant

- `../AGENTS.md` and the rest of the system, including the studio page that links here.
- `../shared/design-engineering-taste.md` for the craft bar, `../shared/voice-and-tone.md` for house
  style, `../shared/agent-memory/` for the measurement and verification rulings this page produced.
- `~/Projects/in-the-loop-archive/docs/plans/workspace/personal-site-minimal-2-build-handoff.md` is
  the as-built specification and the record of what is already settled. Read it before changing a
  line. The archive is harvest-only: read it, copy out of it, never edit it.

## Domain and deploy

`ryanhennebry.xyz` is registered at Namecheap and expires 2027-04-22. DNS is delegated to
Cloudflare, and the page is deployed as the `ryanhennebry-xyz` Worker at the apex. A Cloudflare
Bulk Redirect sends `www` permanently to the apex while preserving paths and query strings. Static
assets and no build step, but no longer no server: the Worker runs on every request and writes the
visit log. The canonical, `og:url` and JSON-LD `url` values use the live apex origin.
