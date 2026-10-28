'use strict';

/**
 * BaseService — a thin wrapper around Playwright APIRequestContext
 * for structured API testing in JS helpers.
 *
 * Usage (in a helper file):
 *   const { BaseService } = require('synora-test');
 *
 *   const svc = new BaseService(context, 'https://api.example.com');
 *   const res = await svc.get('/users');
 *   svc.assertStatus(res, 200);
 *   const users = await res.json();
 */
class BaseService {
  /**
   * @param {import('playwright-core').BrowserContext} context
   * @param {string} baseUrl
   * @param {Record<string,string>} [defaultHeaders]
   */
  constructor(context, baseUrl = '', defaultHeaders = {}) {
    this._context = context;
    this._baseUrl = baseUrl.replace(/\/$/, '');
    this._defaultHeaders = defaultHeaders;
  }

  _url(path) {
    if (!path || path.startsWith('http'))
      return path;
    return `${this._baseUrl}${path.startsWith('/') ? '' : '/'}${path}`;
  }

  _headers(extra = {}) {
    return { ...this._defaultHeaders, ...extra };
  }

  // ---- HTTP methods --------------------------------------------------------

  async get(path, opts = {}) {
    return this._context.request.get(this._url(path), {
      headers: this._headers(opts.headers),
      timeout: opts.timeout ?? 30000,
    });
  }

  async post(path, body, opts = {}) {
    const isForm = opts.form === true;
    return this._context.request.post(this._url(path), {
      headers: this._headers({
        'Content-Type': isForm ? 'application/x-www-form-urlencoded' : 'application/json',
        ...(opts.headers ?? {}),
      }),
      data: isForm ? new URLSearchParams(body).toString() : JSON.stringify(body),
      timeout: opts.timeout ?? 30000,
    });
  }

  async put(path, body, opts = {}) {
    return this._context.request.put(this._url(path), {
      headers: this._headers({ 'Content-Type': 'application/json', ...(opts.headers ?? {}) }),
      data: JSON.stringify(body),
      timeout: opts.timeout ?? 30000,
    });
  }

  async patch(path, body, opts = {}) {
    return this._context.request.fetch(this._url(path), {
      method: 'PATCH',
      headers: this._headers({ 'Content-Type': 'application/json', ...(opts.headers ?? {}) }),
      data: JSON.stringify(body),
      timeout: opts.timeout ?? 30000,
    });
  }

  async delete(path, opts = {}) {
    return this._context.request.delete(this._url(path), {
      headers: this._headers(opts.headers),
      timeout: opts.timeout ?? 30000,
    });
  }

  // ---- Assertions ----------------------------------------------------------

  assertStatus(response, expectedStatus) {
    const actual = response.status();
    if (actual !== expectedStatus) {
      throw new Error(
        `Expected HTTP ${expectedStatus}, got ${actual} for ${response.url()}`
      );
    }
  }

  async assertBodyContains(response, keyPath, expectedValue) {
    const body = await response.json();
    const actual = _getPath(body, keyPath);
    if (actual === undefined) {
      throw new Error(`Response body does not contain key path "${keyPath}"`);
    }
    if (expectedValue !== undefined && String(actual) !== String(expectedValue)) {
      throw new Error(
        `Body assertion failed: ${keyPath} expected "${expectedValue}", got "${actual}"`
      );
    }
  }

  async assertBodyExists(response, keyPath) {
    const body = await response.json();
    const actual = _getPath(body, keyPath);
    if (actual === undefined)
      throw new Error(`Expected body.${keyPath} to exist, but it is undefined`);
  }

  async json(response) {
    return response.json();
  }
}

function _getPath(obj, dotPath) {
  const normalized = dotPath.replace(/\[(\d+)\]/g, '.$1');
  const parts = normalized.split('.');
  let cur = obj;
  for (const part of parts) {
    if (cur === null || cur === undefined) return undefined;
    cur = cur[part];
  }
  return cur;
}

module.exports = { BaseService };
