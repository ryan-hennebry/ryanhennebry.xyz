---
name: Ryan Hennebry
description: A single-document personal index set at one size in Inter, with no hue anywhere, where hierarchy comes from colour, position and one long silence rather than from scale.
colors:
  paper: "#ffffff"
  ink: "#16181A"
  muted: "#5F656B"
  rule: "#777777"
  rule-strong: "#646464"
  selection: "#E6E6E6"
  print-paper: "#FFFFFF"
  print-ink: "#000000"
  print-muted: "#4A4A4A"
typography:
  strong:
    fontFamily: "Inter, ui-sans-serif, system-ui, -apple-system, Segoe UI, sans-serif"
    fontSize: "15px"
    fontWeight: 500
    lineHeight: 1.5
  body:
    fontFamily: "Inter, ui-sans-serif, system-ui, -apple-system, Segoe UI, sans-serif"
    fontSize: "15px"
    fontWeight: 400
    lineHeight: 1.5
rounded:
  focus: "2px"
spacing:
  space-tight: "4px"
  space-para: "12px"
  space-group: "24px"
  space-bottom: "48px"
  space-void: "117px"
  space-void-narrow: "56px"
  gutter: "24px"
  measure: "550px"
components:
  page:
    backgroundColor: "{colors.paper}"
    textColor: "{colors.ink}"
    typography: "{typography.body}"
    padding: "117px 24px 48px"
    width: "598px"
  page-title:
    textColor: "{colors.ink}"
    typography: "{typography.strong}"
  role-line:
    textColor: "{colors.muted}"
    typography: "{typography.body}"
  section-label:
    textColor: "{colors.muted}"
    typography: "{typography.body}"
  list-line:
    textColor: "{colors.ink}"
    typography: "{typography.body}"
  link:
    textColor: "inherit"
    typography: "{typography.body}"
  link-focus:
    textColor: "inherit"
    typography: "{typography.body}"
    rounded: "{rounded.focus}"
---

# Design System: Ryan Hennebry

## Overview

**Creative North Star: "The Index Card"**

This is a page with the density and manners of a well-set index card: one surface, one column, a name at the top, a role, two narrative sentences and three labelled groups. Nothing overlaps, nothing floats, nothing is layered on top of anything else. Craft is expressed as the absence of mistakes rather than the presence of decoration, so every element that survived on the page is one that answers a factual question a reader actually has.

The defining fact of the system is that it has no size hierarchy. Every piece of text on the page is 15px. The name, the role line, the section labels, the project names and the links are all set at the same size in the same face. What separates them is colour, position and, in exactly one place, weight.

The second defining fact is that there is no hue. The page is pure white paper, a near-black and a grey that share one faint cool bias, and two neutral greys for the link underline and the focus ring. Nothing on the page is saturated. The signal palette is therefore narrower than it was, and colour is now carrying a distinction that weight used to help with: the section labels differ from the text beneath them by colour alone.

The third defining fact is the shape of the vertical space. The page opens with a long silence, 117px above the name at desktop, and then everything else arrives as one dense block with 4px, 12px and 24px steps inside it. Void, then dense. Set at 15px on a 22.5px line box, the result reads closer to a well-made interface than to an essay.

The world it belongs to is the minimal personal-site canon (Benji, Emil, ibelick, Josh, Matt, Jakub), applied at full fidelity rather than copied cosmetically. ibelick's 600px column was the reference measure; Ryan selected 550px for this final copy after comparing 600px, 550px and 525px. The bare comma-separated links retain ibelick's treatment rather than a row grid. The two inner spacing steps come from the same neighbourhood by a different route: they follow published skills on ui-skills.com, the registry of agent skills ibelick curates. The void above the name is borrowed from nobody. It is argued from this page's own conditions in The Void Above The Name Rule, and the fact that it lands on the same number as Emil's (emilkowal.ski) rendered top is a coincidence rather than a source.

One honest caveat about what is absent. The visible page ships no imagery, hairline rules, cards, shadows or motion, but the canon itself uses several of those natively, and the practitioners named above include people whose public work is largely about motion. Their absence here is a decision about this page, taken because a static single-document background check has nothing that needs to move or be boxed. The off-page favicon uses the approved LinkedIn banner colour without introducing a mark or changing the page palette.

