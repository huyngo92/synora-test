'use strict';

const { spawn } = require('child_process');
const path = require('path');
const { PLAYWRIGHT_CLI } = require('../playwright');

/**
 * `synora-test codegen` CLI handler
 *
 * Wraps the bundled `playwright-core codegen --target=yaml [options] [url]`
 *
 * Usage:
 *   synora-test codegen [url]
 *   synora-test codegen --output flows/login.yaml https://example.com
 *   synora-test codegen --domain-mapping ./mapping.json
 */
function run(argv) {
  const { url, output, domainMapping } = _parseArgs(argv);

  // Ensure output directory exists before playwright-core tries to write
  if (output) {
    const fs = require('fs');
    const dir = path.dirname(path.resolve(process.cwd(), output));
    fs.mkdirSync(dir, { recursive: true });
  }

  // Build playwright-core codegen command
  const args = ['codegen', '--target=yaml', '--ignore-https-errors'];

  if (domainMapping)
    args.push('--domain-mapping', domainMapping);

  if (output)
    args.push('--output', output);

  if (url)
    args.push(url);

  // Bundled Playwright fork — official playwright-core has no YAML target
  const fullArgs = [PLAYWRIGHT_CLI, ...args];
  console.log(`Launching: playwright-core ${args.join(' ')}\n`);

  const child = spawn(process.execPath, fullArgs, { stdio: 'inherit' });

  child.on('error', err => {
    console.error(`Failed to start playwright-core: ${err.message}`);
    process.exit(1);
  });

  child.on('exit', code => {
    process.exit(code ?? 0);
  });
}

function _parseArgs(argv) {
  const opts = { url: null, output: null, domainMapping: null };
  let i = 0;
  while (i < argv.length) {
    const arg = argv[i];
    if (arg === '--output' || arg === '-o') {
      opts.output = argv[++i];
    } else if (arg === '--domain-mapping') {
      opts.domainMapping = argv[++i];
    } else if (!arg.startsWith('--')) {
      opts.url = arg;
    }
    i++;
  }
  return opts;
}

module.exports = { run };
