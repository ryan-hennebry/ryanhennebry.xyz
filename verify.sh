#!/bin/sh
# Checks for ryanhennebry.xyz. Two gates: house style on the Markdown, and the locked
# invariants of the page itself once it has been promoted into this repo.
set -eu
cd "$(dirname "$0")"
fail=0

echo "== house style =="
for f in *.md; do
  [ -e "$f" ] || continue
  if LC_ALL=C grep -n '[^ -~]' "$f" >/dev/null 2>&1; then
    echo "FAIL $f: non-ASCII character (em dash, emoji or smart quote)"
    LC_ALL=C grep -n '[^ -~]' "$f"
    fail=1
  fi
done
[ "$fail" -eq 0 ] && echo "ok: all Markdown is pure ASCII"

echo "== the page =="
if [ ! -f index.html ]; then
  echo "not built: the site has not been promoted into this repo yet."
  echo "See HANDOFF.md. Nothing further to check."
  exit "$fail"
fi

for f in index.html assets/site.css robots.txt sitemap.xml; do
  if [ ! -f "$f" ]; then
    echo "FAIL missing $f"
    fail=1
    continue
  fi
  if LC_ALL=C grep -n '[^ -~]' "$f" >/dev/null 2>&1; then
    echo "FAIL $f: shipped files must be pure ASCII"
    fail=1
  fi
done

# Search engines and link-preview clients receive one consistent identity.
for metadata_value in \
  '<title>Ryan Hennebry</title>' \
  '<meta name="theme-color" content="#24303C">' \
  '<meta name="description" content="">' \
  '<meta property="og:site_name" content="Ryan Hennebry">' \
  '<meta property="og:title" content="Ryan Hennebry">' \
  '<meta property="og:description" content="">' \
  '<meta name="twitter:card" content="summary">' \
  '<meta name="twitter:title" content="Ryan Hennebry">' \
  '<meta name="twitter:description" content="">' \
  '<link rel="icon" href="favicon.ico" sizes="any">' \
  '<link rel="icon" type="image/png" sizes="48x48" href="favicon-48.png">' \
  '<link rel="apple-touch-icon" href="apple-touch-icon.png">' \
  '"@type": "WebSite"' \
  '"@type": "Person"'
do
  if grep -Fq -- "$metadata_value" index.html; then
    echo "ok: metadata invariant $metadata_value"
  else
    echo "FAIL missing metadata invariant: $metadata_value"
    fail=1
  fi
done

description="Ryan Hennebry is a founding operator currently building In The Loop and exploring how startups should operate now that agents work. He was Minima's first employee."
description_count=$(grep -Fc "$description" index.html || true)
if [ "$description_count" = "0" ]; then
  echo "ok: page and social descriptions are empty"
else
  echo "FAIL legacy description remains in $description_count metadata fields"
  fail=1
fi

if grep -Fq 'Sitemap: https://ryanhennebry.xyz/sitemap.xml' robots.txt && \
   grep -Fq '<loc>https://ryanhennebry.xyz/</loc>' sitemap.xml; then
  echo "ok: robots.txt and sitemap.xml point to the canonical origin"
else
  echo "FAIL crawler discovery files do not point to the canonical origin."
  fail=1
fi

for asset_spec in \
  'favicon-48.png|PNG image data, 48 x 48' \
  'apple-touch-icon.png|PNG image data, 180 x 180' \
  'favicon.ico|MS Windows icon resource - 1 icon, 48x48'