**Key Characteristics:**
- One type size, 15px, across every element on the page
- Two weights, 400 and 500, a 100-unit step, and 500 is used exactly once, on the name
- Two text tiers: ink for narrative, muted for annotation
- Zero hue: no accent family, no saturated value anywhere
- Hierarchy carried by colour, position and one long silence, never by scale
- One surface, no depth of any kind
- Zero motion, zero JavaScript, zero third-party runtime requests; works fully from `file://`

## Colors

An almost-neutral field. The near-black and the grey share one faint cool bias; the underline greys are pure neutrals; there is no warmth and no saturation anywhere. The accent family that used to exist has been removed, and with it the page's only hue.

The page declares itself a single-theme document (`color-scheme: light`) and ships no dark palette. The one alternate palette that exists is for print, described at the end of this section.

Colour does more work in this system than in most, because size is off the table and weight is now spent almost entirely on the name. The section label and the list beneath it are typographically identical in every respect, and the only thing keeping `Projects` from reading as a project is that it is muted and the names are ink.

### Neutral
- **Pure White** (`{colors.paper}`): the page background, set on both `html` and `body` so overscroll never exposes a different colour. It is true white, not a pulled-back near-white.
- **Cool Near-Black** (`{colors.ink}`): all narrative text, meaning the name, the two intro sentences and the group contents (17.80:1).
- **Cool Muted Grey** (`{colors.muted}`): all annotation text, meaning the role line and all three section labels (5.90:1). This is the second and last text tier.
- **Neutral Grey Rule** (`{colors.rule}`): the resting link underline (4.48:1). Deliberately raised well past the 1.7 to 2.5:1 the reference sites use, because the underline is the sole non-colour identifier of a link and therefore has to clear the 3:1 non-text contrast floor on its own. It is a neutral matched in luminance to the accent it replaced, so removing the hue cost the link technique nothing.
- **Neutral Grey Rule, Strong** (`{colors.rule-strong}`): the hover underline and the `:focus-visible` ring (5.92:1).
- **Pale Grey Wash** (`{colors.selection}`): the `::selection` background. It is neutral, so selecting text greys the page rather than tinting it in any hue, the browser's blue included.

`::selection` sets `background-color` and nothing else. It used to set `color: var(--ink)` as well, which was a defect: `color` also resets `text-decoration-color`, so selecting text pulled muted text up to ink and pulled the link underline from Neutral Grey Rule up to ink too. Selecting the page flattened both tiers into one and took the page's only hierarchy device with it. It was found by measuring selected pixels rather than by reading the rule. Selection now recolours the ground only, and the two tiers survive being selected. One honest limit: Chrome still recolours the link underline under selection even with no `color` declared, which is an engine behaviour rather than a missing declaration, so it cannot be fixed from the stylesheet.

### Print
A second complete tier, not a tint of the first. The stylesheet says why it exists: a background check may well be printed. `@media print` drops to true white paper, true black for the ink tier, a darker grey for the annotation tier (8.86:1 on white) and black underlines. Every tint disappears, and the focus ring is explicitly cleared with `outline: none` so a ring caught at print time cannot land on paper. Both tiers enumerate the same elements, so the ink and muted grouping survives on paper exactly as it does on screen.

Print also restores the one thing paper takes away. A printed link is otherwise an inert word, so `a[href^="http"]::after` prints the URL in brackets after the link text, at 400 weight so the address never outweighs the name in front of it. `mailto:` links are deliberately left alone: the visible text is already the address, and printing it twice would be noise.

### Named Rules

**The Two Tiers Rule.** Every piece of text on the page is either ink or muted. There is no third text colour, no lighter fourth tier for metadata, and no colour-coded categories. If a new element cannot decide which of the two tiers it belongs to, it does not belong on the page.

**The Muted Label Rule.** The section labels are muted and nothing else. They are the same face, the same 15px, the same 400 weight and the same line box as the paragraph directly beneath them, so colour is the entire mechanism separating a heading from its contents. This is the lightest possible way to mark a label and it is what keeps the page to two weights while spending one of them only on the name. Never set a section label in ink. Equally, do not reintroduce weight on it on screen: raising a label to 500 would put a second element on the page at the name's weight, and the name would stop being the only thing that carries it. The single exception is forced colours, where the muting does not survive and weight has to stand in for it; that case is described under Section Label and is scoped to that media query.

**The Underline Carries the Signal Rule.** Link text inherits the colour of its context and never changes. All link colour lives in the underline, which is neutral grey and must stay at or above 3:1 against paper because it is the sole non-colour identifier of a link. This is what lets a link sit inside a paragraph without punching a hole in it.

