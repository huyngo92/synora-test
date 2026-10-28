'use strict';

const fs = require('fs');
const path = require('path');
const { DataLoader } = require('./dataLoader');
const commands = require('./commands');
const { runApiBlock } = require('./apiCommands');

/**
 * YamlRunner — parses and executes a Maestro-style YAML flow file.
 *
 * YAML flow format:
 *   appId: browser
 *   name: My Test
 *   config:
 *     baseUrl: ${BASE_URL:-https://example.com}
 *     data: ./data/users.json        # loaded into vars as top-level keys
 *     dataAs: users                  # optional namespace (vars.users = [...])
 *   ---
 *   - openLink: ${config.baseUrl}/login
 *   - tapOn: "Username"
 *   - inputText: ${data.admin.username}
 *   - api:
 *       method: POST
 *       url: ${config.baseUrl}/api/auth
 *       body:
 *         username: ${data.admin.username}
 *       assert:
 *         status: 200
 *       capture:
 *         auth.token: body.token
 *   - call: helpers/custom.js#myFunction
 */
class YamlRunner {
  constructor(opts = {}) {
    this._opts = {
      timeout: opts.timeout ?? 30000,
      ...opts,
    };
    // Pre-seeded vars from suite-level data (key → value pairs)
    this._initialVars = opts.initialVars ?? {};
    // Structured per-step results for the HTML report (top-level steps only)
    this.stepResults = [];
  }

  /**
   * Run a single YAML flow file.
   * @param {string} filePath  Absolute path to the .yaml file
   * @param {import('playwright-core').Page} page
   * @param {import('playwright-core').BrowserContext} context
   */
  async run(filePath, page, context) {
    const { frontMatter, steps } = _parseYaml(filePath);
    const flowDir = path.dirname(filePath);

    const loader = new DataLoader(flowDir);

    // Seed suite-level vars first (flow-level data can override specific keys)
    for (const [k, v] of Object.entries(this._initialVars))
      loader.set(k, v);

    // Store front-matter config in vars
    if (frontMatter.config)
      loader.set('config', loader.resolveDeep(frontMatter.config));

    // Load test data files — supports string or array
    const config = loader.get('config') ?? {};
    if (config.data) {
      const dataEntries = Array.isArray(config.data) ? config.data : [config.data];
      for (const entry of dataEntries) {
        if (typeof entry === 'string') {
          // Simple path → load into top-level vars
          loader.loadFile(entry, config.dataAs ?? undefined);
        } else if (entry && typeof entry === 'object') {
          // { file: './users.json', as: 'users' }
          loader.loadFile(entry.file, entry.as ?? undefined);
        }
      }
    }

    const opts = { ...this._opts, flowDir };
    let stepIdx = 0;
    const totalSteps = steps.length;

    for (const step of steps) {
      stepIdx++;
      const [cmdKey, rawValue] = _parseStep(step);

      if (cmdKey === null) {
        console.warn(`  ⚠️  Step ${stepIdx}: empty or unrecognised step, skipping`);
        continue;
      }

      // ── Debug Mode: pause before each step ──────────────────────────────
      const _dbgPauseFile = process.env.SYNORA_DEBUG_PAUSE_FILE;
      if (_dbgPauseFile && !fs.existsSync(_dbgPauseFile + '.skip')) {
        const preview = typeof rawValue === 'string'
          ? rawValue.substring(0, 120)
          : JSON.stringify(rawValue).substring(0, 120);
        // Write step metadata for the UI to read
        fs.writeFileSync(
          _dbgPauseFile + '.step',
          JSON.stringify({ idx: stepIdx, total: totalSteps, cmd: cmdKey, preview }),
          'utf8'
        );
        // Create pause file → runner will wait until it's deleted
        fs.writeFileSync(_dbgPauseFile, '1');
        process.stdout.write(`[DEBUG:PAUSE] ${stepIdx}/${totalSteps} ${cmdKey}\n`);
        // Poll until pause file is removed (Next) or skip file appears (Continue All)
        await new Promise(resolve => {
          const t = setInterval(() => {
            if (!fs.existsSync(_dbgPauseFile) || fs.existsSync(_dbgPauseFile + '.skip')) {
              clearInterval(t);
              resolve();
            }
          }, 150);
        });
      }
      // ────────────────────────────────────────────────────────────────────

      const t0 = Date.now();
      try {
        await _execOne(cmdKey, rawValue, page, context, loader, opts, `Step ${stepIdx}`);
        this.stepResults.push({
          index: stepIdx,
          cmd: cmdKey,
          preview: _preview(rawValue),
          status: 'pass',
          durationMs: Date.now() - t0,
        });
        process.stdout.write('[SYNORA:STEP] ' + JSON.stringify(this.stepResults[this.stepResults.length - 1]) + '\n');
      } catch (err) {
        let screenshotPath = null;
        try {
          if (opts.stepScreenshotDir) {
            screenshotPath = path.join(opts.stepScreenshotDir, `step${stepIdx}.png`);
            fs.mkdirSync(path.dirname(screenshotPath), { recursive: true });
            await page.screenshot({ path: screenshotPath });
          }
        } catch {
          screenshotPath = null;
        }
        this.stepResults.push({
          index: stepIdx,
          cmd: cmdKey,
          preview: _preview(rawValue),
          status: 'fail',
          durationMs: Date.now() - t0,
          error: err.message,
          screenshot: screenshotPath,
        });
        process.stdout.write('[SYNORA:STEP] ' + JSON.stringify(this.stepResults[this.stepResults.length - 1]) + '\n');
        throw new Error(`Step ${stepIdx} [${cmdKey}] failed: ${err.message}`);
      }
    }
  }
}

