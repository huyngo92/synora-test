'use strict';

const fs = require('fs');
const path = require('path');

// ---------------------------------------------------------------------------
// CSS — QC Light Design System
// ---------------------------------------------------------------------------
const _CSS = `
  @import url('https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@500;600;700&family=DM+Sans:ital,opsz,wght@0,9..40,400;0,9..40,500;0,9..40,600&display=swap');

  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

  :root {
    --navy: #03193A; --blue-700: #0A3D7A; --blue-600: #1059A8;
    --blue-500: #1A6FCA; --blue-400: #3B8FE8; --blue-50: #EBF3FF; --blue-100: #D4E7FF;
    --gray-900: #111318; --gray-700: #2D3340; --gray-500: #6B7485;
    --gray-400: #9AA3B0; --gray-300: #C2C8D1; --gray-200: #E0E4EA;
    --gray-150: #ECEEF2; --gray-100: #F4F5F7; --gray-50: #F9FAFB;
    --green-600: #0F9B58; --green-100: #E6F7EF;
    --red-600: #D03030;  --red-100: #FDEAEA;
    --amber-600: #C27D00; --amber-100: #FFF4DC;
    --c-surface: var(--gray-100); --c-canvas: #fff; --c-hover: var(--gray-50);
    --c-border: var(--gray-200); --c-divider: var(--gray-150);
    --c-text: var(--gray-900); --c-muted: var(--gray-500); --c-hint: var(--gray-400);
    --radius: 10px; --radius-sm: 6px; --radius-lg: 14px;
  }

  html { font-size: 16px; }
  body {
    font-family: 'DM Sans', -apple-system, BlinkMacSystemFont, sans-serif;
    font-size: 13.5px; line-height: 1.6;
    background: var(--c-surface); color: var(--c-text);
    -webkit-font-smoothing: antialiased;
  }

  /* ── TOPBAR ── */
  .topbar {
    background: var(--navy); color: #fff;
    padding: 0 24px; height: 52px; display: flex; align-items: center; gap: 12px;
    position: sticky; top: 0; z-index: 10;
  }
  .logo {
    font-family: 'Space Grotesk', sans-serif; font-size: 15px; font-weight: 700;
    color: #7AB8F5; flex-shrink: 0; display: flex; align-items: center; gap: 6px;
  }
  .topbar-title {
    font-size: 13.5px; font-weight: 500; flex: 1;
    overflow: hidden; text-overflow: ellipsis; white-space: nowrap; opacity: .85;
  }
  .topbar-meta { font-size: 12px; opacity: .5; white-space: nowrap; }
  .topbar-btn {
    display: inline-flex; align-items: center; gap: 6px; font-size: 12px;
    font-weight: 600; padding: 6px 14px; border-radius: 6px;
    background: var(--blue-600); color: #fff; border: none; cursor: pointer;
    text-decoration: none; flex-shrink: 0; transition: background .15s; font-family: inherit;
  }
  .topbar-btn:hover { background: var(--blue-500); }
  .topbar-btn svg { width: 13px; height: 13px; flex-shrink: 0; }

  /* ── SUMMARY BAR ── */
  .summary-bar {
    background: var(--c-canvas); border-bottom: 1px solid var(--c-border);
    padding: 14px 24px; display: flex; align-items: center; gap: 20px; flex-wrap: wrap;
  }
  .stat-block { display: flex; flex-direction: column; align-items: center; gap: 1px; min-width: 54px; }
  .stat-num {
    font-family: 'Space Grotesk', sans-serif; font-size: 24px; font-weight: 700; line-height: 1;
  }
  .stat-label {
    font-size: 11px; font-weight: 600; text-transform: uppercase;
    letter-spacing: .07em; color: var(--c-muted);
  }
  .stat-block.s-total .stat-num { color: var(--blue-700); }
  .stat-block.s-pass  .stat-num { color: var(--green-600); }
  .stat-block.s-fail  .stat-num { color: var(--red-600); }
  .stat-block.s-dur   .stat-num { color: var(--gray-700); }
  .stat-div { width: 1px; height: 32px; background: var(--c-border); flex-shrink: 0; }
  .progress-wrap { flex: 1; min-width: 100px; display: flex; align-items: center; gap: 10px; }
  .progress-track { flex: 1; height: 8px; background: var(--red-100); border-radius: 99px; overflow: hidden; min-width: 80px; }
  .progress-fill { height: 100%; border-radius: 99px; background: var(--green-600); transition: width .4s; }
  .progress-pct {
    font-family: 'Space Grotesk', sans-serif; font-size: 13px; font-weight: 600;
    color: var(--gray-700); white-space: nowrap; min-width: 36px;
  }

  /* ── FILTER BAR ── */
  .filter-bar {
    padding: 12px 24px; display: flex; gap: 8px; align-items: center; flex-wrap: wrap;
  }
  .pill {
    display: inline-flex; align-items: center; gap: 5px; padding: 5px 12px;
    border-radius: 99px; font-size: 12px; font-weight: 600; cursor: pointer; user-select: none;
    border: 1px solid var(--c-border); background: var(--c-canvas); color: var(--c-muted);
    transition: all .12s;
  }
  .pill:hover { border-color: var(--blue-400); color: var(--blue-500); }
  .pill.active { border-color: var(--blue-400); color: var(--blue-600); background: var(--blue-50); }
  .pill.p-pass.active { border-color: rgba(15,155,88,.3); color: var(--green-600); background: var(--green-100); }
  .pill.p-fail.active { border-color: rgba(208,48,48,.3); color: var(--red-600); background: var(--red-100); }
  .pill-dot { width: 7px; height: 7px; border-radius: 50%; }
  .pill-dot.pass { background: var(--green-600); }
  .pill-dot.fail { background: var(--red-600); }

  /* ── MAIN ── */
  .main { max-width: 960px; margin: 0 auto; padding: 16px 16px 48px; }

  /* ── GROUP CARD ── */
  .group {
    background: var(--c-canvas); border: 1px solid var(--c-border);
    border-radius: var(--radius-lg); margin-bottom: 12px; overflow: hidden;
  }
  .group-header {
    display: flex; align-items: center; gap: 10px; padding: 14px 16px;
    cursor: pointer; user-select: none; border-bottom: 1px solid transparent;
    transition: background .12s;
  }
  .group-header:hover { background: var(--c-hover); }
  .group.open .group-header { border-bottom-color: var(--c-border); }
  .group-name {
    font-family: 'Space Grotesk', sans-serif; font-size: 14px; font-weight: 600;
    color: var(--c-text); flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
  }
  .group-badge {
    font-size: 11px; font-weight: 700; padding: 3px 10px; border-radius: 99px; flex-shrink: 0;
  }
  .group-badge.pass { background: var(--green-100); color: var(--green-600); border: 1px solid rgba(15,155,88,.25); }
  .group-badge.fail { background: var(--red-100);   color: var(--red-600);   border: 1px solid rgba(208,48,48,.25); }
  .group-badge.skip { background: var(--amber-100); color: var(--amber-600); border: 1px solid rgba(194,125,0,.25); }
  .group-meta { font-size: 12px; color: var(--c-muted); white-space: nowrap; flex-shrink: 0; }
  .group-chevron { width: 16px; height: 16px; color: var(--c-hint); flex-shrink: 0; transition: transform .2s; }
  .group.open .group-chevron { transform: rotate(90deg); }
  .group-body { display: none; }
  .group.open .group-body { display: block; }

  /* ── TEST TABLE ── */
  .test-table { width: 100%; border-collapse: collapse; }
  .test-table td { padding: 9px 16px; border-bottom: 1px solid var(--c-divider); vertical-align: middle; }
  .test-table tr:last-child td { border-bottom: none; }
  .test-table tr.data-row { cursor: default; transition: background .1s; }
  .test-table tr.data-row.clickable { cursor: pointer; }
  .test-table tr.data-row.clickable:hover { background: var(--gray-50); }
  .test-table tr.data-row.open { background: var(--blue-50); }
  .td-status { width: 40px; text-align: center; }
  .status-badge {
    display: inline-flex; align-items: center; justify-content: center;
    width: 22px; height: 22px; border-radius: 99px; flex-shrink: 0;
  }
  .status-badge.pass { background: var(--green-100); }
  .status-badge.pass svg { color: var(--green-600); }
  .status-badge.fail { background: var(--red-100); }
  .status-badge.fail svg { color: var(--red-600); }
  .td-name {
    font-family: 'Cascadia Code', 'Fira Code', 'Consolas', monospace;
    font-size: 12px; color: var(--c-text);
  }
  .td-dur { width: 80px; text-align: right; font-size: 12px; color: var(--c-muted); white-space: nowrap; }
  .td-links { width: 72px; text-align: right; white-space: nowrap; }
  .trace-link { font-size: 11px; color: var(--blue-500); text-decoration: none; font-weight: 600; }
  .trace-link:hover { text-decoration: underline; }
  .td-expand { width: 28px; }
  .expand-icon { width: 14px; height: 14px; color: var(--c-hint); transition: transform .15s; }
  tr.data-row.open .expand-icon { transform: rotate(90deg); }

  /* ── DETAIL ROW ── */
  .detail-row td { background: var(--gray-50); padding: 0; }
  .detail-inner { padding: 14px 16px 14px 56px; }
  .error-block {
    background: var(--red-100); border-left: 3px solid var(--red-600);
    border-radius: 0 var(--radius-sm) var(--radius-sm) 0;
    padding: 10px 14px; font-family: 'Cascadia Code', 'Fira Code', 'Consolas', monospace;
    font-size: 12px; color: var(--red-600); overflow-x: auto; white-space: pre-wrap;
    word-break: break-all; line-height: 1.5; margin-bottom: 10px;
  }
  .screenshot-label {
    font-size: 11px; color: var(--c-muted); margin-bottom: 5px;
    font-weight: 600; text-transform: uppercase; letter-spacing: .05em;
  }
  .screenshot-wrap img {
    max-width: 100%; max-height: 320px; border-radius: var(--radius-sm);
    border: 1px solid var(--c-border); display: block;
  }
  .skipped-note { padding: 16px; color: var(--c-muted); font-style: italic; font-size: 13px; }

  /* ── STEP LIST ── */
  .step-list {
    border: 1px solid var(--c-border); border-radius: var(--radius-sm);
    background: var(--c-canvas); overflow: hidden; margin-bottom: 10px;
  }
  .step-row {
    display: flex; align-items: center; gap: 10px; padding: 6px 10px;
    border-bottom: 1px solid var(--c-divider); font-size: 12px;
  }
  .step-row:last-child { border-bottom: none; }
  .step-row .status-badge { width: 18px; height: 18px; }
  .step-row .status-badge svg { width: 10px; height: 10px; }
  .step-row .step-name {
    flex: 1; font-family: 'Cascadia Code', 'Fira Code', 'Consolas', monospace;
    color: var(--c-text); overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
  }
  .step-row .step-dur { color: var(--c-muted); white-space: nowrap; flex-shrink: 0; }
  .step-row.fail .step-name { color: var(--red-600); }

  /* ── FOOTER ── */
  footer { text-align: center; padding: 24px; font-size: 12px; color: var(--c-hint); }

  @media print {
    .topbar { position: static; }
    .group-body { display: block !important; }
    .detail-row { display: table-row !important; }
  }
`;