**The Page Has No Hue Rule.** There is no saturated value on this page. The only colours are white, a cool near-black, a cool grey and two neutral greys. A hue reintroduced anywhere, including in a link underline, a focus ring or a selection wash, is a change to the premise of the palette rather than an addition to it, and it would immediately make itself the loudest thing on a page that has nothing else loud.

### Technical Identity Asset

The favicon is an off-page derivative, not a new brand surface. It uses `#24303C`, the dominant RGB
value measured from Ryan's LinkedIn banner. It is a fully opaque solid field with no text or mark,
supplied at 48px for browsers and search and at 180px for Apple touch surfaces. Link previews use a
compact text card with only `Ryan Hennebry`, no description and no preview image.

## Typography

**Display Font:** none. There is no display role.
**Body Font:** Inter (variable, latin subset, self-hosted woff2 at 73,016 bytes, `font-weight: 100 900`, `font-display: swap`, SIL OFL 1.1) with `ui-sans-serif`, `system-ui`, `-apple-system`, `Segoe UI`, `sans-serif`
**Label/Mono Font:** none

**Character:** A neo-grotesque with closed apertures, even colour and a large x-height, set small and left at its own default fit. It is a face built for interfaces rather than for reading at length, and using it at a single size, with its own tracking untouched and an open line box, is what gives the page its even, unemphatic texture.

**Smoothing:** `html` sets `-webkit-font-smoothing: antialiased` and `-moz-osx-font-smoothing: grayscale`. Both are global, both apply to every glyph on the page, and both suppress the subpixel rendering that WebKit and Gecko would otherwise use on macOS. The effect is on apparent weight: grayscale antialiasing lays down less ink than subpixel antialiasing, so 400 and 500 both render fractionally lighter than they would unset. The shipped weights are 400 and 500 either way; what changes is how heavy they look.

### Hierarchy

There are exactly two typographic roles, and they differ only in weight.

- **Strong** (`{typography.strong}`): the `h1`, and nothing else. This is the only element on the page set at 500.
- **Body** (`{typography.body}`): everything else, meaning the role line, all three section labels, every paragraph and every link. 400 is Inter's default instance and it is stated explicitly everywhere it applies.

The weight step is 400 to 500, a 100-unit delta. It is wider than it was, and it is used in exactly one place, so weight is no longer a general-purpose hierarchy signal on this page. It marks the name and stops.

Both roles share a 15px size and a 1.5 line-height giving a 22.5px line box, and neither carries any letter-spacing: Inter's own fit stands unaltered everywhere on the page. The name is 1.00x the body size. Line-height is a token, `--leading`, set on `body` and inherited from there; the `h2` used to restate the same value and no longer does, so the token is declared once and read once. There is one line box on the page.

The 1.5 figure is sourced rather than tuned. Three independent audits arrived at it separately, citing `jakubkrehel/better-typography` ("Body copy 1.5 to 1.6") and `pbakaus/typeset` ("Tune line height inversely with measure: wider lines generally need more leading"). The previous 1.4286 sat below the published floor for body copy. Narrowing the measure to 550px does not create a second line-height role, so the existing 1.5 token remains unchanged.

Paragraphs carry `text-wrap: pretty`, which suppresses single-word final lines where the browser supports it. The `h1` has no `text-wrap` treatment; wrapping the name is left to the browser.

Measure: the column is 550px. At the full measure, both current narrative sentences set as two lines with `text-wrap: pretty`. Below a 598px viewport the fixed 24px gutters, not the maximum measure, determine the line length.

### Named Rules

**The One Size Rule.** 15px, everywhere, for everything. There is no display size, no heading size and no small print. Any new element is 15px. A second size is not an addition to this system, it is the abandonment of its central premise, and it would immediately make the colour and position signals redundant.

**The Explicit Weight Rule.** Every rule that sets type also sets `font-weight`, including the rules that set 400. Inter's default instance is 400, so an inherited weight now happens to land on a shipped value, which makes this rule easier to break without noticing than it was when inheritance produced a weight the page did not ship. Keep it anyway: the page has a two-value weight vocabulary and one deliberate use of the second value, and stating the weight at every site of type is what makes that auditable by reading the stylesheet rather than by rendering it.