// ---------------------------------------------------------------------------
// Step execution — shared by top-level, runIf branches, and loop bodies so
// that `runIf`, `loop`, `capture`, `api`, `call` can be nested to any depth.
// ---------------------------------------------------------------------------

/**
 * Execute a list of steps sequentially. Each step is resolved (${...}
 * interpolation) at execution time so loop/capture vars set by earlier steps
 * are visible to later ones.
 */
async function _execSteps(steps, page, context, loader, opts) {
  for (const step of steps) {
    const [cmdKey, rawValue] = _parseStep(step);
    if (cmdKey === null) continue;
    await _execOne(cmdKey, rawValue, page, context, loader, opts, '  ↳');
  }
}

/**
 * Execute a single step. `label` is a log prefix ("Step 5" at top level,
 * "  ↳" for nested steps).
 */
async function _execOne(cmdKey, rawValue, page, context, loader, opts, label) {
  if (cmdKey === 'runIf') {
    // runIf:
    //   condition: '"${status}" === "APPROVED"'   # JS expression (${vars} resolved first)
    //   then:                                     # steps to run when true
    //     - tapOn: "Continue"
    //   else:                                     # steps to run when false (optional)
    //     - tapOn: "Skip"
    //
    // Tips:
    //   • Quote string vars:  '"${status}" === "APPROVED"'
    //   • Numeric:            '${count} > 0'
    //   • Access vars obj:    'vars.user.active === true'
    //   • Combined:           '"${status}" === "OK" && ${retry} < 3'
    const condRaw = rawValue.condition ?? rawValue.when ?? rawValue.if;
    if (!condRaw)
      throw new Error('runIf requires a "condition" field');

    // Step 1: resolve ${...} interpolation in the condition string
    const condResolved = String(loader.resolveDeep(condRaw));

    // Step 2: evaluate as JS — expose loader vars as `vars` for direct access
    const allVars = loader.getAll();
    let condResult;
    try {
      // eslint-disable-next-line no-new-func
      condResult = !!new Function('vars', `return (${condResolved})`)(allVars);
    } catch (evalErr) {
      throw new Error(`runIf condition eval failed: ${evalErr.message} (evaluated: "${condResolved}")`);
    }

    console.log(`  ${condResult ? '✅' : '⏭ '} ${label}: runIf [${condResolved}] → ${condResult}`);

    // Step 3: execute the matching branch (nested runIf/loop/capture allowed)
    const branchSteps = condResult
      ? (rawValue.then ?? [])
      : (rawValue.else ?? []);
    await _execSteps(branchSteps, page, context, loader, opts);
    return;
  }

  if (cmdKey === 'loop') {
    // loop:
    //   over: data.users          # dot-path to an array in vars
    //   as: row                   # variable name for current item (default: item)
    //   steps:                    # list of steps to repeat (may nest runIf/capture/loop)
    //     - tapOn: ...
    const arrayPath = String(loader.resolve(rawValue.over));
    const itemName = rawValue.as ? String(loader.resolve(rawValue.as)) : 'item';
    const loopSteps = rawValue.steps ?? []; // raw (unresolved) — re-resolved each iteration
    const arr = loader.get(arrayPath);
    if (!Array.isArray(arr))
      throw new Error(`loop.over "${arrayPath}" is not an array (got ${typeof arr})`);
    console.log(`  🔁 ${label}: loop over ${arrayPath} (${arr.length} items)`);
    for (let loopIdx = 0; loopIdx < arr.length; loopIdx++) {
      loader.set(itemName, arr[loopIdx]);
      loader.set('loop.index', loopIdx);
      await _execSteps(loopSteps, page, context, loader, opts);
    }
    return;
  }

  if (cmdKey === 'api') {
    const resolved = loader.resolveDeep(rawValue);
    await runApiBlock(resolved, context, loader, opts);
    console.log(`  ✅ ${label}: api:${resolved.method ?? 'GET'} ${resolved.url}`);
    return;
  }

  if (cmdKey === 'call') {
    const resolved = loader.resolveDeep(rawValue);
    await commands.callHelper(page, context, { value: String(resolved), props: {} }, loader, opts);
    console.log(`  ✅ ${label}: call: ${resolved}`);
    return;
  }

  if (cmdKey === 'capture') {
    const resolved = loader.resolveDeep(rawValue);
    await commands.captureVar(page, context, { props: resolved }, loader, opts);
    console.log(`  ✅ ${label}: capture`);
    return;
  }

  // Standard web command
  const handler = commands[cmdKey];
  if (!handler)
    throw new Error(`Unknown command: "${cmdKey}"`);
  const resolved = loader.resolveDeep(rawValue);
  await handler(page, context, _normaliseArgs(resolved), loader, opts);
  console.log(`  ✅ ${label}: ${cmdKey} ${_preview(resolved)}`);
}