// ---------------------------------------------------------------------------
// JS embedded in report
// ---------------------------------------------------------------------------
const _JS = `
function filter(mode, el) {
  document.querySelectorAll('.pill').forEach(p => p.classList.remove('active'));
  el.classList.add('active');
  document.querySelectorAll('.test-table tr.data-row').forEach(tr => {
    tr.style.display = (mode === 'all' || tr.dataset.status === mode) ? '' : 'none';
  });
  document.querySelectorAll('.detail-row').forEach(dr => {
    const prev = dr.previousElementSibling;
    dr.style.display = (prev && prev.style.display === 'none') ? 'none' : '';
  });
}
function toggleGroup(header) {
  header.closest('.group').classList.toggle('open');
}
function toggleDetail(tr) {
  if (!tr.classList.contains('clickable')) return;
  const next = tr.nextElementSibling;
  if (!next || !next.classList.contains('detail-row')) return;
  const open = tr.classList.toggle('open');
  next.style.display = open ? '' : 'none';
}
function exportExcel() {
  const dataEl = document.getElementById('__report_json__');
  if (!dataEl) return;
  const data = JSON.parse(dataEl.textContent);
  const rows = [['Suite', 'Group', 'Test / Flow', 'Status', 'Duration (s)', 'Error']];
  const suite = data.suite || data.name || 'Suite';
  if (data.groups) {
    data.groups.forEach(g => {
      (g.results || []).forEach(r => {
        rows.push([suite, g.name || '', r.name, r.passed ? 'PASS' : 'FAIL',
          r.duration != null ? (r.duration / 1000).toFixed(2) : '', r.error || '']);
      });
    });
  } else {
    (data.results || []).forEach(r => {
      rows.push([suite, '', r.name, r.passed ? 'PASS' : 'FAIL',
        r.duration != null ? (r.duration / 1000).toFixed(2) : '', r.error || '']);
    });
  }
  /* Build CSV as fallback (no external lib needed) */
  const csv = rows.map(r => r.map(c => '"' + String(c).replace(/"/g,'""') + '"').join(',')).join('\\r\\n');
  const blob = new Blob(['\\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = (suite || 'synora-report').replace(/[^a-z0-9]/gi,'_') + '.csv';
  document.body.appendChild(a); a.click(); document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
`;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