**The Untracked Type Rule.** There is no `letter-spacing` declaration anywhere in the stylesheet, on `body` or on any element. Inter ships its own fit and at 15px it is already correct, so the page sets nothing. This replaces The Optical Tracking Rule, which is retired below. Do not add tracking to an element, and do not reinstate a global value either: if the setting looks wrong, the size, the weight or the line box is the thing in question.

**The Leading Is A Token Rule.** Line-height is `--leading`, one value for the whole page, declared on `body` and inherited everywhere else. The `h2` restated it once and no longer does. A second line box would be a second type role, which the page does not have, so a per-element `line-height` is the same category of change as a second size.

**The Unset Optical Size Rule.** Inter's `opsz` axis runs 14 to 32 and is deliberately never set. The browser resolves it from the rendered size, which is correct at every size the page uses. Pinning it would override that resolution for no gain.

**The Measure Is Frozen Rule.** The measure is 550px and the stylesheet marks it frozen for the final copy. Ryan selected it after comparing wider and narrower rendered variations. A Chromium probe under `file://`, run after `document.fonts.ready`, measured a 550px content box at 1440px and 768px viewports. Both narrative sentences occupied two 22.5px line boxes, with no horizontal overflow. The same probe measured the intended 24px, 12px and 4px spacing relationships exactly.

The earlier 600px measure came directly from ibelick.com and remains the reference that framed the comparison. The move to 550px is an explicit choice for this page's final copy, not a claim that ibelick uses 550px. Future copy changes must be re-measured, but the measure does not move again without Ryan reopening it.

**The Role Line Rule.** The role line is the only second-tier text above the fold and the only thing on the page that qualifies the name. Without it the name is the sole identity signal, and a reader arriving from an email has to read the narrative to find out what Ryan does. It is therefore load-bearing and not decoration. It is also strictly an annotation on the name: body size, body weight, muted tier, zero added margin, sitting one line box below the name. It must never become a tagline, a pitch, a subtitle at another size, or a second ink-coloured line, because any of those would make it compete with the name instead of qualifying it.

## Layout

One centred column, no internal grid anywhere. The container is capped at 598px, the 550px measure plus a 24px gutter on each side, and the reading measure is created by padding inward rather than by narrowing the box. That way the gutter is real whitespace that touches the viewport edge on small screens, and the text column stays exactly 550px on large ones.

Vertical space is the page's strongest gesture. Padding is 117px above the content against 48px below it at desktop, and the top value drops to 56px below 481px. This is not a centring error and not a ladder step: it is a deliberate silence that holds the name clear of the top edge and forces the rest of the page to read as a single dense object beneath it.

### The spacing shape

There is no proportional ladder. There are six distances plus a deliberate zero, each assigned to one relationship:

| Distance | Relationship |
| --- | --- |
| 0px | The name to the role line. Every margin is reset, so the role line sits exactly one line box below the name and the two read as one unit |
| 4px | A section label to its content |
| 12px | The first narrative sentence to the second. The role line is excluded |
| 24px | Block to block, meaning the role line to the first body paragraph, intro to Previously, Previously to Projects and Projects to Links |
| 48px | The page's bottom padding |
| 56px | Above the name, below 481px |
| 117px | Above the name, at desktop |

The shape of that table is the design. The gap above the name is roughly five times the gap between the blocks below it, and the gap from a label to its content is one third of the gap between paragraphs. Nothing in the dense block is far from anything else, which is what makes the silence above it read as intentional rather than as a broken margin.

The two inner steps follow the 4px scale used by published skills on ui-skills.com, the registry curated by Julien Thibeaut (ibelick). The `nolanperk/rad-spacing` skill treats 4px as an edge-case floor and 8px as the usual tight-grouping step. This label pair earns the floor: label and content share the same 15px size, 400 weight and 22.5px line box, so an 8px margin read looser than the visual relationship on Ryan's reference page. Ryan selected 4px after comparing the rendered pages. The paragraph step remains 12px. The `jakubkrehel/better-layout` skill requires the gap between groups to be at least twice the gap within one; 24px against 12px is exactly 2.0x, so the widest internal relationship still governs that test. Any new distance proposed for this page has to survive both checks.

### Responsive behaviour

There is one breakpoint boundary, at 480 and 481px, and it has exactly one consequence: the void above the name drops from 117px to 56px, which holds roughly the proportion the two values had before both were lowered. The gutter, the size, the weights, the line-height, the measure and every other distance are identical at 320px and at 1440px. The page reflows without horizontal overflow from 320px upward and at 200 per cent zoom.

