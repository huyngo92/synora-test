'use strict';

const path = require('path');

/**
 * Bundled Playwright fork (vendor/playwright-core) — adds YAML codegen
 * (--target=yaml, --domain-mapping). Synced via scripts/sync-playwright-fork.sh.
 */
const PLAYWRIGHT_DIR = path.resolve(__dirname, '../vendor/playwright-core');
const PLAYWRIGHT_CLI = path.join(PLAYWRIGHT_DIR, 'cli.js');

function playwright() {
  return require(PLAYWRIGHT_DIR);
}

module.exports = { playwright, PLAYWRIGHT_DIR, PLAYWRIGHT_CLI };