const _ICON_PASS = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" style="width:12px;height:12px"><polyline points="20 6 9 17 4 12"/></svg>`;
const _ICON_FAIL = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" style="width:12px;height:12px"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>`;
const _ICON_CHEV = `<svg class="group-chevron" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="9 18 15 12 9 6"/></svg>`;
const _ICON_EXPAND = `<svg class="expand-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="9 18 15 12 9 6"/></svg>`;

function _buildTableRow(r, outputPath) {
  const status = r.passed ? 'pass' : 'fail';
  const dur = r.duration != null ? `${(r.duration / 1000).toFixed(2)}s` : '—';

  let traceHtml = '';
  if (r.traceFile && fs.existsSync(r.traceFile)) {
    const rel = path.relative(path.dirname(outputPath), r.traceFile);
    traceHtml = `<a class="trace-link" href="${escapeHtml(rel)}" onclick="event.stopPropagation()">Trace</a>`;
  }

  const badge = `<span class="status-badge ${status}">${r.passed ? _ICON_PASS : _ICON_FAIL}</span>`;

  const hasDetail = !!(r.error || (r.screenshot && fs.existsSync(r.screenshot)) || (r.steps && r.steps.length));

  const mainRow = `<tr class="data-row${hasDetail ? ' clickable' : ''}" data-status="${status}" onclick="toggleDetail(this)">
  <td class="td-status">${badge}</td>
  <td class="td-name">${escapeHtml(r.name)}</td>
  <td class="td-dur">${dur}</td>
  <td class="td-links">${traceHtml}</td>
  <td class="td-expand">${hasDetail ? _ICON_EXPAND : ''}</td>
</tr>`;

  if (!hasDetail) return mainRow;

  let detailContent = '';
  if (r.steps && r.steps.length) {
    const stepRows = r.steps.map(s => {
      const sStatus = s.status === 'pass' ? 'pass' : 'fail';
      const sBadge = `<span class="status-badge ${sStatus}">${s.status === 'pass' ? _ICON_PASS : _ICON_FAIL}</span>`;
      const sDur = s.durationMs != null ? `${(s.durationMs / 1000).toFixed(2)}s` : '—';
      const sName = `${s.index}. ${escapeHtml(s.cmd)}${s.preview ? ' ' + escapeHtml(s.preview) : ''}`;
      let shotHtml = '';
      if (s.screenshot && fs.existsSync(s.screenshot)) {
        const rel = path.relative(path.dirname(outputPath), s.screenshot);
        shotHtml = `<div class="screenshot-wrap"><img src="${escapeHtml(rel)}" alt="step screenshot"/></div>`;
      }
      return `<div class="step-row ${sStatus}">${sBadge}<span class="step-name">${sName}</span><span class="step-dur">${sDur}</span></div>${shotHtml}`;
    }).join('\n');
    detailContent += `<div class="screenshot-label">Steps</div><div class="step-list">${stepRows}</div>`;
  }
  if (r.error) detailContent += `<pre class="error-block">${escapeHtml(r.error)}</pre>`;
  if (r.screenshot && fs.existsSync(r.screenshot)) {
    const rel = path.relative(path.dirname(outputPath), r.screenshot);
    detailContent += `<div class="screenshot-label">Screenshot</div>
<div class="screenshot-wrap"><img src="${escapeHtml(rel)}" alt="screenshot"/></div>`;
  }

  return mainRow + `\n<tr class="detail-row" style="display:none">
  <td colspan="5"><div class="detail-inner">${detailContent}</div></td>
</tr>`;
}

