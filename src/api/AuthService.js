'use strict';

const { BaseService } = require('./BaseService');

/**
 * AuthService — handles authentication and stores tokens for reuse.
 *
 * Usage (in a JS helper):
 *   const { AuthService } = require('synora-test');
 *
 *   const auth = new AuthService(context, 'https://api.example.com');
 *   await auth.login('/auth/login', { username: 'admin', password: 'secret' });
 *
 *   // Subsequent requests with auth headers
 *   const api = new BaseService(context, 'https://api.example.com', auth.getHeaders());
 *   const res = await api.get('/protected-resource');
 */
class AuthService extends BaseService {
  constructor(context, baseUrl = '', defaultHeaders = {}) {
    super(context, baseUrl, defaultHeaders);
    this._token = null;
    this._tokenType = 'Bearer';
  }

  /**
   * POST to loginUrl with credentials, extract token from response.
   * @param {string} loginPath   e.g. '/auth/login'
   * @param {object} credentials e.g. { username, password }
   * @param {object} opts
   * @param {string} [opts.tokenPath='token']   dot-path to token in response body
   * @param {string} [opts.tokenType='Bearer']  token prefix
   * @param {boolean} [opts.form=false]         send as form-encoded
   */
  async login(loginPath, credentials, opts = {}) {
    const res = await this.post(loginPath, credentials, { form: opts.form ?? false });
    const expectedStatus = opts.expectedStatus ?? 200;
    this.assertStatus(res, expectedStatus);

    const body = await res.json();
    const tokenPath = opts.tokenPath ?? 'token';
    const token = _getPath(body, tokenPath);

    if (!token)
      throw new Error(`AuthService.login: token not found at path "${tokenPath}" in response body`);

    this._token = token;
    this._tokenType = opts.tokenType ?? 'Bearer';
    return token;
  }

  /**
   * Set token manually (e.g. from env var or a previous YAML capture).
   */
  setToken(token, type = 'Bearer') {
    this._token = token;
    this._tokenType = type;
  }

  /** Returns headers object with Authorization header */
  getHeaders() {
    if (!this._token) return {};
    return { Authorization: `${this._tokenType} ${this._token}` };
  }

  get token() {
    return this._token;
  }

  /**
   * Return a new BaseService pre-configured with auth headers.
   */
  createAuthorizedService(baseUrl) {
    return new BaseService(
      this._context,
      baseUrl ?? this._baseUrl,
      { ...this.getHeaders() }
    );
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

module.exports = { AuthService };
