'use strict';

const fs = require('fs');
const path = require('path');
const { YamlRunner } = require('../runner/YamlRunner');
const { generateGroupedHtmlReport, generateGroupedJsonReport } = require('../runner/reporter');

/**
 * `synora-test suite <suite.yaml>` CLI handler
 *
 * Suite YAML format:
 *
 *   name: Full Regression Suite
 *   config:
 *     browser: chromium
 *     headed: false
 *     slow: 0
 *     timeout: 30000
 *     baseUrl: https://staging.synora
 *     trace: retain-on-failure          # on | retain-on-failure | off
 *     screenshot: only-on-failure       # on | only-on-failure | off
 *     outputDir: test-results
 *
 *   groups:
 *     - name: "Authentication"
 *       flows:                          # sequential by default
 *         - flows/login-admin.yaml
 *         - flows/login-user.yaml
 *
 *     - name: "Core Features"
 *       parallel: 3                     # run up to 3 flows concurrently
 *       flows:
 *         - flows/search.yaml
 *         - flows/checkout.yaml
 *         - flows/profile.yaml
 *
 *     - name: "Cleanup"
 *       dependsOn: pass                 # skip group if previous group failed
 *       flows:
 *         - flows/logout.yaml
 */
async function run(argv) {
  const opts = _parseArgs(argv);

  if (!opts.suiteFile) {
    console.error('Usage: synora-test suite <suite.yaml> [options]');
    process.exit(1);
  }

  process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

  const suiteFile = path.isAbsolute(opts.suiteFile)
    ? opts.suiteFile
    : path.resolve(process.cwd(), opts.suiteFile);

  if (!fs.existsSync(suiteFile)) {
    console.error(`Suite file not found: ${suiteFile}`);
    process.exit(1);
  }

  const suite = _parseSuiteYaml(suiteFile);
  const suiteDir = path.dirname(suiteFile);

  // Merge: CLI opts > suite config > defaults
  const config = {
    browser: 'chromium',
    headed: false,
    slow: 0,
    timeout: 30000,
    baseUrl: null,
    trace: 'off',
    screenshot: 'only-on-failure',
    outputDir: 'test-results',
    live: false,
    ...suite.config,
    ...opts.overrides,  // CLI flags always win
  };

  if (config.baseUrl)
    process.env.BASE_URL = config.baseUrl;

  // Load suite-level data files once — injected into every flow as initialVars
  const { DataLoader } = require('../runner/dataLoader');
  const suiteLoader = new DataLoader(suiteDir);
  if (suite.data) {
    const entries = Array.isArray(suite.data) ? suite.data : [suite.data];
    for (const entry of entries) {
      if (typeof entry === 'string') {
        suiteLoader.loadFile(entry);
      } else if (entry && typeof entry === 'object') {
        suiteLoader.loadFile(entry.file, entry.as ?? undefined);
      }
    }
    const dataKeys = Object.keys(suiteLoader.getAll());
    console.log(`📂 Suite data loaded: [${dataKeys.join(', ')}]`);
  }
  const suiteInitialVars = suiteLoader.getAll();

  const outputDir = path.resolve(process.cwd(), config.outputDir);
  fs.mkdirSync(outputDir, { recursive: true });

  const pw = require('../playwright').playwright();
  const browserType = pw[config.browser] ?? pw.chromium;
  const launchOpts = {
    headless: !config.headed,
    slowMo: Number(config.slow) || 0,
    ignoreHTTPSErrors: true,
  };

  // userDataDir → use a persistent browser profile (cookies/localStorage/IndexedDB
  // survive across separate CLI runs) instead of a fresh incognito-like context.
  // Needed for apps behind SSO/MFA where login can't be scripted — the user logs
  // in manually once (headed), and subsequent runs reuse the already-authenticated profile.
  const isPersistent = !!config.userDataDir;
  let browser = null;
  let persistentContext = null;
  let persistentPage = null;
  let persistentSharedCtx = null;

  if (isPersistent) {
    const profileDir = path.isAbsolute(config.userDataDir)
      ? config.userDataDir
      : path.resolve(suiteDir, config.userDataDir);
    fs.mkdirSync(profileDir, { recursive: true });
    console.log(`🔒 Persistent profile: ${profileDir}`);
    persistentContext = await browserType.launchPersistentContext(profileDir, launchOpts);
    persistentPage = persistentContext.pages()[0] ?? await persistentContext.newPage();
    // Created once and reused across every group/flow so a live-view CDP session
    // (if started) keeps streaming for the whole suite run instead of restarting.
    persistentSharedCtx = { context: persistentContext, page: persistentPage };
  } else {
    browser = await browserType.launch(launchOpts);
  }

  console.log(`\n═══════════════════════════════════`);
  console.log(`  Suite: ${suite.name ?? path.basename(suiteFile)}`);
  console.log(`  Groups: ${suite.groups.length}`);
  console.log(`═══════════════════════════════════\n`);

  const groupResults = [];

  try {
    let prevGroupPassed = true;

    for (const group of suite.groups) {
      const groupName = group.name ?? `Group ${groupResults.length + 1}`;
      const concurrency = Math.max(1, Number(group.parallel ?? 1));

      // dependsOn: pass → skip if previous group had failures
      if (group.dependsOn === 'pass' && !prevGroupPassed) {
        console.log(`⏭  Skipped (dependsOn: pass): ${groupName}\n`);
        groupResults.push({ name: groupName, skipped: true, results: [] });
        continue;
      }

      const flows = _resolveFlows(group.flows ?? [], suiteDir);
      if (flows.length === 0) {
        console.warn(`⚠  No flows found in group: ${groupName}`);
        groupResults.push({ name: groupName, skipped: false, results: [] });
        continue;
      }

      const modeStr = concurrency > 1 ? `parallel=${concurrency}` : 'sequential';
      console.log(`┌─ Group: ${groupName}  [${flows.length} flow(s), ${modeStr}]`);

      const results = [];

      if (isPersistent) {
        if (concurrency > 1) {
          console.warn(`⚠  Group "${groupName}" khai báo parallel=${concurrency} nhưng suite dùng userDataDir (persistent profile) — chạy tuần tự để tránh mở nhiều context song song trên cùng 1 profile.`);
        }
        // Persistent profile: reuse the SAME context/page across every group/flow
        // in the whole suite run, so the SSO session survives the entire run.
        for (const f of flows) {
          const result = await _runFlow(f, null, config, outputDir, suiteInitialVars,
            persistentSharedCtx);
          results.push(result);
          if (!result.passed) break; // stop on failure — subsequent flows need prior state
        }
      } else if (concurrency === 1) {
        // Sequential: share one browser context/page so session state (login cookies)
        // persists across all flows in the group.
        const sharedContext = await browser.newContext();
        const sharedPage = await sharedContext.newPage();
        const sharedCtx = { context: sharedContext, page: sharedPage };
        try {
          for (const f of flows) {
            const result = await _runFlow(f, browser, config, outputDir, suiteInitialVars,
              sharedCtx);
            results.push(result);
            if (!result.passed) break; // stop on failure — subsequent flows need prior state
          }
        } finally {
          await sharedContext.close();
        }
      } else {
        // Parallel: each flow gets its own isolated context
        for (let i = 0; i < flows.length; i += concurrency) {
          const batch = flows.slice(i, i + concurrency);
          const batchResults = await Promise.all(
            batch.map(f => _runFlow(f, browser, config, outputDir, suiteInitialVars))
          );
          results.push(...batchResults);
        }
      }

      const gPassed = results.filter(r => r.passed).length;
      const gFailed = results.length - gPassed;
      const gDur = results.reduce((s, r) => s + (r.duration ?? 0), 0);
      prevGroupPassed = gFailed === 0;

      console.log(`└─ ${groupName}: ${gPassed}/${results.length} passed  (${(gDur / 1000).toFixed(1)}s)\n`);
      groupResults.push({ name: groupName, skipped: false, results });
    }
  } finally {
    if (isPersistent) {
      await persistentContext.close(); // flushes the profile to disk
    } else {
      await browser.close();
    }
  }

  // Flatten all results for summary
  const allResults = groupResults.flatMap(g => g.results);
  const total = allResults.length;
  const passed = allResults.filter(r => r.passed).length;
  const failed = total - passed;

  console.log('═══════════════════════════════════');
  console.log(`Suite Results: ${passed}/${total} passed${failed ? `, ${failed} failed` : ''}`);

  // Reports
  const htmlPath = path.join(outputDir, 'report.html');
  generateGroupedHtmlReport(suite.name ?? 'Suite', groupResults, htmlPath);
  console.log(`📊 HTML:    ${path.relative(process.cwd(), htmlPath)}`);

  const jsonPath = path.join(outputDir, 'report.json');
  generateGroupedJsonReport(suite.name ?? 'Suite', groupResults, jsonPath);
  console.log(`📄 JSON:    ${path.relative(process.cwd(), jsonPath)}`);

  if (failed > 0) {
    console.log('\nFailed flows:');
    allResults.filter(r => !r.passed).forEach(r => console.log(`  ✗ ${r.name}`));
    process.exit(1);
  }
}