function _buildGroupSection(g, outputPath) {
  const gPassed = (g.results || []).filter(r => r.passed).length;
  const gTotal = (g.results || []).length;
  const gFailed = gTotal - gPassed;
  const gDur = (g.results || []).reduce((s, r) => s + (r.duration ?? 0), 0);

  let badgeCls, badgeText;
  if (g.skipped) { badgeCls = 'skip'; badgeText = 'SKIPPED'; }
  else if (gFailed === 0) { badgeCls = 'pass'; badgeText = 'PASS'; }
  else { badgeCls = 'fail'; badgeText = `FAIL ${gFailed}`; }

  const body = g.skipped
    ? `<p class="skipped-note">⏭ Skipped — dependsOn: pass</p>`
    : `<table class="test-table">
${(g.results || []).map(r => _buildTableRow(r, outputPath)).join('\n')}
</table>`;

  return `<div class="group open">
  <div class="group-header" onclick="toggleGroup(this)">
    <span class="group-name">${escapeHtml(g.name ?? 'Group')}</span>
    <span class="group-badge ${badgeCls}">${badgeText}</span>
    <span class="group-meta">${gPassed}/${gTotal} passed &nbsp;·&nbsp; ${(gDur / 1000).toFixed(1)}s</span>
    ${_ICON_CHEV}
  </div>
  <div class="group-body">${body}</div>
</div>`;
}

