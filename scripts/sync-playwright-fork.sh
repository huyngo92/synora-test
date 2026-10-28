#!/usr/bin/env bash
# Đóng gói bản fork playwright-core (có codegen --target=yaml) vào vendor/playwright-core.
#
# Usage:
#   scripts/sync-playwright-fork.sh [path/to/fork/packages/playwright-core]
#
# Mặc định lấy từ biến PLAYWRIGHT_FORK_DIR. Fork phải được build trước (có thư mục lib/).
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
FORK_DIR="${1:-${PLAYWRIGHT_FORK_DIR:-}}"
DEST="$ROOT/vendor/playwright-core"

if [ -z "$FORK_DIR" ] || [ ! -f "$FORK_DIR/package.json" ] || [ ! -d "$FORK_DIR/lib" ]; then
  echo "Không tìm thấy fork playwright-core đã build: '$FORK_DIR'" >&2
  echo "Usage: $0 <path/to/packages/playwright-core>" >&2
  exit 1
fi

TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT

# npm pack tôn trọng .npmignore của Playwright → chỉ lấy lib/*.js, assets, types, browsers.json...
TGZ="$(cd "$FORK_DIR" && npm pack --workspaces=false --silent --pack-destination "$TMP" | tail -1)"
tar -xzf "$TMP/$TGZ" -C "$TMP"

rm -rf "$DEST"
mkdir -p "$(dirname "$DEST")"
mv "$TMP/package" "$DEST"

# Apache-2.0: giữ LICENSE/NOTICE của Playwright đi kèm bản phân phối lại
cp "$ROOT/scripts/playwright-LICENSE" "$DEST/LICENSE"
cat > "$DEST/NOTICE" <<NOTICE
This directory contains a modified build of Playwright (playwright-core)
Copyright (c) Microsoft Corporation, licensed under the Apache License 2.0.

Modifications by huyngo92 for synora-test:
  - codegen: YAML target (--target=yaml) and --domain-mapping option.

Source version: $(node -p "require('$DEST/package.json').version")
NOTICE

echo "Synced $(node -p "require('$DEST/package.json').version") → vendor/playwright-core ($(du -sh "$DEST" | cut -f1))"