// ---------------------------------------------------------------------------
// YAML parsing — minimal, no external deps
// ---------------------------------------------------------------------------

function _parseYaml(filePath) {
  if (!fs.existsSync(filePath))
    throw new Error(`Flow file not found: ${filePath}`);

  const raw = fs.readFileSync(filePath, 'utf-8');

  // Split on `---` separator (YAML doc boundary)
  const sepIdx = raw.indexOf('\n---\n');
  let frontRaw, stepsRaw;
  if (sepIdx !== -1) {
    frontRaw = raw.slice(0, sepIdx);
    stepsRaw = raw.slice(sepIdx + 5);
  } else {
    frontRaw = '';
    stepsRaw = raw;
  }

  const frontMatter = _parseSimpleYaml(frontRaw);
  const steps = _parseStepList(stepsRaw);
  return { frontMatter, steps };
}

/**
 * Parse a simple YAML front-matter block into a JS object.
 * Supports: scalar, nested objects (indent-based), no anchors/aliases.
 */
function _parseSimpleYaml(text) {
  const lines = text.split('\n').filter(l => l.trim() !== '' && !l.trim().startsWith('#'));
  return _parseBlock(lines, 0).value;
}

function _parseBlock(lines, baseIndent) {
  // Detect YAML sequence — all non-empty lines at baseIndent start with "- "
  const atBase = lines.filter(l => _indent(l) === baseIndent && l.trim() !== '');
  if (atBase.length > 0 && atBase.every(l => l.trim().startsWith('-'))) {
    const result = [];
    let i = 0;
    while (i < lines.length) {
      const line = lines[i];
      if (_indent(line) !== baseIndent || !line.trim().startsWith('-')) { i++; continue; }
      const content = line.replace(/^\s*-\s?/, '');
      const itemLines = [content];
      let j = i + 1;
      while (j < lines.length && (_indent(lines[j]) > baseIndent || lines[j].trim() === ''))
        itemLines.push(lines[j++]);
      i = j;
      result.push(_parseSimpleYaml(itemLines.join('\n')));
    }
    return { value: result };
  }

  const result = {};
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    const indent = _indent(line);
    if (indent < baseIndent) break;
    if (indent > baseIndent) { i++; continue; }

    const stripped = line.trim();
    if (!stripped) { i++; continue; }

    const colonIdx = stripped.indexOf(':');
    if (colonIdx === -1) { i++; continue; }

    const key = stripped.slice(0, colonIdx).trim();
    const rest = stripped.slice(colonIdx + 1).trim();

    if (rest === '' || rest.startsWith('#')) {
      // Value is a nested block — gather child lines
      const childLines = [];
      let j = i + 1;
      while (j < lines.length && (_indent(lines[j]) > indent || lines[j].trim() === ''))
        childLines.push(lines[j++]);
      // Use the actual indentation of the first non-empty child line as baseIndent
      const firstNonEmpty = childLines.find(l => l.trim() !== '');
      const childBaseIndent = firstNonEmpty !== undefined ? _indent(firstNonEmpty) : indent + 2;
      const child = _parseBlock(childLines, childBaseIndent);
      result[key] = child.value;
      i = j;
    } else {
      result[key] = _parseScalar(rest);
      i++;
    }
  }
  return { value: result };
}