function _pageFrame({ title, suiteName, ts, total, passed, failed, duration, filterBar, body, reportJson }) {
  const pct = total > 0 ? Math.round((passed / total) * 100) : 0;
  const durS = (duration / 1000).toFixed(1);
  const jsonData = JSON.stringify(reportJson).replace(/</g, '\\u003c');

  return `<!DOCTYPE html>
<html lang="vi">
<head>
  <meta charset="UTF-8"/>
  <meta name="viewport" content="width=device-width, initial-scale=1"/>
  <title>${escapeHtml(title)}</title>
  <style>${_CSS}</style>
</head>
<body>
  <!-- Embedded JSON for Excel export -->
  <script id="__report_json__" type="application/json">${jsonData}</script>

  <div class="topbar">
    <span class="logo">
      <svg viewBox="0 0 20 20" fill="currentColor" style="width:16px;height:16px">
        <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z"/>
      </svg>
      synora-test
    </span>
    <span class="topbar-title">${escapeHtml(suiteName)}</span>
    <span class="topbar-meta">${escapeHtml(ts)}</span>
    <button class="topbar-btn" onclick="exportExcel()">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/>
        <polyline points="7 10 12 15 17 10"/>
        <line x1="12" y1="15" x2="12" y2="3"/>
      </svg>
      Xuất Excel
    </button>
  </div>

  <div class="summary-bar">
    <div class="stat-block s-total">
      <span class="stat-num">${total}</span>
      <span class="stat-label">Total</span>
    </div>
    <div class="stat-div"></div>
    <div class="stat-block s-pass">
      <span class="stat-num">${passed}</span>
      <span class="stat-label">Passed</span>
    </div>
    <div class="stat-div"></div>
    <div class="stat-block s-fail">
      <span class="stat-num">${failed}</span>
      <span class="stat-label">Failed</span>
    </div>
    <div class="stat-div"></div>
    <div class="stat-block s-dur">
      <span class="stat-num">${durS}s</span>
      <span class="stat-label">Duration</span>
    </div>
    <div class="stat-div"></div>
    <div class="progress-wrap">
      <div class="progress-track">
        <div class="progress-fill" style="width:${pct}%"></div>
      </div>
      <span class="progress-pct">${pct}%</span>
    </div>
  </div>

  <div class="filter-bar">
    <span class="pill active" onclick="filter('all',this)">Tất cả <strong>${total}</strong></span>
    <span class="pill p-pass" onclick="filter('pass',this)">
      <span class="pill-dot pass"></span>Passed <strong>${passed}</strong>
    </span>
    <span class="pill p-fail" onclick="filter('fail',this)">
      <span class="pill-dot fail"></span>Failed <strong>${failed}</strong>
    </span>
    ${filterBar || ''}
  </div>

  <div class="main">
    ${body || '<p style="text-align:center;padding:40px;color:var(--c-muted)">Không có kết quả</p>'}
  </div>

  <footer>synora-test &bull; make by huy.ngolong &bull; huyngo92</footer>
  <script>${_JS}</script>
</body>
</html>`;
}

