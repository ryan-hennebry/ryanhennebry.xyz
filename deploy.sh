#!/bin/sh
# Package and deploy only the public site files.
set -eu

cd "$(dirname "$0")"
./verify.sh

deploy_dir=$(mktemp -d "${TMPDIR:-/tmp}/ryanhennebry-xyz.XXXXXX")
cleanup() {
  rm -rf -- "$deploy_dir"
}
trap cleanup EXIT HUP INT TERM

cp index.html "$deploy_dir/index.html"
cp -R assets "$deploy_dir/assets"
cp robots.txt "$deploy_dir/robots.txt"
cp sitemap.xml "$deploy_dir/sitemap.xml"
cp favicon.ico "$deploy_dir/favicon.ico"
cp favicon-48.png "$deploy_dir/favicon-48.png"
cp apple-touch-icon.png "$deploy_dir/apple-touch-icon.png"

for file in \
  index.html \
  assets/site.css \
  assets/fonts/inter-latin-var.woff2 \
  assets/fonts/OFL-Inter.txt \
  robots.txt \
  sitemap.xml \
  favicon.ico \
  favicon-48.png \
  apple-touch-icon.png
do
  cmp "$file" "$deploy_dir/$file"
done

file_count=$(find "$deploy_dir" -type f | wc -l | tr -d ' ')
if [ "$file_count" != "9" ]; then
  echo "FAIL expected 9 deployment files, found $file_count"
  exit 1
fi

exec npx --yes wrangler@4.125.0 deploy \
  --config wrangler.jsonc \
  --assets "$deploy_dir" \
  "$@"
