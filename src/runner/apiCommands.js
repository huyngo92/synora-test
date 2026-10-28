'use strict';

/**
 * API command handler — executes an `api:` block inside a YAML flow.
 *
 * Supported block format:
 *   - api:
 *       method: POST               # GET | POST | PUT | PATCH | DELETE (default GET)
 *       url: https://...           # required; ${...} already resolved by caller
 *       headers:                   # optional extra headers (merged with auth)
 *         X-Header: value
 *       body:                      # optional request body (sent as JSON)
 *         key: value
 *       form:                      # optional URL-encoded form body
 *         key: value
 *       assert:                    # optional assertions on the response
 *         status: 200              # expected HTTP status code
 *         body:                    # key path assertions on JSON body
 *           token: __exists__      # __exists__ → field must be present
 *           error: null            # null → field must be null
 *           message: "OK"         # any other value → strict equality
 *       capture:                   # save response values into vars
 *         auth.token: body.token   # vars path : response body path
 *         last_id: body.data[0].id
 */
async function runApiBlock(apiBlock, context, loader, opts) {
  const vars = loader.getAll();
  const method = (apiBlock.method ?? 'GET').toUpperCase();
  const url = loader.resolve(apiBlock.url);
  if (!url)
    throw new Error('api: block requires a url');

  // ---- Headers -----------------------------------------------------------
  const headers = {};

  // Inject auth token if available
  const token = _getPath(vars, 'auth.token');
  if (token)
    headers['Authorization'] = `Bearer ${token}`;

  if (apiBlock.headers) {
    for (const [k, v] of Object.entries(apiBlock.headers))
      headers[k] = loader.resolve(v);
  }

  // ---- Body --------------------------------------------------------------
  let postData;
  let contentType;
  if (apiBlock.body) {
    contentType = 'application/json';
    postData = JSON.stringify(loader.resolveDeep(apiBlock.body));
  } else if (apiBlock.form) {
    contentType = 'application/x-www-form-urlencoded';
    const resolved = loader.resolveDeep(apiBlock.form);
    postData = new URLSearchParams(resolved).toString();
  }

  if (contentType)
    headers['Content-Type'] = contentType;

  // ---- Request -----------------------------------------------------------
  const requestOptions = { method, headers };
  if (postData)
    requestOptions.data = postData;

  const response = await context.request.fetch(url, requestOptions);

  // ---- Parse response ----------------------------------------------------
  let responseBody;
  const ct = response.headers()['content-type'] ?? '';
  if (ct.includes('application/json')) {
    try { responseBody = await response.json(); } catch (_) { responseBody = null; }
  } else {
    responseBody = await response.text();
  }

  console.log(`     🌐 ${method} ${url} → ${response.status()}`);

  // ---- Assert ------------------------------------------------------------
  if (apiBlock.assert) {
    if (apiBlock.assert.status !== undefined) {
      const expectedStatus = parseInt(String(apiBlock.assert.status), 10);
      if (response.status() !== expectedStatus) {
        const bodyPreview = typeof responseBody === 'string'
          ? responseBody.slice(0, 200)
          : JSON.stringify(responseBody).slice(0, 200);
        throw new Error(
          `API assertion failed: expected status ${expectedStatus}, got ${response.status()}\n` +
          `Body: ${bodyPreview}`
        );
      }
    }

    if (apiBlock.assert.body && typeof responseBody === 'object' && responseBody !== null) {
      for (const [keyPath, expected] of Object.entries(apiBlock.assert.body)) {
        const actual = _getPath(responseBody, keyPath);
        if (expected === '__exists__') {
          if (actual === undefined)
            throw new Error(`API assertion failed: expected body.${keyPath} to exist, but it is undefined`);
        } else if (expected === null) {
          if (actual !== null)
            throw new Error(`API assertion failed: expected body.${keyPath} to be null, got ${JSON.stringify(actual)}`);
        } else {
          const resolvedExpected = loader.resolve(String(expected));
          if (String(actual) !== resolvedExpected) {
            throw new Error(
              `API assertion failed: body.${keyPath} — expected "${resolvedExpected}", got "${actual}"`
            );
          }
        }
      }
    }
  }

  // ---- Capture -----------------------------------------------------------
  if (apiBlock.capture) {
    for (const [varPath, srcPath] of Object.entries(apiBlock.capture)) {
      let value;
      if (srcPath.startsWith('body.') || srcPath === 'body') {
        const bodyPath = srcPath === 'body' ? '' : srcPath.slice(5);
        value = bodyPath ? _getPath(responseBody, bodyPath) : responseBody;
      } else if (srcPath === 'status') {
        value = response.status();
      } else if (srcPath.startsWith('headers.')) {
        const hName = srcPath.slice(8).toLowerCase();
        value = response.headers()[hName];
      } else {
        value = _getPath(responseBody, srcPath);
      }
      loader.set(varPath, value);
      console.log(`     📌 Captured ${varPath} = ${JSON.stringify(value)}`);
    }
  }

  return { status: response.status(), body: responseBody };
}

function _getPath(obj, dotPath) {
  if (!dotPath)
    return obj;
  const normalized = dotPath.replace(/\[(\d+)\]/g, '.$1');
  const parts = normalized.split('.');
  let cur = obj;
  for (const part of parts) {
    if (cur === null || cur === undefined)
      return undefined;
    cur = cur[part];
  }
  return cur;
}

module.exports = { runApiBlock };
