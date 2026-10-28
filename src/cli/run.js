'use strict';

const fs = require('fs');
const path = require('path');
const { YamlRunner } = require('../runner/YamlRunner');
const { generateHtmlReport, generateJsonReport } = require('../runner/reporter');
const { execSync } = require('child_process');

/**
 * `synora-test run` CLI handler
 *
 * Usage:
 *   synora-test run <file.yaml>
 *   synora-test run <directory/>
 *
 * Options:
 *   --headed                   Run browser in headed mode
 *   --slow <ms>                Slow down actions by <ms> milliseconds
 *   --browser <name>           chromium | firefox | webkit  (default: chromium)
 *   --timeout <ms>             Default action timeout (default: 30000)
 *   --base-url <url>           Override config.baseUrl for all flows
 *   --parallel <N>             Run up to N flows concurrently (default: 1)
 *   --trace [on|retain-on-failure|off]
 *                              Record Playwright trace (default: off)
 *   --screenshot [on|only-on-failure|off]
 *                              Take screenshots (default: only-on-failure)
 *   --output-dir <dir>         Directory for traces/screenshots/report (default: test-results)
 *   --report-dir <dir>          Directory for Playwright HTML report (default: playwright-report)
 *   --no-report                Skip generating Playwright HTML report
 *   --custom-report            Also generate custom report.html + report.json
 *   --open                     Auto-open the HTML report after run
 */