// ---------------------------------------------------------------------------
// Flat HTML report (synora-test run)
// ---------------------------------------------------------------------------
function generateHtmlReport(results, outputPath) {
  const total = results.length;
  const passed = results.filter(r => r.passed).length;
  const failed = total - passed;
  const duration = results.reduce((s, r) => s + (r.duration ?? 0), 0);
  const ts = new Date().toLocaleString('vi-VN');

  const reportJson = {
    suite: path.basename(outputPath, path.extname(outputPath)),
    summary: { total, passed, failed, duration, timestamp: new Date().toISOString() },
    results: results.map(r => ({
      name: r.name, passed: r.passed, duration: r.duration ?? null,
      ...(r.error ? { error: r.error } : {}),
    })),
  };

  const fakeGroup = { name: 'Test Results', skipped: false, results };
  const body = _buildGroupSection(fakeGroup, outputPath);

  const html = _pageFrame({
    title: 'synora-test Report',
    suiteName: 'Test Report',
    ts, total, passed, failed, duration, body, reportJson,
  });

  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, html, 'utf8');
}

function generateJsonReport(results, outputPath) {
  const total = results.length;
  const passed = results.filter(r => r.passed).length;
  const report = {
    summary: {
      total, passed, failed: total - passed,
      duration: results.reduce((s, r) => s + (r.duration ?? 0), 0),
      timestamp: new Date().toISOString(),
    },
    results: results.map(r => {
      const out = { name: r.name, passed: r.passed, duration: r.duration ?? null };
      if (r.error) out.error = r.error;
      if (r.screenshot) out.screenshot = path.relative(path.dirname(outputPath), r.screenshot);
      if (r.traceFile) out.traceFile = path.relative(path.dirname(outputPath), r.traceFile);
      return out;
    }),
  };
  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, JSON.stringify(report, null, 2), 'utf8');
}

// ---------------------------------------------------------------------------
// Grouped HTML report (synora-test suite)
// ---------------------------------------------------------------------------
function generateGroupedHtmlReport(suiteName, groups, outputPath) {
  const allResults = groups.flatMap(g => g.results || []);
  const total = allResults.length;
  const passed = allResults.filter(r => r.passed).length;
  const failed = total - passed;
  const duration = allResults.reduce((s, r) => s + (r.duration ?? 0), 0);
  const ts = new Date().toLocaleString('vi-VN');

  const reportJson = {
    suite: suiteName,
    summary: { total, passed, failed, duration, timestamp: new Date().toISOString() },
    groups: groups.map(g => ({
      name: g.name, skipped: g.skipped ?? false,
      summary: {
        total: (g.results || []).length,
        passed: (g.results || []).filter(r => r.passed).length,
        failed: (g.results || []).filter(r => !r.passed).length,
        duration: (g.results || []).reduce((s, r) => s + (r.duration ?? 0), 0),
      },
      results: (g.results || []).map(r => ({
        name: r.name, passed: r.passed, duration: r.duration ?? null,
        ...(r.error ? { error: r.error } : {}),
      })),
    })),
  };

  const body = groups.map(g => _buildGroupSection(g, outputPath)).join('\n');

  const html = _pageFrame({
    title: suiteName + ' — synora-test',
    suiteName, ts, total, passed, failed, duration, body, reportJson,
  });

  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, html, 'utf8');
}

function generateGroupedJsonReport(suiteName, groups, outputPath) {
  const allResults = groups.flatMap(g => g.results || []);
  const total = allResults.length;
  const passed = allResults.filter(r => r.passed).length;

  const report = {
    suite: suiteName,
    summary: {
      total, passed, failed: total - passed,
      duration: allResults.reduce((s, r) => s + (r.duration ?? 0), 0),
      timestamp: new Date().toISOString(),
    },
    groups: groups.map(g => ({
      name: g.name,
      skipped: g.skipped ?? false,
      summary: {
        total: (g.results || []).length,
        passed: (g.results || []).filter(r => r.passed).length,
        failed: (g.results || []).filter(r => !r.passed).length,
        duration: (g.results || []).reduce((s, r) => s + (r.duration ?? 0), 0),
      },
      results: (g.results || []).map(r => {
        const out = { name: r.name, passed: r.passed, duration: r.duration ?? null };
        if (r.error) out.error = r.error;
        if (r.screenshot) out.screenshot = path.relative(path.dirname(outputPath), r.screenshot);
        if (r.traceFile) out.traceFile = path.relative(path.dirname(outputPath), r.traceFile);
        return out;
      }),
    })),
  };

  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, JSON.stringify(report, null, 2), 'utf8');
}


module.exports = { generateHtmlReport, generateJsonReport, generateGroupedHtmlReport, generateGroupedJsonReport };