// ---------------------------------------------------------------------------
// Run a single flow — shared logic
// ---------------------------------------------------------------------------
async function _runFlow(file, browser, config, outputDir, initialVars = {}, sharedCtx = null) {
  const name = path.relative(process.cwd(), file);
  const slug = name.replace(/[/\\]/g, '_').replace(/\.ya?ml$/, '');
  console.log(`  ▶  ${name}`);

  const ownsContext = sharedCtx == null;
  const context = sharedCtx ? sharedCtx.context : await browser.newContext();
  const page = sharedCtx ? sharedCtx.page : await context.newPage();

  const traceEnabled = config.trace === 'on' || config.trace === 'retain-on-failure';
  if (traceEnabled) {
    await context.tracing.start({ screenshots: true, snapshots: true, sources: false });
  }

  const runner = new YamlRunner({
    timeout: Number(config.timeout) || 30000,
    initialVars,
    stepScreenshotDir: path.join(outputDir, 'screenshots', slug),
  });
  const startTime = Date.now();
  let passed = false;
  let errorMsg = null;
  let screenshotFile = null;
  let traceFile = null;

  // Live view (CDP screencast) — reuse an already-open session on the shared
  // page across flows in the same group instead of restarting it per flow.
  let cdpSession = null;
  let ownsCdpSession = false;
  if (config.live) {
    if (sharedCtx && sharedCtx.cdpSession) {
      cdpSession = sharedCtx.cdpSession;
    } else {
      try {
        cdpSession = await context.newCDPSession(page);
        await cdpSession.send('Page.startScreencast', {
          format: 'jpeg', quality: 50, maxWidth: 960, maxHeight: 600, everyNthFrame: 1,
        });
        cdpSession.on('Page.screencastFrame', (frame) => {
          // Only emit the raw frame marker when stdout is piped (e.g. to the dashboard
          // server, which relays it as Live View) — an interactive terminal doesn't need
          // this flood of base64 data.
          if (!process.stdout.isTTY) {
            process.stdout.write('[SYNORA:FRAME]' + frame.data + '\n');
          }
          cdpSession.send('Page.screencastFrameAck', { sessionId: frame.sessionId }).catch(() => {});
        });
        ownsCdpSession = true;
        if (sharedCtx) sharedCtx.cdpSession = cdpSession;
      } catch (err) {
        console.error(`     ⚠️  Live view unavailable: ${err.message}`);
        cdpSession = null;
      }
    }
  }

  try {
    await runner.run(file, page, context);
    passed = true;
    console.log(`  ✅ PASSED: ${name}`);
  } catch (err) {
    errorMsg = err.message;
    console.error(`  ❌ FAILED: ${name}`);
    console.error(`     ${err.message}`);
  }

  const duration = Date.now() - startTime;

  // Screenshot
  const takeShot = config.screenshot === 'on' || (config.screenshot === 'only-on-failure' && !passed);
  if (takeShot) {
    try {
      screenshotFile = path.join(outputDir, 'screenshots', `${slug}.png`);
      fs.mkdirSync(path.dirname(screenshotFile), { recursive: true });
      await page.screenshot({ path: screenshotFile, fullPage: true });
    } catch { /* ignore */ }
  }

  // Stop trace
  if (traceEnabled) {
    const saveTrace = config.trace === 'on' || (config.trace === 'retain-on-failure' && !passed);
    if (saveTrace) {
      traceFile = path.join(outputDir, 'traces', `${slug}.zip`);
      fs.mkdirSync(path.dirname(traceFile), { recursive: true });
      await context.tracing.stop({ path: traceFile });
      console.log(`     📦 Trace: ${path.relative(process.cwd(), traceFile)}`);
    } else {
      await context.tracing.stop();
    }
  }

  // Only stop a screencast this call started itself on an isolated (non-shared) context —
  // a session reused from sharedCtx keeps running until the shared context closes.
  if (ownsContext && cdpSession && ownsCdpSession) {
    try { await cdpSession.send('Page.stopScreencast'); } catch { /* ignore */ }
  }

  if (ownsContext) await context.close();
  return { name, passed, duration, error: errorMsg, screenshot: screenshotFile, traceFile, steps: runner.stepResults };
}

