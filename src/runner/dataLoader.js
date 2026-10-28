'use strict';

const fs = require('fs');
const path = require('path');

/**
 * DataLoader — loads test data from JSON/CSV files and resolves ${...} interpolation.
 *
 * Variable syntax:
 *   ${key}                  — look up key in vars map
 *   ${a.b.c}               — nested path lookup
 *   ${data.users[0].name}  — array index supported
 *   ${ENV_VAR}              — falls back to process.env if not in vars
 *   ${KEY:-default}         — default value if key is missing
 */
class DataLoader {
  constructor(flowDir) {
    this._flowDir = flowDir; // directory of the YAML file being run
    this._vars = {};         // flat runtime var store
  }

  /** Load a data file and merge into vars under the given namespace */
  loadFile(filePath, namespace) {
    const absPath = path.isAbsolute(filePath)
      ? filePath
      : path.resolve(this._flowDir, filePath);

    if (!fs.existsSync(absPath))
      throw new Error(`Data file not found: ${absPath}`);

    const ext = path.extname(absPath).toLowerCase();
    let data;
    if (ext === '.json') {
      data = JSON.parse(fs.readFileSync(absPath, 'utf-8'));
    } else if (ext === '.csv') {
      data = _parseCsv(fs.readFileSync(absPath, 'utf-8'));
    } else {
      throw new Error(`Unsupported data file format: ${ext} (supported: .json, .csv)`);
    }

    if (namespace)
      this.set(namespace, data);
    else
      Object.assign(this._vars, typeof data === 'object' && !Array.isArray(data) ? data : { data });
  }

  /** Set a variable at a dot-notation path */
  set(path, value) {
    _setPath(this._vars, path, value);
  }

  /** Get a variable at a dot-notation path */
  get(dotPath) {
    return _getPath(this._vars, dotPath);
  }

  /** Get the full vars snapshot */
  getAll() {
    return this._vars;
  }

  /**
   * Resolve all ${...} interpolations in a string.
   * Returns the original value if it's not a string.
   */
  resolve(value) {
    if (typeof value !== 'string')
      return value;

    return value.replace(/\$\{([^}]+)\}/g, (match, expr) => {
      // Handle ${KEY:-default}
      const [keyPart, ...rest] = expr.split(':-');
      const defaultVal = rest.join(':-'); // in case default itself has :-
      const key = keyPart.trim();

      // Try vars first, then process.env
      let resolved = _getPath(this._vars, key);
      if (resolved === undefined)
        resolved = process.env[key];
      if (resolved === undefined)
        resolved = defaultVal !== undefined ? defaultVal : match; // keep original if unresolved

      return String(resolved);
    });
  }

  /** Recursively resolve all ${...} in an object/array/string */
  resolveDeep(obj) {
    if (typeof obj === 'string')
      return this.resolve(obj);
    if (Array.isArray(obj))
      return obj.map(item => this.resolveDeep(item));
    if (obj !== null && typeof obj === 'object') {
      const result = {};
      for (const [k, v] of Object.entries(obj))
        result[k] = this.resolveDeep(v);
      return result;
    }
    return obj;
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function _getPath(obj, dotPath) {
  // Support array indexing: users[0].name → users.0.name
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

function _setPath(obj, dotPath, value) {
  const normalized = dotPath.replace(/\[(\d+)\]/g, '.$1');
  const parts = normalized.split('.');
  let cur = obj;
  for (let i = 0; i < parts.length - 1; i++) {
    const p = parts[i];
    if (cur[p] === undefined || typeof cur[p] !== 'object')
      cur[p] = {};
    cur = cur[p];
  }
  cur[parts[parts.length - 1]] = value;
}

function _parseCsv(content) {
  const lines = content.trim().split('\n');
  if (lines.length < 2) return [];
  const headers = lines[0].split(',').map(h => h.trim().replace(/^"|"$/g, ''));
  return lines.slice(1).map(line => {
    const values = line.split(',').map(v => v.trim().replace(/^"|"$/g, ''));
    const row = {};
    headers.forEach((h, i) => { row[h] = values[i] ?? ''; });
    return row;
  });
}

module.exports = { DataLoader };