Changing the measure to 550px changes nothing at narrow widths. Below the 598px container cap the column is padding-driven, so the text box is simply the viewport less the two 24px gutters: 342px at 390 and 272px at 320, exactly as before. The measure change is desktop-only.

### Named Rules

**The Padded Measure Rule.** The container is always wider than the text; the reading measure comes from `padding-inline`, never from a narrower content box. `max-width: calc(var(--measure) + 2 * var(--gutter))`.

**The Distance Is The Relationship Rule.** Every gap on the page is one of the distances in the table above, and which one is used is the only signal of how two elements relate. There are no rules, boxes, tints or badges doing that job. If two elements seem to need a new distance to look related, the hierarchy is wrong, not the spacing.

One correction is worth recording, because it is a trap that could easily be reintroduced. The step from the role line to the first body paragraph used to be governed by a plain `.intro p + p`, which handed it the paragraph step, because the role line is itself a `p`. The top of the page ran short by the difference; at today's values the same mistake would cost 12px. Two selectors now do the job: `.intro__role + p` takes the 24px block step, and `.intro p + p + p` takes the 12px paragraph step from the third `p` onward, so the role line is excluded from it. Any future rule that spaces the intro by element type alone will make the same mistake. The role line is an annotation on the name rather than a paragraph in the narrative, and it has to be addressed by its class.

One thing inside that table was decided rather than defaulted, and it should not be silently reopened. `--space-group` is a single token at 24px doing two jobs: the step from the role line to the first paragraph, and the step from block to block. Ryan considered splitting those relationships and chose to keep them identical. The page is meant to read as one dense object under one long silence, not as a graded outline. The stylesheet reuses `--space-group` on `.intro__role + p` and all three sections for that reason. Do not hardcode a separate number there, and do not split the token without reopening the decision explicitly.

**The Void Above The Name Rule.** The 117px above the name, and the 56px that replaces it below 481px, are the page's largest deliberate decisions and they are not padding to be evened up. The justification is the page's own rather than a borrowed number. This page has no scroll, no large type, no imagery, no colour and no dividers, so the void is the only generous gesture left available to it: it is the single place where this design can spend anything at all. 117px is high enough to read as chosen rather than as a browser's or a framework's default top margin, and it is still low enough to keep the whole page inside a 700px viewport without scrolling. That pair of constraints, generous enough to read as a decision and tight enough to keep the page whole on one screen, is what fixes the value.

Emil's (emilkowal.ski) rendered 117px is where the number was first noticed, and it is recorded here as a coincidence rather than as the reason, because it cannot bear the weight. His 117px is 64px of authored padding plus 53px of flow occupied by an invisible sticky banner: a designer chose 64 and the browser painted 117, so matching 117 to Emil is matching an accident rather than following a decision. ibelick's 248px was measured too and rejected as an outlier. The stylesheet comment on `--space-void` now makes the same argument in the same order: it justifies the value by this page's own conditions rather than by a borrowed number, demotes Emil to a coincidence in the same terms, records the ibelick 248px rejection, and points back at this rule. Comment and rule agree, and the value is unchanged either way.

The asymmetry against the 48px bottom padding is the point: the page opens with more silence than it closes with, so a short document reads as a considered object rather than as something floating in the middle of the window. Do not reduce the void to bring the content up, and do not raise the bottom padding to balance it.

**The Bare List Rule.** Projects and Links are each one paragraph of comma-separated links and nothing else. Previously is one plain sentence with Minima as the link. There are no dates, descriptions, repeated `View code` labels or per-item rows. The name of the destination is the link, so the accessible name of every link is already unique and no individual `aria-label` is needed. An item with no public destination is left out of Projects rather than listed unlinked.

Both lists stay in the single reading column. Projects and Links each contain three destinations, presented as one comma-separated line when the measure allows and allowed to wrap naturally at narrow widths. A two-column arrangement would break the page's linear reading order and turn two short groups into a grid without reducing effort. Do not add columns, per-item rows or artificial balancing space.

## Elevation & Depth

There is none, and this is the system's most load-bearing decision. The page has exactly one surface. No shadows, no gradients, no tonal layering, no translucency, no borders, no card backgrounds, no dividers. No `border` is drawn anywhere in the stylesheet; the only two properties carrying the word are `box-sizing: border-box` and the focus ring's `border-radius`.