// ---------------------------------------------------------------------------
// Parse suite.yaml (minimal YAML parser, same style as YamlRunner)
// ---------------------------------------------------------------------------
function _parseSuiteYaml(filePath) {
  const content = fs.readFileSync(filePath, 'utf8');
  const lines = content.split('\n');

  const suite = { name: null, config: {}, data: null, groups: [] };
  let i = 0;

  // Parse top-level scalar: "name: ..."
  while (i < lines.length) {
    const line = lines[i];
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) { i++; continue; }

    if (trimmed.startsWith('name:')) {
      suite.name = _scalarVal(trimmed.slice(5));
      i++;
    } else if (trimmed === 'config:') {
      i++;
      const block = _collectBlock(lines, i, 2);
      i += block.length;
      suite.config = _parseConfigBlock(block);
    } else if (trimmed === 'data:') {
      i++;
      const dataLines = _collectBlock(lines, i, 2);
      i += dataLines.length;
      suite.data = _parseDataBlock(dataLines);
    } else if (trimmed === 'groups:') {
      i++;
      // parse group items
      while (i < lines.length) {
        const gl = lines[i];
        const gt = gl.trim();
        if (!gt || gt.startsWith('#')) { i++; continue; }
        if (!gt.startsWith('-')) break;

        // group item starts with "  - name: ..." or "  - ..."
        const groupLines = [gt.slice(1).trim()]; // strip leading '- '
        i++;
        while (i < lines.length) {
          const nl = lines[i];
          if (!nl.trim() || nl.trim().startsWith('#')) { i++; continue; }
          // still part of this group if indented more than the "  -" line
          if (!nl.startsWith(' ') && !nl.startsWith('\t')) break;
          // stop if we hit a new "  -" at same or lower indent
          if (/^  -/.test(nl)) break;
          groupLines.push(nl.trim());
          i++;
        }
        suite.groups.push(_parseGroupBlock(groupLines));
      }
    } else {
      i++;
    }
  }

  return suite;
}

