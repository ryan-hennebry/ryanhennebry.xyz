# Handoff: ryanhennebry.xyz

## Built

The page, promoted in from the archive prototype at commit `633b95b` and byte-identical to it:
`index.html`, `assets/site.css`, the Inter variable font and its licence, `COPY.md`, `DESIGN.md`,
`PRODUCT.md`, six verification screenshots and `.impeccable/design.json`, the design tool's state
for this build. 2,628 bytes of HTML, 10,071 bytes of CSS, a 73,016-byte font.

Not yet deployed. The domain is registered and still points at a stale Bear blog that has to be
replaced, not left up.

Rejected type variants and four unused fonts stayed behind in
`~/Projects/in-the-loop-archive/site/_prototypes/personal-site-minimal-v2-2026-08-20/explorations/`.
The craft rulings behind the build are in `../shared/agent-memory/`.

## Test

Run `./verify.sh`. Today it checks house style on the Markdown files and then reports that the site
has not been promoted in yet. Once `index.html` and `assets/site.css` exist it also asserts the
locked invariants: no imagery, no script other than the JSON-LD block, the 600px measure, and pure
ASCII in the shipped files.

Beyond that: open `index.html` from `file://` and confirm it renders complete with no network
requests. Check the three body sentences each set as one line at 600px, and zero orphans at 1440,
768, 390 and 320. `../shared/agent-memory/builder/verification-browser-measurement.md` has the exact
method, including the contamination check on the debug port. Read it before producing any number.

## Next

1. Promote the prototype directory into this repo as the root of the site. Read the as-built
   handoff in the archive first; it is written for a session with no context.
2. Add the Projects section naming Startup Skills, the Feed and In The Loop as three separate links.
   Ordering and copy are Ryan's call in his own session. Do not write them unilaterally.
3. Add deploy config and replace the Bear blog on the live domain.
4. Land the items that were deferred until there is an origin: `canonical`, `og:url`, the JSON-LD
   `url`, font preload and a favicon.
5. Raise the share card with Ryan explicitly. It is deliberately incomplete because imagery is
   banned, and it is not to be resolved by adding an image.

Effort estimate from the consolidation plan: about a day. This is item 1 of 3 in the build sequence,
ahead of the studio page and Startup Skills.