Depth is entirely typographic and spatial, and with size removed and weight spent on the name it now rests on two things: the two colour tiers, and the spacing shape. What separates a section label from its content is that the label is muted and 4px above ink text. What separates the intro and each section is 24px. What separates the name from everything is 117px of nothing above it. A reader perceives the groups without a single pixel being drawn to divide them.

The one exception is transient and interactive: the `:focus-visible` outline, which is drawn 2px outside the link and is the only thing on the page that ever sits on a second plane.

### Named Rules

**The Single Plane Rule.** Nothing on this page is drawn on top of anything else. If a new element needs a shadow, a border or a background tint to be legible, the correct fix is a spacing change, a weight change or a tier change, not a surface.

## Shapes

There is no form language, because there are no forms. Nothing on the page is a box: no cards, no chips, no badges, no pills, no buttons, no fields, no containers with a visible edge. Every element is either text or the space between text.

Consequently the page defines exactly one radius: 2px, applied to the `:focus-visible` outline so the ring follows the shape of the text it wraps rather than reading as a hard rectangle. That is the only corner in the build.

### Named Rules

**The Only Corner Is The Focus Ring Rule.** `border-radius` exists in this system for one purpose. Any other use means a box has appeared, and the box is the thing to question.

## Components

There are five component roles, all rendered as text. This is the complete inventory; the Links group is the sole navigation landmark, and there is no button, input, card, chip, row or separate navigation control. None should be synthesised from these tokens without a real need first.

### Links

The only interactive element on the page.

- **Resting:** colour inherited from context; underline in Neutral Grey Rule at `0.08em` thickness, `0.15em` offset, with `text-decoration-skip-ink: auto` so descenders stay clean. The rule sets no `font-weight`: it sets no type at all, so weight comes from the paragraph and a link cannot shift it. The `font-weight: 400` it used to carry was restating the inherited value and was removed.
- **Hover:** underline shifts to Neutral Grey Rule, Strong and thickens to `0.11em`. The change is instant, there is no transition. The whole hover block is gated behind `@media (hover: hover) and (pointer: fine)`, so it never fires as a sticky state on touch.
- **Focus:** a 2px outline in Neutral Grey Rule, Strong at `outline-offset: 2px` with a 2px radius. It is offset from the text, causes no layout shift, and is never removed.
- **Forced colours:** a `@media (forced-colors: active)` block passes `LinkText` through to the resting underline and `Highlight` to the focus ring, so the link technique survives Windows high-contrast mode instead of vanishing. It also raises the `h2` to 500 for the reason given under Section Label. A separate `a:hover` rule in the same block was removed as dead: forced colours override the hover underline colour themselves, so the rule could not change anything.
- **Printed:** external links print their URL after the link text; `mailto:` links do not. See the Print subsection under Colors.
- **Label:** the visible text is the name of the destination in every case, so no link text repeats and no `aria-label` is required.
- **No information is ever conveyed by hover alone.** Every link is identifiable at rest, by its underline.

### Page Title

The `h1`, used once, holding the name and nothing else, carrying no margin below it. It is the only element on the page at 500 weight, and that, its ink colour, its position first in the document and the 117px of silence above it are what identify it. The rule sets size and weight only; the ink comes from `body` by inheritance, and the `color: var(--ink)` the `h1` used to restate was removed as redundant. There is no tagline, no subtitle and no availability badge attached to it; the role line beneath it is a separate element with its own rule.

### Role Line

A `p` directly under the `h1`: 15px, 400 weight, muted, no margin of its own, so it sits one line box below the name. It reads `Founding Operator`. It is the page's only second-tier text above the fold and the only element that says what Ryan does before the narrative starts. See The Role Line Rule for what it must not become.

### Section Label

An `h2` at 15px and 400 weight, in muted, with 4px beneath it. It is identical to the paragraph below it in face, size, weight and line box, so the muting is the entire mechanism, per The Muted Label Rule. The line box is inherited from `--leading` rather than restated on the `h2`, so there is nothing here that could drift out of step with body text. Three exist: `Previously`, `Projects` and `Links`.