async function run(argv) {
  const opts = _parseArgs(argv);

  if (!opts.target) {
    console.error('Usage: synora-test run <file.yaml|directory> [options]');
    process.exit(1);
  }

  // Accept self-signed certs on internal/staging networks
  process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

  const files = _collectFiles(opts.target);
  if (files.length === 0) {
    console.error(`No .yaml files found at: ${opts.target}`);
    process.exit(1);
  }

  if (opts.baseUrl)
    process.env.BASE_URL = opts.baseUrl;

  const outputDir = path.resolve(process.cwd(), opts.outputDir);
  fs.mkdirSync(outputDir, { recursive: true });

  const pw = require('../playwright').playwright();
  const browserType = pw[opts.browser] ?? pw.chromium;

  const browser = await browserType.launch({
    headless: !opts.headed,
    slowMo: opts.slow,
    ignoreHTTPSErrors: true,
  });

  const results = [];
  const concurrency = Math.max(1, opts.parallel);

  console.log(`\nRunning ${files.length} flow(s) with concurrency=${concurrency}\n`);

  // Derive a safe filename slug from flow path
  function _slug(file) {
    return path.relative(process.cwd(), file)
      .replace(/[/\\]/g, '_')
      .replace(/\.ya?ml$/, '');
  }

  // Simple worker pool — at most `concurrency` flows running at once
  async function runFile(file) {
    const name = path.relative(process.cwd(), file);
    const slug = _slug(file);
    console.log(`▶  Starting: ${name}`);

    const context = await browser.newContext();
    const page = await context.newPage();

    // --- Trace ---
    const traceEnabled = opts.trace === 'on' || opts.trace === 'retain-on-failure';
    if (traceEnabled) {
      await context.tracing.start({
        screenshots: true,
        snapshots: true,
        sources: false,
      });
    }

    const runner = new YamlRunner({
      timeout: opts.timeout,
      stepScreenshotDir: path.join(outputDir, 'screenshots', slug),
    });
    const startTime = Date.now();
    let passed = false;
    let errorMsg = null;
    let screenshotFile = null;
    let traceFile = null;

    let cdpSession = null;
    if (opts.live) {
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
      } catch (err) {
        console.error(`   ⚠️  Live view unavailable: ${err.message}`);
        cdpSession = null;
      }
    }

    try {
      await runner.run(file, page, context);
      passed = true;
      console.log(`✅ PASSED: ${name}`);
    } catch (err) {
      errorMsg = err.message;
      console.error(`❌ FAILED: ${name}`);
      console.error(`   ${err.message}`);
    }

    if (cdpSession) {
      try {
        await cdpSession.send('Page.stopScreencast');
      } catch { /* ignore */ }
    }

    const duration = Date.now() - startTime;

    // --- Screenshot ---
    const takeScreenshot = opts.screenshot === 'on' || (opts.screenshot === 'only-on-failure' && !passed);
    if (takeScreenshot) {
      try {
        screenshotFile = path.join(outputDir, 'screenshots', `${slug}.png`);
        fs.mkdirSync(path.dirname(screenshotFile), { recursive: true });
        await page.screenshot({ path: screenshotFile, fullPage: true });
      } catch {
        // ignore screenshot errors
      }
    }

    // --- Stop trace ---
    if (traceEnabled) {
      const saveTrace = opts.trace === 'on' || (opts.trace === 'retain-on-failure' && !passed);
      if (saveTrace) {
        traceFile = path.join(outputDir, 'traces', `${slug}.zip`);
        fs.mkdirSync(path.dirname(traceFile), { recursive: true });
        await context.tracing.stop({ path: traceFile });
        console.log(`   📦 Trace: ${path.relative(process.cwd(), traceFile)}`);
      } else {
        await context.tracing.stop(); // discard
      }
    }

    await context.close();
    return { name, passed, duration, error: errorMsg, screenshot: screenshotFile, traceFile, steps: runner.stepResults };
  }

  // Run in batches of `concurrency`
  for (let i = 0; i < files.length; i += concurrency) {
    const batch = files.slice(i, i + concurrency);
    const batchResults = await Promise.all(batch.map(runFile));
    results.push(...batchResults);
  }

  await browser.close();

  // Summary
  const total = results.length;
  const passed = results.filter(r => r.passed).length;
  const failed = total - passed;

  console.log('\n─────────────────────────────────');
  console.log(`Results: ${passed}/${total} passed${failed ? `, ${failed} failed` : ''}`);

  // --- Playwright native HTML report (default) ---
  if (opts.report) {
    const pwReportDir = path.resolve(process.cwd(), opts.reportDir);
    console.log(`\n⏳ Generating HTML report...`);
    fs.mkdirSync(pwReportDir, { recursive: true });
    generateHtmlReport(results, path.join(pwReportDir, 'index.html'));
    const relDir = path.relative(process.cwd(), pwReportDir);
    console.log(`🎭 Playwright report: ${relDir}/index.html`);

    if (opts.open) {
      const htmlFile = path.join(pwReportDir, 'index.html');
      const opener = process.platform === 'darwin' ? 'open'
        : process.platform === 'win32' ? 'start ""' : 'xdg-open';
      try {
        execSync(`${opener} ${JSON.stringify(htmlFile)}`, { stdio: 'ignore' });
      } catch {
        console.log(`   Open: ${htmlFile}`);
      }
    } else {
      console.log(`   Open: ${path.join(relDir, 'index.html')}`);
    }
  }

  // --- Custom report (opt-in) ---
  if (opts.customReport) {
    const htmlPath = path.join(outputDir, 'report.html');
    generateHtmlReport(results, htmlPath);
    console.log(`📊 Custom HTML: ${path.relative(process.cwd(), htmlPath)}`);

    const jsonPath = path.join(outputDir, 'report.json');
    generateJsonReport(results, jsonPath);
    console.log(`📄 JSON:        ${path.relative(process.cwd(), jsonPath)}`);
  }

  if (failed > 0) {
    console.log('\nFailed flows:');
    results.filter(r => !r.passed).forEach(r => console.log(`  ✗ ${r.name}`));
    process.exit(1);
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function _parseArgs(argv) {
  const opts = {
    target: null,
    headed: false,
    slow: 0,
    browser: 'chromium',
    timeout: 30000,
    baseUrl: null,
    parallel: 1,
    trace: 'off',                  // on | retain-on-failure | off
    screenshot: 'only-on-failure', // on | only-on-failure | off
    outputDir: 'test-results',
    report: true,           // generate Playwright HTML report by default
    reportDir: 'playwright-report',
    customReport: false,    // opt-in: also generate custom report.html + report.json
    open: false,            // auto-open HTML report in default browser
    live: false,            // stream a CDP screencast (live browser view) over stdout
  };

  let i = 0;
  while (i < argv.length) {
    const arg = argv[i];
    if (arg === '--headed') {
      opts.headed = true;
    } else if (arg === '--slow') {
      opts.slow = parseInt(argv[++i] ?? '500', 10);
    } else if (arg === '--browser') {
      opts.browser = argv[++i] ?? 'chromium';
    } else if (arg === '--timeout') {
      opts.timeout = parseInt(argv[++i] ?? '30000', 10);
    } else if (arg === '--base-url') {
      opts.baseUrl = argv[++i];
    } else if (arg === '--parallel' || arg === '-p') {
      opts.parallel = parseInt(argv[++i] ?? '2', 10);
    } else if (arg === '--trace') {
      // --trace          → defaults to 'on'
      // --trace on|retain-on-failure|off
      const next = argv[i + 1];
      if (next && !next.startsWith('--')) {
        opts.trace = argv[++i];
      } else {
        opts.trace = 'on';
      }
    } else if (arg === '--screenshot') {
      const next = argv[i + 1];
      if (next && !next.startsWith('--')) {
        opts.screenshot = argv[++i];
      } else {
        opts.screenshot = 'on';
      }
    } else if (arg === '--output-dir') {
      opts.outputDir = argv[++i] ?? 'test-results';
    } else if (arg === '--no-report') {
      opts.report = false;
    } else if (arg === '--report-dir') {
      opts.reportDir = argv[++i] ?? 'playwright-report';
    } else if (arg === '--custom-report') {
      opts.customReport = true;
    } else if (arg === '--open') {
      opts.open = true;
    } else if (arg === '--live') {
      opts.live = true;
    } else if (!arg.startsWith('--')) {
      opts.target = arg;
    }
    i++;
  }

  return opts;
}

function _collectFiles(target) {
  const absTarget = path.isAbsolute(target) ? target : path.resolve(process.cwd(), target);

  if (!fs.existsSync(absTarget))
    throw new Error(`Path not found: ${absTarget}`);

  const stat = fs.statSync(absTarget);
  if (stat.isDirectory()) {
    return fs.readdirSync(absTarget)
      .filter(f => f.endsWith('.yaml') || f.endsWith('.yml'))
      .sort()
      .map(f => path.join(absTarget, f));
  }
  return [absTarget];
}

module.exports = { run };
