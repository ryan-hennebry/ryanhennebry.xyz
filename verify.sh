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

for f in index.html assets/site.css; do
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

# Imagery is banned outright, in every form.
if grep -nEi '<img|<svg|<picture|background-image|url\(.*\.(png|jpg|jpeg|gif|svg|webp)' index.html assets/site.css 2>/dev/null; then
  echo "FAIL imagery found. No photograph, avatar, logo, illustration, icon or decorative SVG."
  fail=1
else
  echo "ok: no imagery"
fi

# The only script permitted on the page is the JSON-LD Person block.
scripts=$(grep -c '<script' index.html || true)
ldjson=$(grep -c 'application/ld+json' index.html || true)
if [ "$scripts" != "$ldjson" ]; then
  echo "FAIL $scripts script tags but $ldjson JSON-LD blocks. No other JavaScript is allowed."
  fail=1
else
  echo "ok: no JavaScript beyond the JSON-LD block"
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

# The final page has three visible section labels and four supplied public destinations.
headings=$(grep -c '<h2' index.html || true)
if [ "$headings" = "3" ]; then
  echo "ok: Previously, Projects and Links headings present"
else
  echo "FAIL expected 3 h2 section labels, found $headings"
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
