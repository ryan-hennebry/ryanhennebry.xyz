# ryanhennebry.xyz

The identity page. One static document under Ryan's own name, and the only surface that is about the
person rather than the work. Parent workspace rules live in `../AGENTS.md`. This file wins on
conflict with it.

## What this repo is

A single hand-written HTML page, one stylesheet, one self-hosted font. No build step, no framework,
no JavaScript beyond a JSON-LD `Person` block, no network requests, and it renders correctly from
`file://`. It exists so that a founder who has just been sent an unsolicited report by Ryan, or a
hiring manager already mid-process, can confirm who he is in ten seconds. Nobody arrives cold from
search. It is not a funnel and it carries no call to action beyond its links.

## What is here now

The finished static page: `index.html`, `assets/site.css` and one self-hosted Inter font. Read
`HANDOFF.md` before changing them.

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
| Structure | `h1`, role line, two narrative paragraphs, then Previously, Projects and Links. Heading outline `H1 > H2 > H2 > H2` at every width |
| Projects | Competitor Intel, Growth Experiments and Career Matching, each linked to a public repository. Nothing unlinked, greyed or marked as coming |

## Never

- No imagery in any form: no photograph, avatar, logo, illustration, icon or decorative SVG. This is
  Ryan's own instruction, not an inference from the style. Never resolve the missing share card by
  quietly adding an image; raise it with him.
- No location anywhere, including inside the JSON-LD.
- No claim of clients, customers, users, readers, adoption, outcomes or prices.
- No rewriting the copy, the role line or the order of the Projects or Links without Ryan. Those get
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
Cloudflare, and the static page is deployed as the `ryanhennebry-xyz` Worker on both the apex and
`www`. Static hosting, no server, no build. The canonical, `og:url` and JSON-LD `url` values use the
live apex origin.
