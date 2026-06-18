import { apiFetch, buildQuery } from './api.js';
import { fmt, fmtPct, destroyChart, charts } from './utils.js';

export async function loadFareDistribution() {
  const qs = buildQuery();
  const data = await apiFetch(`/api/trips/fare-distribution${qs}`);
  if (!data.success) throw new Error(data.error || 'Failed to fetch fare distribution');
  const rows = data.data;

  const labels = rows.map(r => `$${r.fare_bucket}`);
  const counts = rows.map(r => r.trip_count);
  const max = Math.max(...counts);

  const bgCols = counts.map(c => {
    const ratio = c / max;
    if (ratio > 0.7) return 'rgba(37, 99, 235, 0.8)';
    if (ratio > 0.3) return 'rgba(37, 99, 235, 0.55)';
    return 'rgba(37, 99, 235, 0.3)';
  });

  destroyChart('fare-dist');
  const fareDistCanvas = document.getElementById('chart-fare-dist');
  if (fareDistCanvas) {
    charts['fare-dist'] = new Chart(fareDistCanvas, {
      type: 'bar',
      data: {
        labels,
        datasets: [{
          label: 'Trips in Range',
          data: counts,
          backgroundColor: bgCols,
          borderRadius: 2,
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
              afterLabel: ctx => `${fmtPct((ctx.parsed.y / counts.reduce((a, b) => a + b, 0)) * 100)} of total`,
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