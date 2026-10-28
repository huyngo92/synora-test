'use strict';

const path = require('path');

/**
 * Web command handlers for YAML flows.
 * Each handler receives (page, context, args, loader, opts) and returns a Promise.
 *
 * args    — the resolved command arguments (value + props)
 * loader  — DataLoader instance (to set captured vars)
 * opts    — { timeout, flowDir }
 */

const KEY_MAP = {
  Enter: 'Enter', Tab: 'Tab', Escape: 'Escape',
  Backspace: 'Backspace', Delete: 'Delete',
  Up: 'ArrowUp', Down: 'ArrowDown', Left: 'ArrowLeft', Right: 'ArrowRight',
  Home: 'Home', End: 'End', PageUp: 'PageUp', PageDown: 'PageDown',
};

const DEFAULT_TIMEOUT = 30000;

// ---------------------------------------------------------------------------
// Command handlers
// ---------------------------------------------------------------------------

async function openLink(page, _ctx, args, _loader, opts) {
  const url = args.value;
  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: opts.timeout ?? DEFAULT_TIMEOUT });
}

async function tapOn(page, _ctx, args, _loader, opts) {
  const loc = _resolveLocator(page, args);
  await loc.waitFor({ state: 'visible', timeout: opts.timeout ?? DEFAULT_TIMEOUT });
  await loc.click({ timeout: opts.timeout ?? DEFAULT_TIMEOUT, force: !!args.props.force });
}

async function doubleTapOn(page, _ctx, args, _loader, opts) {
  const loc = _resolveLocator(page, args);
  await loc.waitFor({ state: 'visible', timeout: opts.timeout ?? DEFAULT_TIMEOUT });
  await loc.dblclick({ timeout: opts.timeout ?? DEFAULT_TIMEOUT });
}

async function inputText(page, _ctx, args, _loader, opts) {
  // If a locator prop is present, use fill() on the resolved element (clears + types)
  const LOCATOR_KEYS = ['xpath', 'css', 'id', 'label', 'placeholder', 'role'];
  if (args.value === undefined && LOCATOR_KEYS.some(k => k in args.props)) {
    const text = args.props.value ?? args.props.text ?? '';
    const locatorProps = Object.fromEntries(
      Object.entries(args.props).filter(([k]) => k !== 'value')
    );
    const loc = _resolveLocator(page, { value: undefined, props: locatorProps });
    await loc.waitFor({ state: 'visible', timeout: opts.timeout ?? DEFAULT_TIMEOUT });
    await loc.fill(String(text), { timeout: opts.timeout ?? DEFAULT_TIMEOUT });
    return;
  }
  const text = args.value !== undefined ? args.value : (args.props.text ?? '');
  await page.keyboard.type(String(text));
}

async function pressKey(page, _ctx, args, _loader, _opts) {
  const key = KEY_MAP[args.value] || args.value;
  await page.keyboard.press(key);
}

async function clearText(page, _ctx, args, _loader, opts) {
  const loc = _resolveLocator(page, args);
  await loc.clear({ timeout: opts.timeout ?? DEFAULT_TIMEOUT });
}

async function scroll(page, _ctx, args, _loader, _opts) {
  // args.value: "down" | "up" | "to:selector"
  const dir = (args.value || 'down').toLowerCase();
  if (dir === 'down')
    await page.evaluate(() => window.scrollBy(0, window.innerHeight));
  else if (dir === 'up')
    await page.evaluate(() => window.scrollBy(0, -window.innerHeight));
  else if (dir.startsWith('to:')) {
    const sel = dir.slice(3);
    await page.locator(sel).scrollIntoViewIfNeeded();
  }
}

async function waitForVisible(page, _ctx, args, _loader, opts) {
  const loc = _resolveLocator(page, args);
  await loc.waitFor({ state: 'visible', timeout: opts.timeout ?? DEFAULT_TIMEOUT });
}

