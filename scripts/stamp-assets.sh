#!/usr/bin/env bash
# Content-hash cache-busting for a no-build static site.
# Rewrites `<asset>?v=<hash>` in the HTML to a short SHA-1 of the asset's
# bytes, so the version changes only when the file's content changes.
# macOS (BSD sed) flavored — matches the local dev environment.
set -euo pipefail
cd "$(git rev-parse --show-toplevel)"

stamp() {
  local asset="$1"; shift          # path to the asset, e.g. js/portfolio.js
  [ -f "$asset" ] || return 0
  local hash base
  hash=$(shasum -a 1 "$asset" | cut -c1-8)
  base=$(basename "$asset")         # e.g. portfolio.js
  for html in "$@"; do
    [ -f "$html" ] || continue
    sed -i '' -E "s#(${base})\?v=[A-Za-z0-9]+#\1?v=${hash}#g" "$html"
  done
}

stamp css/portfolio.css index.html
stamp js/portfolio.js   index.html
stamp js/lightbox.js    index.html
stamp blog/blog.css     blog/index.html blog/post.html
stamp blog/blog.js      blog/index.html blog/post.html
