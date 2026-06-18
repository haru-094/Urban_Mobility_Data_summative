import { configureChartDefaults } from './config.js';
import { fmt, setOverlay, showToast, setStatus } from './utils.js';
import { apiFetch } from './api.js';
import { loadSummary, loadBoroughCharts } from './overview.js';
import { loadHourlyCharts, loadDailyChart } from './temporal.js';
import { loadTopZones, updateZoneType, updateZoneLimit, sortZonesTable } from './geography.js';
import { loadFareDistribution } from './economics.js';
import { loadSpeedCharts } from './speed.js';
import { loadTransparency } from './transparency.js';

async function loadFilteredData() {
  const spinner = document.getElementById('btn-spinner');
  const btn = document.getElementById('btn-apply');

  if (btn) btn.disabled = true;
  if (spinner) spinner.hidden = false;

  setStatus('loading', 'Loading…');

  try {
    await Promise.all([
      loadSummary(),
      loadHourlyCharts(),
      loadDailyChart(),
      loadTopZones(),
      loadFareDistribution(),
      loadSpeedCharts(),
    ]);
    setStatus('online', 'Live');
    showToast('Dashboard updated');
  } catch (err) {
    console.error('Error loading filtered data:', err);
    setStatus('error', 'Error');
    showToast(err.message);
  } finally {
    if (btn) btn.disabled = false;
    if (spinner) spinner.hidden = true;
  }
}

async function initialLoad() {
  setStatus('loading', 'Connecting…');
  try {
    const health = await apiFetch('/api/health');
    if (!health.success) throw new Error('Backend unhealthy');

    await Promise.all([
      loadFilteredData(),
      loadBoroughCharts(),
      loadTransparency(),
    ]);

    setStatus('online', `${fmt(health.total_trips_in_db)} trips loaded`);
  } catch (err) {
    console.error('Bootstrap error:', err);
    setStatus('error', 'Backend offline');
    showToast('Cannot reach backend at localhost:5000. Is Flask running?', 6000);
  } finally {
    setOverlay(false);
  }
}

document.addEventListener('DOMContentLoaded', () => {
  configureChartDefaults();

  const btnApply = document.getElementById('btn-apply');
  if (btnApply) {
    btnApply.addEventListener('click', loadFilteredData);
  }

  const btnReset = document.getElementById('btn-reset');
  if (btnReset) {
    btnReset.addEventListener('click', () => {
      const bSelect = document.getElementById('filter-borough');
      const rSelect = document.getElementById('filter-rush');
      if (bSelect) bSelect.value = '';
      if (rSelect) rSelect.value = '';
      loadFilteredData();
    });
  }

  document.querySelectorAll('.toggle-btn[data-type]').forEach(btn => {
    btn.addEventListener('click', async () => {
      document.querySelectorAll('.toggle-btn[data-type]').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      await updateZoneType(btn.dataset.type);
    });
  });

  const zoneLimit = document.getElementById('zone-limit');
  if (zoneLimit) {
    zoneLimit.addEventListener('change', async (e) => {
      await updateZoneLimit(e.target.value);
    });
  }

  document.querySelectorAll('.data-table th.sortable').forEach(th => {
    th.addEventListener('click', () => {
      const col = th.dataset.col;
      sortZonesTable(col);
      document.querySelectorAll('.data-table th').forEach(h => h.classList.remove('active-sort'));
      th.classList.add('active-sort');
    });
  });

  const sectionEls = document.querySelectorAll('.section');
  const navLinks = document.querySelectorAll('.nav-link[data-section]');

  if (sectionEls.length && navLinks.length) {
    const observer = new IntersectionObserver(entries => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          navLinks.forEach(l => l.classList.remove('active'));
          const activeLink = document.querySelector(`.nav-link[data-section="${entry.target.id}"]`);
          if (activeLink) activeLink.classList.add('active');
        }
      });
    }, { rootMargin: '-30% 0px -60% 0px', threshold: 0 });

    sectionEls.forEach(el => observer.observe(el));
  }

  initialLoad();
});