do
  asset=${asset_spec%%|*}
  signature=${asset_spec#*|}
  if [ -f "$asset" ] && file "$asset" | grep -Fq "$signature"; then
    echo "ok: $asset has its required format and dimensions"
  else
    echo "FAIL $asset is missing or has the wrong format or dimensions."
    fail=1
  fi
done

for asset_hash in \
  'd9a90edd38e4a1f7e6f4e50991cb610d4b64d825267a9588a82071b876b002a5|favicon-48.png' \
  'e91d24244de2729e21e0b0b538d2b7e19ec7033c227cf5ce812ee8b4fbfabe10|apple-touch-icon.png' \
  'ac2cf30d2bf707adb4e83defd8995184e42b517a21ac29d5fe25c3a9072003f8|favicon.ico'
do
  expected_hash=${asset_hash%%|*}
  asset=${asset_hash#*|}
  actual_hash=$(shasum -a 256 "$asset" | awk '{print $1}')
  if [ "$actual_hash" = "$expected_hash" ]; then
    echo "ok: $asset matches the approved identity asset"
  else
    echo "FAIL $asset does not match the approved identity asset."
    fail=1
  fi
done

if grep -nE 'og:image|twitter:image|og-card' index.html deploy.sh; then
  echo "FAIL share-image metadata or deployment reference found."
  fail=1
elif [ -e og-card.png ]; then
  echo "FAIL og-card.png must not ship."
  fail=1
else
  echo "ok: link previews have no image"
fi

if grep -Fq '"workers_dev": false' wrangler.jsonc && \
   grep -Fq '"preview_urls": false' wrangler.jsonc; then
  echo "ok: duplicate workers.dev and preview surfaces are disabled"
else
  echo "FAIL workers.dev and preview URLs must remain disabled."
  fail=1
fi

# The visible page remains free of imagery.
if grep -nEi '<img|<svg|<picture|background-image|url\(.*\.(png|jpg|jpeg|gif|svg|webp)' index.html assets/site.css 2>/dev/null; then
  echo "FAIL imagery found in the visible page."
  fail=1
else
  echo "ok: no imagery in the visible page"
fi

# The only script permitted on the page is the JSON-LD identity graph.
scripts=$(grep -c '<script' index.html || true)
ldjson=$(grep -c 'application/ld+json' index.html || true)
if [ "$scripts" != "$ldjson" ]; then
  echo "FAIL $scripts script tags but $ldjson JSON-LD blocks. No other JavaScript is allowed."
  fail=1
else
  echo "ok: no JavaScript beyond the JSON-LD identity graph"
fi

# The measure is frozen at 550px for the final copy.
if grep -qE '(--measure|measure)[[:space:]]*:[[:space:]]*550px' assets/site.css; then
  echo "ok: measure is 550px"
else
  echo "FAIL the 550px measure is not set. It is frozen for the final copy."
  fail=1
fi

# Section labels and their content form the tightest pair on the page.
if grep -qE -- '--space-tight:[[:space:]]*4px' assets/site.css; then
  echo "ok: label-to-content gap is 4px"
else
  echo "FAIL the label-to-content gap must be 4px."
  fail=1
fi

# Every relationship is locked to the final spacing system.
for token_value in \
  '--space-para: 12px' \
  '--space-group: 24px' \
  '--space-bottom: 48px' \
  '--space-void: 117px' \
  '--space-void-narrow: 56px' \
  '--gutter: 24px'
do
  if grep -Fq -- "$token_value" assets/site.css; then
    echo "ok: spacing token $token_value"
  else
    echo "FAIL missing locked spacing token: $token_value"
    fail=1
  fi
done

# One type size, one line box and deliberate wrapping are the type system.
for type_value in \
  '--size-name: 15px' \
  '--size-body: 15px' \
  '--leading: 1.5' \
  'text-wrap: pretty' \
  '-webkit-font-smoothing: antialiased' \
  '-moz-osx-font-smoothing: grayscale'
do
  if grep -Fq -- "$type_value" assets/site.css; then
    echo "ok: typography invariant $type_value"
  else
    echo "FAIL missing typography invariant: $type_value"
    fail=1
  fi
done

if grep -nE '^[[:space:]]*letter-spacing[[:space:]]*:' assets/site.css; then
  echo "FAIL letter-spacing must remain unset."
  fail=1
else
  echo "ok: Inter tracking is unaltered"
fi

# The page is intentionally motionless.
if grep -nE '^[[:space:]]*(transition|animation|transform|will-change)[[:space:]]*:' assets/site.css; then
  echo "FAIL motion declaration found. This page has zero motion."
  fail=1
else
  echo "ok: no transitions, animations, transforms or will-change"
fi

# Links remain identifiable and keyboard focus remains visible.
for focus_value in \
  '@media (hover: hover) and (pointer: fine)' \
  'a:focus-visible' \
  'outline: 2px solid var(--rule-strong)' \
  'outline-offset: 2px'
do
  if grep -Fq -- "$focus_value" assets/site.css; then
    echo "ok: interaction invariant $focus_value"
  else
    echo "FAIL missing interaction invariant: $focus_value"
    fail=1
  fi
done

# The final page has three visible section labels and four supplied public destinations.
headings=$(grep -c '<h2' index.html || true)
if [ "$headings" = "3" ]; then
  echo "ok: Previously, Projects and Links headings present"
else
  echo "FAIL expected 3 h2 section labels, found $headings"
  fail=1
fi

h1s=$(grep -c '<h1' index.html || true)
mains=$(grep -c '<main' index.html || true)
if [ "$h1s" = "1" ] && [ "$mains" = "1" ] && grep -Fq '<nav class="links" aria-labelledby="links-heading">' index.html; then
  echo "ok: one h1, one main and a named Links navigation landmark"
else
  echo "FAIL the page structure or Links landmark has drifted."
  fail=1
fi

for sentence in \
  'I explore emerging ecosystems and build systems that help people navigate them.' \
  'exploring how startups should operate now that agents work.'
do
  if grep -Fq "$sentence" index.html; then
    echo "ok: final narrative copy present"
  else
    echo "FAIL missing final narrative copy: $sentence"
    fail=1
  fi
done

for origin_value in \
  '<link rel="canonical" href="https://ryanhennebry.xyz/">' \
  '<meta property="og:url" content="https://ryanhennebry.xyz/">' \
  '"url": "https://ryanhennebry.xyz/"' \
  'href="https://in-the-loop.studio/"'
do
  if grep -Fq "$origin_value" index.html; then
    echo "ok: live-origin value present"
  else
    echo "FAIL missing live-origin value: $origin_value"
    fail=1
  fi
done

for url in \
  'https://minima.global/' \
  'https://github.com/ryan-hennebry/competitor-intel' \
  'https://github.com/ryan-hennebry/growth-experiments' \
  'https://github.com/ryan-hennebry/career-matching'
do
  if grep -Fq "href=\"$url\"" index.html; then
    echo "ok: linked $url"
  else
    echo "FAIL missing final public link $url"
    fail=1
  fi
done

# No location, anywhere, including the structured data.
if grep -nEi 'addressLocality|addressCountry|"address"' index.html; then
  echo "FAIL location found. Ryan's explicit choice is no location anywhere."
  fail=1
else
  echo "ok: no location"
fi

exit "$fail"
