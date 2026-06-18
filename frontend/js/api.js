export const charts = {};

export function fmt(n, decimals = 0) {
  if (n == null || isNaN(n)) return '—';
  return Number(n).toLocaleString('en-US', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}

export function fmtCurrency(n) {
  if (n == null || isNaN(n)) return '—';
  return '$' + fmt(n, 2);
}

export function fmtPct(n) {
  if (n == null || isNaN(n)) return '—';
  return fmt(n, 1) + '%';
}

export function fmtMiles(n) {
  if (n == null || isNaN(n)) return '—';
  return fmt(n, 2) + ' mi';
}

export function fmtSpeed(n) {
  if (n == null || isNaN(n)) return '—';
  return fmt(n, 1) + ' mph';
}

export function destroyChart(id) {
  if (charts[id]) {
    charts[id].destroy();
    delete charts[id];
  }
}

export function setOverlay(visible) {
  const overlay = document.getElementById('loading-overlay');
  if (overlay) {
    overlay.classList.toggle('hidden', !visible);
  }
}

export function showToast(msg, duration = 3500) {
  const el = document.getElementById('toast');
  if (!el) return;
  el.textContent = msg;
  el.classList.add('show');
  setTimeout(() => el.classList.remove('show'), duration);
}

export function setKPI(id, text) {
  const el = document.getElementById(id);
  if (!el) return;
  el.textContent = text;
  el.classList.remove('animate');
  void el.offsetWidth;
  el.classList.add('animate');
}

export function setStatus(state, text) {
  const dot = document.getElementById('status-dot');
  const span = document.getElementById('status-text');
  if (dot) dot.className = 'status-dot ' + state;
  if (span) span.textContent = text;
}