# Product

<!-- impeccable:product-schema 1 -->

This document says what the page is for and what it may claim. It does not hold a single rendered value. Sizes, weights, colours, the measure and every spacing figure belong to `DESIGN.md`, which governs the visual system; numbers restated here only drift out of sync with it.

## Platform

web

## Stack

The page is plain static HTML and CSS. No JavaScript, no framework, no package manager, no preprocessor, no build step. No network requests at runtime, and one self-hosted typeface under an open font licence. Which face, and how it is set, is `DESIGN.md`'s to state. Serving it is a Cloudflare Worker, `src/index.js`, which returns the static response untouched and writes a visit log to D1 afterwards. That code never reaches the browser.

## Users

Both readers arrive warm, already holding a reason to look. Nobody arrives cold from search.

- A founder who has just received an unsolicited, bespoke competitor-intelligence report from Ryan and wants to know who sent it before answering the offer of freelance work.
- A hiring manager already mid-process, arriving from an application, a LinkedIn search or a referral, looking for a coherent account of what Ryan did before and what he builds now.

## Product Purpose

A quiet background check, not a funnel. The page identifies Ryan, states what he is building now, records that he was Minima's first employee, names three projects with public repositories, and leaves ordinary contact links.

Success means either audience understands the through-line and continues the conversation that already brought them here. There is no second conversion path, because there is no second thing to convert to.

## Positioning

Ryan Hennebry is the sole public identity. The freelance practice is unbranded and stays unbranded until there are clients. In The Loop is the name of one project, an article feed he is building, not a studio identity. Nothing on the page trades under a company name.

## Operating Context

The page is deployed at `https://ryanhennebry.xyz/` as a Cloudflare Worker with static assets. The Worker runs first on every request, serves the assets unchanged, and logs one row per request to the D1 database `ryanhennebry-visits`. No raw IP address is stored.

The document itself must still work as a single static file opened from `file://`, with no server, no scripts, no client-side analytics and no external asset. Nothing the Worker does may change that. It must survive being read on a phone, at high browser zoom, and by a screen reader.

LinkedIn carries Ryan's role availability, which is why the page carries no availability line.

## Capabilities and Constraints

What the page may claim, and what it may not. How it looks is out of scope here.

- No claim of customers, clients, users, readers, adoption, outcomes or prices. Nothing currently supports one.
- No location anywhere, by Ryan's explicit choice, including in the structured data.
- The page makes one employment claim, that Ryan was Minima's first employee, and links Minima as the named organisation. Three linked public repositories are the work a reader can inspect.
- If `from seed to Series A`, or any equivalent stage claim, returns to the page, it must be accurate: a $2.5m seed and a contribution to a $6.5m Series A, with Ryan as Minima's first employee from 2019.
- Retired claims do not come back without fresh approval: the Minima team growing to 30, any duration beyond `over four years`, and the Competitor Intel review result.
- No imagery appears in the page content. The solid-colour favicon is the only image asset. Link previews carry only Ryan's name, with no description or preview image.
- Ryan is not described as a consultant, a design engineer or a full-stack software engineer.
- The two-word phrase pairing the acronym with `agents` never appears. The page says `agents` and `coding agents`.
- In The Loop is linked inline to its public studio site, but it is not listed among the three repository-backed projects.
- `View project` is barred while no project pages exist.
- Three projects currently appear: Competitor Intel, Growth Experiments and Career Matching. Each links to its public repository.
- No brief link, because no safe public artefact exists yet.
- The sole continuation is ordinary contact: email, GitHub or LinkedIn.
- Ryan owns the copy and edits it directly. Propose wording to him; do not rewrite it in place.
- Interface work stays inside this prototype directory. `INDEX.md` and `WORKLOG.md` are updated from the repo root, not as part of an interface edit.

## Brand Commitments

- British English, plain sentences, no inflated claims, no hype words, no emoji, no em dash character. Files stay pure ASCII.
- Craft is expressed through restraint rather than decoration, and above all through the absence of mistakes.
- Judgement is inferred from what is included and how clearly it is described, never asserted.

## Evidence on Hand

- Public GitHub repositories for Competitor Intel, Growth Experiments and Career Matching. They are the inspectable work the page points a reader at, and all three sit off-page.
- The parsed CV, which verifies the seed-to-Series-A claim: a $2.5m seed and a contribution to a $6.5m Series A, as Minima's first employee from 2019. Correction to the CV itself: Ryan joined before the seed round and before friends and family, so `from seed to Series A` understates when he arrived. Several agents have read that wording as evidence that the initial-idea stage predated him. The CV should be corrected.
- A measured audit of reference personal sites, which informs `DESIGN.md` rather than this document.
- The limits: no public Feed, no customer proof, no external-use evidence and no safe public brief URL.
- Since 2026-08-27 the server-side visit log in D1 records who reaches the page. It is the first evidence of real readers, and it is raw request data, not a claim.

## Product Principles

1. Put the accountable person in front.
2. Let selected work carry the argument; do not narrate it.
3. Keep unfinished work truthfully bounded rather than dressed up.
4. Preserve the visitor's originating context instead of starting a new funnel.
5. Every visible element answers a factual question a founder or hiring manager actually has. If it answers none, delete it.
6. Prefer removing an element over styling it.

## Accessibility & Inclusion

- The page must be fully usable by keyboard, screen reader and voice control, and readable at high zoom, in print and in forced-colours mode.
- Nothing is conveyed by colour or by hover alone, and no focus indicator is ever removed.
- Zero motion of any kind, so there is nothing for a reduced-motion preference to reduce.
- The contrast ratios, text tiers and breakpoints that deliver all of this are recorded in `DESIGN.md`.