function _parseConfigBlock(lines) {
  const config = {};
  for (const line of lines) {
    const t = line.trim();
    if (!t || t.startsWith('#')) continue;
    const colon = t.indexOf(':');
    if (colon < 0) continue;
    const key = t.slice(0, colon).trim();
    const val = _scalarVal(t.slice(colon + 1));
    config[key] = val === 'true' ? true : val === 'false' ? false : isNaN(val) ? val : Number(val);
  }
  return config;
}

/**
 * Parse suite-level data: block.
 * Supports:
 *   data:
 *     - ./data/accounts.json            # merge into top-level vars
 *     - file: ./data/products.json      # same, explicit form
 *       as: products                    # optional namespace
 */
function _parseDataBlock(lines) {
  const entries = [];
  for (const line of lines) {
    const t = line.trim();
    if (!t || t.startsWith('#')) continue;
    if (t.startsWith('-')) {
      const val = _scalarVal(t.slice(1));
      if (val) entries.push(val);          // simple path string
    } else if (t.startsWith('file:')) {
      // continuation of an object entry
      const last = entries[entries.length - 1];
      if (typeof last === 'object') {
        last.file = _scalarVal(t.slice(5));
      } else {
        entries.push({ file: _scalarVal(t.slice(5)) });
      }
    } else if (t.startsWith('as:')) {
      const last = entries[entries.length - 1];
      if (typeof last === 'object') {
        last.as = _scalarVal(t.slice(3));
      } else {
        // convert last string to object
        const prev = entries.pop();
        entries.push({ file: prev, as: _scalarVal(t.slice(3)) });
      }
    }
  }
  return entries.length === 1 ? entries[0] : entries;
}

