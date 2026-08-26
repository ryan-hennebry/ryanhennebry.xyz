# Handoff: ryanhennebry.xyz

## Built

The finished static page: `index.html`, `assets/site.css`, the Inter variable font and its licence,
`COPY.md`, `DESIGN.md`, `PRODUCT.md`, the verification harness and the Cloudflare deploy config. The
page carries Ryan's final copy, a 550px measure, the Previously, Projects and Links groups, and no
runtime dependency.

Deployed to Cloudflare as the `ryanhennebry-xyz` Worker. Namecheap delegates the domain to
Cloudflare. Both `https://ryanhennebry.xyz/` and `https://www.ryanhennebry.xyz/` serve the same
static page, replacing the stale Bear blog.

Rejected type variants and four unused fonts stayed behind in
`~/Projects/in-the-loop-archive/site/_prototypes/personal-site-minimal-v2-2026-08-20/explorations/`.
The craft rulings behind the build are in `../shared/agent-memory/`.

## Test

Run `./verify.sh`. It checks house style on the Markdown files and asserts the locked page
invariants: no imagery, no script other than the JSON-LD block, the 550px measure, all four supplied
public destinations, and pure ASCII in the shipped files.

Beyond that: open `index.html` from `file://` and confirm it renders complete with no network
requests. Check the two narrative sentences each set as two lines at 550px, the 4px label-to-content
gaps, the 24px group gaps, and zero overflow at 1440, 768, 390 and 320.

On 2026-08-26, the apex and `www` returned HTTP 200 and their HTML matched local `index.html`
byte-for-byte. The live stylesheet and font also matched their local files byte-for-byte. Public DNS
returned Cloudflare's assigned nameservers and the preserved Private Email MX, SPF, DKIM, SRV,
autoconfig, autodiscover and mail records. Every public destination except LinkedIn returned HTTP
200; LinkedIn returned its automated-request block, so only that external response was not
certified by the command-line check.

## Next

1. Run the required fresh-context certification review. The deployment writer's review attempt was
   blocked by the Codex usage limit, so the measured checks above are evidence, not certification.
2. Raise the share card with Ryan explicitly. It is deliberately incomplete because imagery is
   banned, and it is not to be resolved by adding an image.
