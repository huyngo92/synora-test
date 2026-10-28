'use strict';

const { spawn } = require('child_process');
const path = require('path');

/**
 * `synora-test codegen` CLI handler
 *
 * Wraps `playwright-core codegen --target=yaml [options] [url]`
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

  // Find playwright-core binary — prefer the linked monorepo version
  const { cmd, prefix, shell } = _findPlaywrightCoreBin();
  const fullArgs = [...prefix, ...args];
  console.log(`Launching: ${cmd} ${fullArgs.join(' ')}\n`);

  const child = spawn(cmd, fullArgs, { stdio: 'inherit', shell: !!shell });

  child.on('error', err => {
    console.error(`Failed to start playwright-core: ${err.message}`);
    console.error('Make sure playwright-core is installed and accessible.');
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

/**
 * Returns { cmd, prefix, shell } where:
 *   cmd    — the executable to spawn
 *   prefix — extra args to prepend (e.g. ['/path/to/cli.js'] when running via node)
 *   shell  — true when cmd is a .cmd file (Windows requires shell:true for .cmd)
 */
function _findPlaywrightCoreBin() {
  const fs = require('fs');
  const isWin = process.platform === 'win32';
  const ext = isWin ? '.cmd' : '';

  // __dirname = .../web-testing/packages/synora-test/src/cli
  // 4 levels up  = .../web-testing  (the monorepo root for this sub-project)
  const webTestingRoot = path.resolve(__dirname, '../../../..');

  // 1. Monorepo sibling: web-testing/packages/playwright-core/cli.js
  const monorepoCoreCli = path.join(webTestingRoot, 'packages/playwright-core/cli.js');
  if (fs.existsSync(monorepoCoreCli))
    return { cmd: process.execPath, prefix: [monorepoCoreCli], shell: false };

  // 2. node_modules/.bin at web-testing root (workspace hoisting)
  const monorepoBin = path.join(webTestingRoot, `node_modules/.bin/playwright-core${ext}`);
  if (fs.existsSync(monorepoBin))
    return { cmd: monorepoBin, prefix: [], shell: isWin };

  // 3. Walk up from web-testing looking for node_modules/.bin (npm-installed layout)
  let dir = webTestingRoot;
  while (true) {
    const binPath = path.join(dir, `node_modules/.bin/playwright-core${ext}`);
    if (fs.existsSync(binPath))
      return { cmd: binPath, prefix: [], shell: isWin };
    const parent = path.dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }

  // 4. Resolve via playwright-core package.json bin field
  try {
    const pkgJsonPath = require.resolve('playwright-core/package.json', { paths: [__dirname] });
    const pkg = JSON.parse(fs.readFileSync(pkgJsonPath, 'utf-8'));
    const pkgDir = path.dirname(pkgJsonPath);
    const binVal = pkg.bin;
    const binEntry = typeof binVal === 'string' ? binVal
      : (binVal && (binVal['playwright-core'] || binVal['playwright']));
    if (binEntry) {
      const cliPath = path.resolve(pkgDir, binEntry);
      if (fs.existsSync(cliPath))
        return { cmd: process.execPath, prefix: [cliPath], shell: false };
    }
  } catch (_) {}

  // 5. Last resort — rely on PATH (shell:true needed on Windows for .cmd)
  return { cmd: `playwright-core${ext}`, prefix: [], shell: isWin };
}

module.exports = { run };