function _parseGroupBlock(lines) {
  const group = { name: null, parallel: 1, dependsOn: null, flows: [] };
  let inFlows = false;

  for (const line of lines) {
    if (!line || line.startsWith('#')) continue;
    if (line.startsWith('name:')) {
      group.name = _scalarVal(line.slice(5));
      inFlows = false;
    } else if (line.startsWith('parallel:')) {
      group.parallel = Number(_scalarVal(line.slice(9))) || 1;
      inFlows = false;
    } else if (line.startsWith('dependsOn:')) {
      group.dependsOn = _scalarVal(line.slice(10));
      inFlows = false;
    } else if (line === 'flows:') {
      inFlows = true;
    } else if (inFlows && line.startsWith('-')) {
      let fp = _scalarVal(line.slice(1));
      // Strip trailing colon from YAML map-key syntax: "path.yaml:"
      if (fp.endsWith(':')) fp = fp.slice(0, -1).trim();
      if (fp) group.flows.push(fp);
    }
  }
  return group;
}

function _collectBlock(lines, start, minIndent) {
  const block = [];
  let i = start;
  while (i < lines.length) {
    const line = lines[i];
    const t = line.trim();
    if (!t || t.startsWith('#')) { block.push(line); i++; continue; }
    const indent = line.search(/\S/);
    if (indent < minIndent) break;
    block.push(line);
    i++;
  }
  return block;
}

function _scalarVal(str) {
  str = (str ?? '').trim();
  // Strip trailing comment
  str = str.replace(/#.*$/, '').trim();
  // Strip quotes
  if ((str.startsWith('"') && str.endsWith('"')) || (str.startsWith("'") && str.endsWith("'")))
    str = str.slice(1, -1);
  return str;
}

function _resolveFlows(flowPaths, suiteDir) {
  const resolved = [];
  for (const fp of flowPaths) {
    const abs = path.isAbsolute(fp) ? fp : path.resolve(suiteDir, fp);
    if (fs.existsSync(abs)) {
      const stat = fs.statSync(abs);
      if (stat.isDirectory()) {
        fs.readdirSync(abs)
          .filter(f => f.endsWith('.yaml') || f.endsWith('.yml'))
          .sort()
          .forEach(f => resolved.push(path.join(abs, f)));
      } else {
        resolved.push(abs);
      }
    } else {
      console.warn(`⚠  Flow not found: ${fp}`);
    }
  }
  return resolved;
}

// ---------------------------------------------------------------------------
// CLI args
// ---------------------------------------------------------------------------
function _parseArgs(argv) {
  const overrides = {};
  let suiteFile = null;

  let i = 0;
  while (i < argv.length) {
    const arg = argv[i];
    if (arg === '--headed') { overrides.headed = true; }
    else if (arg === '--slow') { overrides.slow = parseInt(argv[++i] ?? '500', 10); }
    else if (arg === '--browser') { overrides.browser = argv[++i] ?? 'chromium'; }
    else if (arg === '--timeout') { overrides.timeout = parseInt(argv[++i] ?? '30000', 10); }
    else if (arg === '--base-url') { overrides.baseUrl = argv[++i]; }
    else if (arg === '--trace') {
      const next = argv[i + 1];
      overrides.trace = (next && !next.startsWith('--')) ? argv[++i] : 'on';
    } else if (arg === '--screenshot') {
      const next = argv[i + 1];
      overrides.screenshot = (next && !next.startsWith('--')) ? argv[++i] : 'on';
    } else if (arg === '--output-dir') {
      overrides.outputDir = argv[++i] ?? 'test-results';
    } else if (arg === '--live') {
      overrides.live = true;
    } else if (!arg.startsWith('--')) {
      suiteFile = arg;
    }
    i++;
  }

  return { suiteFile, overrides };
}

module.exports = { run };
