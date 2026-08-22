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

# The measure is frozen at 600px. If copy does not fit, the copy changes.
if grep -qE '(--measure|measure)[[:space:]]*:[[:space:]]*600px' assets/site.css; then
  echo "ok: measure is 600px"
else
  echo "FAIL the 600px measure is not set. It is frozen; do not tune it to fit copy."
  fail=1
fi

# No location, anywhere, including the structured data.
if grep -nEi 'addressLocality|addressCountry|"address"' index.html; then
  echo "FAIL location found. Ryan's explicit choice is no location anywhere."
  fail=1
else
  echo "ok: no location"
fi

exit "$fail"