async function waitForHidden(page, _ctx, args, _loader, opts) {
  const loc = _resolveLocator(page, args);
  await loc.waitFor({ state: 'hidden', timeout: opts.timeout ?? DEFAULT_TIMEOUT });
}

async function assertVisible(page, _ctx, args, _loader, opts) {
  const loc = _resolveLocator(page, args);
  await loc.waitFor({ state: 'visible', timeout: opts.timeout ?? DEFAULT_TIMEOUT });
}

async function assertNotVisible(page, _ctx, args, _loader, opts) {
  const loc = _resolveLocator(page, args);
  await loc.waitFor({ state: 'hidden', timeout: opts.timeout ?? DEFAULT_TIMEOUT });
}

async function assertText(page, _ctx, args, _loader, opts) {
  const text = args.value ?? args.props.text;
  await page.getByText(String(text), { exact: false })
    .waitFor({ state: 'visible', timeout: opts.timeout ?? DEFAULT_TIMEOUT });
}

async function assertTitle(page, _ctx, args, _loader, _opts) {
  const expected = args.value ?? args.props.text;
  const actual = await page.title();
  if (!actual.includes(String(expected)))
    throw new Error(`Page title "${actual}" does not contain "${expected}"`);
}

async function assertUrl(page, _ctx, args, _loader, _opts) {
  const expected = args.value ?? args.props.text;
  const actual = page.url();
  if (!actual.includes(String(expected)))
    throw new Error(`Page URL "${actual}" does not contain "${expected}"`);
}

async function assertScreenshot(page, _ctx, args, _loader, _opts) {
  const name = args.value || `screenshot-${Date.now()}`;
  const file = name.endsWith('.png') ? name : `${name}.png`;
  await page.screenshot({ path: file, fullPage: true });
  console.log(`     📸 Saved ${file}`);
}

async function selectOption(page, _ctx, args, _loader, opts) {
  // args.props.option — the option label/value to select
  const loc = _resolveLocator(page, args);
  const option = args.props.option ?? args.value;
  await loc.selectOption(String(option), { timeout: opts.timeout ?? DEFAULT_TIMEOUT });
}

async function check(page, _ctx, args, _loader, opts) {
  const loc = _resolveLocator(page, args);
  await loc.check({ timeout: opts.timeout ?? DEFAULT_TIMEOUT });
}

async function uncheck(page, _ctx, args, _loader, opts) {
  const loc = _resolveLocator(page, args);
  await loc.uncheck({ timeout: opts.timeout ?? DEFAULT_TIMEOUT });
}

async function hover(page, _ctx, args, _loader, opts) {
  const loc = _resolveLocator(page, args);
  await loc.hover({ timeout: opts.timeout ?? DEFAULT_TIMEOUT });
}

async function setInputFiles(page, _ctx, args, _loader, opts) {
  const loc = _resolveLocator(page, args);
  const rawPaths = args.props.paths ?? args.value;
  const paths = Array.isArray(rawPaths) ? rawPaths : [rawPaths];
  const resolvedPaths = paths.map(p => path.isAbsolute(p) ? p : path.resolve(opts.flowDir, p));
  await loc.setInputFiles(resolvedPaths, { timeout: opts.timeout ?? DEFAULT_TIMEOUT });
}

async function wait(page, _ctx, args, _loader, _opts) {
  const ms = parseInt(String(args.value ?? args.props.ms ?? 1000), 10);
  await page.waitForTimeout(ms);
}

async function waitForLoadState(page, _ctx, args, _loader, opts) {
  const state = typeof args.value === 'string' ? args.value : 'load';
  await page.waitForLoadState(state, { timeout: opts.timeout ?? DEFAULT_TIMEOUT });
}