In forced colours the muting is gone: `--muted` resolves to `CanvasText`, the same value as body text, so the label and the paragraph beneath it become identical and the entire mechanism disappears. The `@media (forced-colors: active)` block therefore raises the `h2` to 500, the page's strong weight, so heading rank is carried by weight in the one context where colour cannot carry it. This is the single sanctioned exception to The Muted Label Rule's ban on weighted labels, and it is scoped to forced colours: on screen the label stays at 400.

### List Line

A single ink paragraph, 4px below its label. Previously holds one sentence with one link. Projects and Links hold comma-separated links. None carries dates, descriptions or per-item structure, per The Bare List Rule.

## Retired Rules

Rules removed on 2026-08-21, recorded rather than deleted because why a rule died is as useful as why one survives. The pattern across all of them: everything that existed to organise per-project detail went when the detail went, while everything that governs the page's type premise survived untouched. The One Size Rule outlived the spacing ladder because the ladder was describing a structure the page no longer has, whereas the single size is describing the face itself.

- **The Accent Is Never Text Rule.** Retired with the teal family. The rule constrained where a hue could appear; there is now no hue to constrain. Replaced by The Page Has No Hue Rule, which is stricter: not "the accent is only ever an underline" but "there is no accent".
- **The Status Is Bound To The Name Rule.** Retired with the dated status lines. The distinction it protected, that a status says what stage the work is at while a missing link says there is nothing to open, is now carried by The Bare List Rule in a simpler form: an item with nothing to open is not listed.
- **The Row Adds No Wrapper Rule.** Retired with the project row grid. There is no row, no list item and no grid anywhere on the page, so there is no longer a wrapper to be tempted by.
- **The Page Sits High Rule.** Retired and superseded. It froze a 56px against 40px asymmetry. The asymmetry survived and grew, but the numbers and the reasoning are different enough that it is restated as The Void Above The Name Rule rather than carried forward.
- **The Optical Tracking Rule.** Retired with the `-0.0064em` letter-spacing it governed. There is now no `letter-spacing` declaration anywhere in the stylesheet, so there is nothing left for the rule to constrain. Three skills argued against it independently: `ibelick/baseline-ui` ("NEVER modify letter-spacing unless explicitly requested") and `emilkowalski/apple-design` ("small text wants slightly positive tracking; a fixed letter-spacing is wrong somewhere") both rejected the premise, and the second rejected the sign as well as the practice. The honest counterweight, recorded because it is real: `-0.0064em` was not invented, it is the value Inter's own dynamic-tracking curve gives at 15px, which is a genuine authority, just not one in the skills registry the rest of this document sources from. What decided it is that the page sets one size, so a single tracking value could only ever be a whole-page preference rather than the size-responsive correction the curve describes, and a preference is not worth overriding a well-fitted face for. Replaced by The Untracked Type Rule, which is stricter: not "tracking is declared once" but "tracking is not declared".
- **The five-step spacing ladder (8 / 16 / 24 / 40 / 56).** Retired. It was a proportional ladder for a page with nested groups inside repeating rows. With the rows gone the page has simple text groups and one annotation, and a ladder of five proportional steps was describing structure that no longer exists. The Distance Is The Relationship Rule survives with a new table, because the principle (the gap is the only grouping signal) never depended on the specific numbers.

## Do's and Don'ts

### Do:
- **Do** set every new element at 15px. The single size is the premise of the system, not a default to be relaxed.
- **Do** build hierarchy from the signals that remain: colour (ink against muted) and position. Weight is spent: 500 marks the name and nothing else.
- **Do** set `font-weight` explicitly on every rule that sets type, including the ones that set 400. The vocabulary is two values and it should be readable from the stylesheet.
- **Do** leave letter-spacing undeclared everywhere and let Inter's own fit stand.
- **Do** keep line-height as one token, `--leading`, set on `body` and inherited, rather than restated per element.
- **Do** leave Inter's `opsz` axis unset and let the browser resolve it from the rendered size.
- **Do** pick every gap from the distances in the Layout table, and let spacing alone carry the grouping.
- **Do** keep link text inheriting its context colour and put all link signal in the underline.
- **Do** keep any non-text identifier at or above 3:1 against paper. The resting underline sits at 4.48:1 for exactly this reason; a lighter, prettier value would fail.
- **Do** make the visible text of a link the name of its destination, so accessible names stay unique without an `aria-label`.
- **Do** add any new text element to the correct group in the `@media print` block at the same time you add it to the screen styles. This page gets printed, and a text colour that exists in only one of the two tiers is a defect.
- **Do** keep `:focus-visible` visible, offset, and free of layout shift on every interactive element.
- **Do** gate any hover affordance behind `(hover: hover) and (pointer: fine)`, and make sure the resting state alone is sufficient.
- **Do** delete a spacing token when nothing uses it. Every token in `:root` is used by at least one rule, and that should stay true.
- **Do** measure page height, fold position and characters per line fresh when they matter, rather than trusting a figure recorded here or in an older report.

