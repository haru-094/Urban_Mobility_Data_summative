import { apiFetch, buildQuery } from './api.js';
import { fmt, fmtCurrency, fmtPct, fmtMiles, fmtSpeed, setKPI, destroyChart, charts } from './utils.js';
import { COLORS, BOROUGH_COLORS } from './config.js';

export async function loadSummary() {
  const qs = buildQuery();
  const data = await apiFetch(`/api/trips/summary${qs}`);
  if (!data.success) throw new Error(data.error || 'Failed to fetch summary data');
  const s = data.summary;

  setKPI('kpi-total-trips', fmt(s.total_trips));
  setKPI('kpi-avg-fare', fmtCurrency(s.avg_fare_usd));
  setKPI('kpi-avg-dist', fmtMiles(s.avg_distance_miles));
  setKPI('kpi-avg-speed', fmtSpeed(s.avg_speed_mph));
  setKPI('kpi-rush-pct', fmtPct(s.rush_hour_pct));
  setKPI('kpi-avg-tip', fmtPct(s.avg_tip_pct));

  const tripBadge = document.getElementById('trip-count-badge');
  if (tripBadge) {
    tripBadge.textContent = `${fmt(s.total_trips)} trips · Jan 2019`;
  }
}

export async function loadBoroughCharts() {
  const data = await apiFetch('/api/trips/by-borough');
  if (!data.success) throw new Error(data.error || 'Failed to fetch borough data');
  const rows = data.data;

  const labels = rows.map(r => r.borough);
  const trips = rows.map(r => r.total_trips);
  const fares = rows.map(r => r.avg_fare);
  const dists = rows.map(r => r.avg_distance);

  const bgColors = labels.map(l => BOROUGH_COLORS[l] || COLORS.slate);
  const bgAlpha = bgColors.map(c => c + '33');

  destroyChart('borough');
  const boroughCanvas = document.getElementById('chart-borough');
  if (boroughCanvas) {
    charts['borough'] = new Chart(boroughCanvas, {
      type: 'doughnut',
      data: {
        labels,
        datasets: [{
          data: trips,
          backgroundColor: bgAlpha,
          borderColor: bgColors,
          borderWidth: 1.5,
          hoverOffset: 8,
        }],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        cutout: '75%',
        plugins: {
          legend: { position: 'right' },
          tooltip: {
            callbacks: {
              label: ctx => ` ${fmt(ctx.parsed)} trips (${fmtPct((ctx.parsed / trips.reduce((a, b) => a + b, 0)) * 100)})`,
            },
          },
        },
      },
    });
  }

  destroyChart('borough-bar');
  const barCanvas = document.getElementById('chart-borough-bar');
  if (barCanvas) {
    charts['borough-bar'] = new Chart(barCanvas, {
      type: 'bar',
      data: {
        labels,
        datasets: [
          {
            label: 'Avg Fare ($)',
            data: fares,
            backgroundColor: 'rgba(37, 99, 235, 0.7)',
            borderColor: COLORS.blue,
            borderWidth: 1,
            borderRadius: 3,
          },
          {
            label: 'Avg Distance (mi)',
            data: dists,
            backgroundColor: 'rgba(107, 114, 128, 0.5)',
            borderColor: COLORS.gray,
            borderWidth: 1,
            borderRadius: 3,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        indexAxis: 'y',
        plugins: { legend: { position: 'top' } },
        scales: {
          x: { ticks: { color: '#6b7280' } },
          y: { grid: { display: false }, ticks: { color: '#4b5563' } },
        },
      },
    });
  }

  const tips = rows.map(r => r.avg_tip_pct);
  destroyChart('tip-borough');
  const tipCanvas = document.getElementById('chart-tip-borough');
  if (tipCanvas) {
    charts['tip-borough'] = new Chart(tipCanvas, {
      type: 'bar',
      data: {
        labels,
        datasets: [{
          label: 'Avg Tip %',
          data: tips,
          backgroundColor: labels.map(l => (BOROUGH_COLORS[l] || COLORS.slate) + '4d'),
          borderColor: labels.map(l => BOROUGH_COLORS[l] || COLORS.slate),
          borderWidth: 1,
          borderRadius: 4,
        }],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: { callbacks: { label: ctx => ` ${fmt(ctx.parsed, 2)}%` } },
        },
        scales: {
          x: { grid: { display: false }, ticks: { color: '#4b5563' } },
          y: {
            ticks: { color: '#6b7280', callback: v => v + '%' },
          },
        },
      },
    });
  }
}