async function captureVar(page, _ctx, args, loader, _opts) {
  // capture:
  //   my.var: "locator text" | { js: "expression" }
  for (const [varPath, source] of Object.entries(args.props)) {
    let value;
    if (typeof source === 'string') {
      // evaluate as JS expression in page context
      value = await page.evaluate(source);
    } else if (source && source.js) {
      value = await page.evaluate(source.js);
    } else if (source && source.text) {
      value = await page.getByText(source.text, { exact: false }).innerText();
    } else if (source && source.css) {
      let loc = page.locator(source.css);
      if (source.nth !== undefined) loc = loc.nth(Number(source.nth));
      value = await loc.innerText();
    } else if (source && source.xpath) {
      let loc = page.locator(`xpath=${source.xpath}`);
      if (source.nth !== undefined) loc = loc.nth(Number(source.nth));
      value = await loc.innerText();
    } else if (source && source.role) {
      const loc = source.name
        ? page.getByRole(source.role, { name: source.name })
        : page.getByRole(source.role);
      value = await loc.innerText();
    }
    loader.set(varPath, value);
    console.log(`     📌 Captured ${varPath} = ${JSON.stringify(value)}`);
  }
}

async function callHelper(page, ctx, args, loader, opts) {
  // call: helpers/my-helper.js#functionName
  const spec = args.value ?? '';
  const [filePart, fnName = 'default'] = spec.split('#');
  const absPath = path.isAbsolute(filePart)
    ? filePart
    : path.resolve(opts.flowDir, filePart);
  const mod = require(absPath);
  const fn = mod[fnName] ?? mod.default ?? mod;
  if (typeof fn !== 'function')
    throw new Error(`Cannot find exported function "${fnName}" in ${absPath}`);
  await fn(page, ctx, loader.getAll(), opts);
}

// ---------------------------------------------------------------------------
// Selector resolution
// ---------------------------------------------------------------------------

function _resolveLocator(page, args) {
  // Inline value → exact text match (avoids strict mode violations from partial matches)
  if (args.value !== undefined)
    return page.getByText(String(args.value), { exact: true });

  const p = args.props;
  if (p.id)
    return page.locator(`[data-testid="${p.id}"], [id="${p.id}"]`).first();
  if (p.text)
    return page.getByText(String(p.text), { exact: false });
  if (p.placeholder)
    return page.getByPlaceholder(String(p.placeholder));
  if (p.label)
    return page.getByLabel(String(p.label));
  if (p.role) {
    const loc = page.getByRole(p.role, p.name ? { name: p.name } : undefined);
    if (p.nth !== undefined) return loc.nth(Number(p.nth));
    return loc;
  }
  if (p.css) {
    // Strip CSS case-insensitive flag `i` from attribute selectors — not supported in Playwright
    // e.g. button[name="Login"i] → button[name="Login"]
    const css = String(p.css).replace(/("\s*)i\]/g, '$1]').replace(/('\s*)i\]/g, '$1]');
    const loc = page.locator(css);
    if (p.nth !== undefined) return loc.nth(Number(p.nth));
    return loc;
  }
  if (p.xpath) {
    const loc = page.locator(`xpath=${p.xpath}`);
    if (p.nth !== undefined) return loc.nth(Number(p.nth));
    return loc;
  }

  throw new Error(`Cannot resolve locator from props: ${JSON.stringify(p)}`);
}

// ---------------------------------------------------------------------------
// Registry
// ---------------------------------------------------------------------------

module.exports = {
  openLink,
  tapOn,
  doubleTapOn,
  inputText,
  pressKey,
  clearText,
  scroll,
  waitForVisible,
  waitForHidden,
  assertVisible,
  assertNotVisible,
  assertText,
  assertTitle,
  assertUrl,
  assertScreenshot,
  selectOption,
  check,
  uncheck,
  hover,
  setInputFiles,
  wait,
  waitForLoadState,
  captureVar,  // internal — called by YamlRunner for `capture:` top-level block
  callHelper,  // internal — called for `call:` directive
};