function _parseScalar(s) {
  const raw = s.trim();

  // Quoted strings: must strip comments ONLY outside quotes
  if (raw.startsWith('"')) {
    // Find the closing unescaped quote
    let i = 1;
    while (i < raw.length) {
      if (raw[i] === '\\') { i += 2; continue; }
      if (raw[i] === '"') break;
      i++;
    }
    const inner = raw.slice(1, i);
    return inner.replace(/\\"/g, '"').replace(/\\\\/g, '\\');
  }
  if (raw.startsWith("'")) {
    const end = raw.indexOf("'", 1);
    const inner = end === -1 ? raw.slice(1) : raw.slice(1, end);
    return inner.replace(/''/g, "'");
  }

  // Unquoted: strip inline comments
  const t = raw.replace(/#.*$/, '').trim();
  if (t === 'true') return true;
  if (t === 'false') return false;
  if (t === 'null' || t === '~') return null;
  if (/^-?\d+$/.test(t)) return parseInt(t, 10);
  if (/^-?\d+\.\d+$/.test(t)) return parseFloat(t);
  return t;
}

function _indent(line) {
  return line.match(/^(\s*)/)[1].length;
}

/**
 * Parse the steps section — a YAML sequence of maps.
 * Each step is a single-line `- key: value` or a multi-line block `- key:\n    sub: val`.
 */
function _parseStepList(text) {
  const steps = [];
  const lines = text.split('\n');
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    if (!line.trim().startsWith('-')) { i++; continue; }

    const content = line.replace(/^\s*-\s?/, '');
    const stepLines = [content];
    let j = i + 1;
    // Gather continuation lines (indented deeper than the `-`)
    const baseIndent = _indent(line);
    while (j < lines.length && (_indent(lines[j]) > baseIndent || lines[j].trim() === '')) {
      stepLines.push(lines[j]);
      j++;
    }
    i = j;

    const stepText = stepLines.join('\n');
    const parsed = _parseSimpleYaml(stepText);
    steps.push(parsed);
  }
  return steps;
}

// ---------------------------------------------------------------------------
// Step parsing helpers
// ---------------------------------------------------------------------------

function _parseStep(step) {
  if (!step || typeof step !== 'object')
    return [null, null];
  const keys = Object.keys(step);
  if (keys.length === 0)
    return [null, null];
  const key = keys[0];
  const value = step[key];
  return [key, value];
}

function _normaliseArgs(value) {
  if (value === null || value === undefined)
    return { value: undefined, props: {} };
  if (typeof value !== 'object')
    return { value, props: {} };
  // If object, the entire object is props (e.g. tapOn: { text: "Login", id: "btn" })
  return { value: undefined, props: value };
}

function _preview(v) {
  if (typeof v === 'string' || typeof v === 'number')
    return `"${String(v).slice(0, 60)}"`;
  if (v && typeof v === 'object' && v.url)
    return v.url;
  return '';
}

module.exports = { YamlRunner };
