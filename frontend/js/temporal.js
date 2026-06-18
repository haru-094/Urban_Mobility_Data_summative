import { apiFetch, buildQuery } from './api.js';
import { fmt, fmtPct, destroyChart, charts } from './utils.js';
import { COLORS } from './config.js';

const rushHours = new Set([7, 8, 9, 16, 17, 18, 19]);
const weekendIdx = new Set([0, 6]);

export async function loadHourlyCharts() {
  const qs = buildQuery();
  const data = await apiFetch(`/api/trips/hourly${qs}`);
  if (!data.success) throw new Error(data.error || 'Failed to fetch hourly data');
  const rows = data.data;

  const fullHours = Array.from({ length: 24 }, (_, i) => i);
  const hourMap = Object.fromEntries(rows.map(r => [r.hour, r]));
  const hourLabels = fullHours.map(h => `${String(h).padStart(2, '0')}:00`);
  const tripCounts = fullHours.map(h => hourMap[h]?.trip_count ?? 0);
  const avgFares = fullHours.map(h => hourMap[h]?.avg_fare ?? 0);

  const barColors = fullHours.map(h =>
    rushHours.has(h) ? 'rgba(245, 158, 11, 0.75)' : 'rgba(37, 99, 235, 0.5)'
  );

  destroyChart('hourly');
  const hourlyCanvas = document.getElementById('chart-hourly');
  if (hourlyCanvas) {
    charts['hourly'] = new Chart(hourlyCanvas, {
      type: 'bar',
      data: {
        labels: hourLabels,
        datasets: [{
          label: 'Trips',
          data: tripCounts,
          backgroundColor: barColors,
          borderRadius: 2,
          borderSkipped: false,
        }],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: {
            callbacks: {
              label: ctx => ` ${fmt(ctx.parsed.y)} trips`,
              afterLabel: ctx => rushHours.has(fullHours[ctx.dataIndex]) ? 'Rush hour window' : '',
            },
          },
        },
        scales: {
          x: { grid: { display: false }, ticks: { color: '#4b5563', maxRotation: 45 } },
          y: {
            ticks: { color: '#6b7280', callback: v => fmt(v) },
          },
        },
      },
    });
  }

  destroyChart('hourly-fare');
  const fareCanvas = document.getElementById('chart-hourly-fare');
  if (fareCanvas) {
    charts['hourly-fare'] = new Chart(fareCanvas, {
      type: 'line',
      data: {
        labels: hourLabels,
        datasets: [{
          label: 'Avg Fare ($)',
          data: avgFares,
          borderColor: COLORS.green,
          backgroundColor: 'rgba(16, 185, 129, 0.05)',
          borderWidth: 1.5,
          pointRadius: 2,
          pointHoverRadius: 5,
          tension: 0.35,
          fill: true,
        }],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: { callbacks: { label: ctx => ` $${fmt(ctx.parsed.y, 2)}` } },
        },
        scales: {
          x: { grid: { display: false }, ticks: { color: '#4b5563', maxRotation: 45 } },
          y: {
            ticks: { color: '#6b7280', callback: v => '$' + v },
          },
        },
      },
    });
  }
}

export async function loadDailyChart() {
  const qs = buildQuery();
  const data = await apiFetch(`/api/trips/daily${qs}`);
  if (!data.success) throw new Error(data.error || 'Failed to fetch daily data');
  const rows = data.data;

  const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const dayMap = Object.fromEntries(rows.map(r => [r.day_of_week, r]));
  const counts = dayNames.map((_, i) => dayMap[i]?.trip_count ?? 0);

  const barBg = dayNames.map((_, i) =>
    weekendIdx.has(i) ? 'rgba(139, 92, 246, 0.6)' : 'rgba(37, 99, 235, 0.5)'
  );

  destroyChart('daily');
  const dailyCanvas = document.getElementById('chart-daily');
  if (dailyCanvas) {
    charts['daily'] = new Chart(dailyCanvas, {
      type: 'bar',
      data: {
        labels: dayNames,
        datasets: [{
          label: 'Trips',
          data: counts,
          backgroundColor: barBg,
          borderRadius: 3,
        }],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: {
            callbacks: {
              label: ctx => ` ${fmt(ctx.parsed.y)} trips`,
              afterLabel: ctx => weekendIdx.has(ctx.dataIndex) ? 'Weekend' : 'Weekday',
            },
          },
        },
        scales: {
          x: { grid: { display: false }, ticks: { color: '#4b5563' } },
          y: {
            ticks: { color: '#6b7280', callback: v => fmt(v) },
          },
        },
      },
    });
  }
}