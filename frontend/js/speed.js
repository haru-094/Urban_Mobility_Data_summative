import { apiFetch, buildQuery } from './api.js';
import { fmt, destroyChart, charts } from './utils.js';
import { COLORS } from './config.js';

const rushHours = new Set([7, 8, 9, 16, 17, 18, 19]);

export async function loadSpeedCharts() {
  const qs = buildQuery();
  const [speedData, hourlyData] = await Promise.all([
    apiFetch(`/api/trips/speed-analysis${qs}`),
    apiFetch(`/api/trips/hourly${qs}`),
  ]);
  if (!speedData.success) throw new Error(speedData.error || 'Failed to fetch speed analysis');

  const fullHours = Array.from({ length: 24 }, (_, i) => i);
  const hourLabels = fullHours.map(h => `${String(h).padStart(2, '0')}:00`);

  const speedMap = Object.fromEntries(speedData.data.map(r => [r.hour, r]));
  const hourMap2 = Object.fromEntries((hourlyData.data || []).map(r => [r.hour, r]));

  const speeds = fullHours.map(h => speedMap[h]?.avg_speed_mph ?? null);
  const volumes = fullHours.map(h => hourMap2[h]?.trip_count ?? 0);

  destroyChart('speed');
  const speedCanvas = document.getElementById('chart-speed');
  if (speedCanvas) {
    charts['speed'] = new Chart(speedCanvas, {
      type: 'line',
      data: {
        labels: hourLabels,
        datasets: [{
          label: 'Avg Speed (mph)',
          data: speeds,
          borderColor: COLORS.blue,
          backgroundColor: 'rgba(37, 99, 235, 0.04)',
          borderWidth: 1.5,
          pointRadius: fullHours.map(h => rushHours.has(h) ? 4 : 2),
          pointBackgroundColor: fullHours.map(h => rushHours.has(h) ? COLORS.red : COLORS.blue),
          tension: 0.35,
          fill: true,
          spanGaps: true,
        }],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: {
            callbacks: {
              label: ctx => ` ${ctx.parsed.y != null ? fmt(ctx.parsed.y, 1) + ' mph' : 'N/A'}`,
              afterLabel: ctx => rushHours.has(fullHours[ctx.dataIndex]) ? 'Rush hour — expect congestion' : '',
            },
          },
        },
        scales: {
          x: { grid: { display: false }, ticks: { color: '#4b5563', maxRotation: 45 } },
          y: {
            ticks: { color: '#6b7280', callback: v => v + ' mph' },
            suggestedMin: 0,
          },
        },
      },
    });
  }

  destroyChart('speed-volume');
  const speedVolumeCanvas = document.getElementById('chart-speed-volume');
  if (speedVolumeCanvas) {
    charts['speed-volume'] = new Chart(speedVolumeCanvas, {
      type: 'bar',
      data: {
        labels: hourLabels,
        datasets: [
          {
            type: 'bar',
            label: 'Trips',
            data: volumes,
            backgroundColor: 'rgba(107, 114, 128, 0.2)',
            borderColor: COLORS.gray,
            borderWidth: 1,
            borderRadius: 2,
            yAxisID: 'yVolume',
          },
          {
            type: 'line',
            label: 'Speed (mph)',
            data: speeds,
            borderColor: COLORS.blue,
            borderWidth: 1.5,
            pointRadius: 1.5,
            tension: 0.35,
            fill: false,
            yAxisID: 'ySpeed',
            spanGaps: true,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        interaction: { mode: 'index', intersect: false },
        plugins: { legend: { position: 'top' } },
        scales: {
          x: { grid: { display: false }, ticks: { color: '#4b5563', maxRotation: 45 } },
          yVolume: {
            type: 'linear',
            position: 'left',
            ticks: { color: '#6b7280', callback: v => fmt(v) },
          },
          ySpeed: {
            type: 'linear',
            position: 'right',
            grid: { display: false },
            ticks: { color: COLORS.blue, callback: v => v + ' mph' },
            suggestedMin: 0,
          },
        },
      },
    });
  }

  await loadCongestionChart();
}

export async function loadCongestionChart() {
  const data = await apiFetch('/api/trips/by-borough');
  if (!data.success) throw new Error(data.error || 'Failed to fetch congestion data');
  const rows = data.data;

  const labels = rows.map(r => r.borough);
  const rushTrips = rows.map(r => r.rush_hour_trips);
  const totalTrips = rows.map(r => r.total_trips);
  const offPeak = totalTrips.map((t, i) => t - rushTrips[i]);

  destroyChart('congestion');
  const congestionCanvas = document.getElementById('chart-congestion');
  if (congestionCanvas) {
    charts['congestion'] = new Chart(congestionCanvas, {
      type: 'bar',
      data: {
        labels,
        datasets: [
          {
            label: 'Rush Hour Trips',
            data: rushTrips,
            backgroundColor: 'rgba(239, 68, 68, 0.65)',
            borderColor: COLORS.red,
            borderWidth: 1,
            borderRadius: 3,
          },
          {
            label: 'Off-Peak Trips',
            data: offPeak,
            backgroundColor: 'rgba(107, 114, 128, 0.4)',
            borderColor: COLORS.gray,
            borderWidth: 1,
            borderRadius: 3,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { position: 'top' } },
        scales: {
          x: { grid: { display: false }, ticks: { color: '#4b5563' } },
          y: {
            stacked: false,
            ticks: { color: '#6b7280', callback: v => fmt(v) },
          },
        },
      },
    });
  }
}