### Don't:
- **Don't** add imagery to the visible page. The solid `#24303C` favicon is the complete exception: a technical identity asset, not a new mark.
- **Don't** introduce a second type size to solve a hierarchy problem. Use colour or position, which is what every existing distinction on the page does.
- **Don't** add a third weight, and do not spend the existing 500 on a second element. One element on the page is strong, and that is what makes it the name.
- **Don't** put weight back on the section labels on screen. They separate from their contents by colour alone, and reintroducing weight both breaks that mechanism and puts a rival at the name's weight. The `forced-colors: active` block is the one sanctioned exception, because colour is unavailable there; see Section Label.
- **Don't** set letter-spacing anywhere, on an individual element or globally, and don't set `opsz` on an individual element.
- **Don't** set `color` in `::selection`. It resets `text-decoration-color` with it and flattens both text tiers the moment anything is selected. Background only.
- **Don't** move the measure away from 550px without Ryan reopening the decision. The rendered 600px, 550px and 525px comparison is recorded in The Measure Is Frozen Rule.
- **Don't** reintroduce a hue. There is no accent family, and an underline, ring or wash in any saturated colour would be the loudest thing on the page.
- **Don't** add dates, status lines, descriptions or `View code` labels back to a list. The lists are bare names.
- **Don't** list a project that has nothing public to open, and do not give it a placeholder link, a greyed-out link or a "coming soon". Leave it off until it has a destination.
- **Don't** introduce a third text colour tier. Ink or muted; anything that fits neither should be cut.
- **Don't** even up the vertical padding. 117px top against 48px bottom is the page's strongest deliberate gesture.
- **Don't** reach for a border, divider, card, background tint or shadow to separate content on this page. It has one surface, and spacing has been proven sufficient for it. Elsewhere in the minimal personal-site canon these devices are normal; the rule is scoped to this artefact, not to the world.
- **Don't** add motion to this page. It ships with zero transitions, animations and transforms, which is why it correctly has no `prefers-reduced-motion` block. Adding a single transition makes that omission a defect and obliges the block. Again scoped: the canon this page belongs to uses motion freely.
- **Don't** add JavaScript. The only `<script>` is a JSON-LD `Person` block, and the page's guarantee is that it works as a single static document from `file://`.
- **Don't** add a `prefers-color-scheme: dark` palette without treating it as a redesign. The page declares `color-scheme: light` and its contrast ratios, including the underline's 3:1 floor, are all computed against paper.
- **Don't** keep the file anything other than pure ASCII. Typographic characters are written as HTML entities in the markup.

## Deferred Decisions

One item remains open. It is not a defect in the current artefact.

1. **Font preload.** A `<link rel="preload">` for the woff2 was tried and reverted. On `file://` the CORS-mode font fetch is blocked as `origin 'null'`, which produced console errors and a duplicate fetch. The page is now live over HTTPS, but the `file://` guarantee remains binding. Revisit only if a measured live performance trace shows a material gain and the implementation preserves clean local rendering.

One open copy question sits outside this document's scope but touches the layout: whether an availability line returns. It was removed deliberately along with the closing contact sentence. If it comes back it is a fourth block at 24px, in one of the two existing tiers, and not a badge.

## Measurements Deliberately Not Recorded

Document height, fold position and characters-per-line at a given viewport are not recorded in this document, and their absence is a decision rather than an omission.

Each of those figures is a function of the current wording. Across this build the page height and the fold moved on every copy edit, and chasing them is what drove the measure through several values before it was frozen. A design system records the rules that hold when the copy changes; a number that a comma can invalidate belongs in a verification report, not here.

Where a measurement genuinely is durable it is recorded and sourced from the stylesheet: the contrast ratios, the 22.5px line box, the 598px container, the 550px measure and every distance in the Layout table. Anything else about how tall the page happens to be today should be measured fresh when it matters and not carried forward. The current line breaks are recorded in The Measure Is Frozen Rule as the reason for Ryan's selection and must be re-measured if the copy changes.
