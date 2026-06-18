import { apiFetch } from './api.js';
import { fmt } from './utils.js';

export async function loadTransparency() {
  const data = await apiFetch('/api/transparency');
  if (!data.success) throw new Error(data.error || 'Failed to fetch transparency report');
  const r = data.report;
  const a = r.anomalies_detected;

  const cards = [
    {
      label: 'Records Ingested',
      value: fmt(r.total_records_ingested),
      sub: 'Raw rows before cleaning'
    },
    {
      label: 'Records Retained',
      value: fmt(r.final_clean_records_retained),
      sub: `${r.data_retention_percentage}% retention rate`
    },
    {
      label: 'Missing Values',
      value: fmt(a.missing_values_scrubbed ?? 0),
      sub: 'Null timestamps / fare / distance'
    },
    {
      label: 'Temporal Violations',
      value: fmt(a.temporal_violations ?? 0),
      sub: 'Wrong year or negative duration'
    },
    {
      label: 'Fare/Dist Outliers',
      value: fmt(a.fare_or_distance_outliers ?? Object.values(a).find((v, i) => Object.keys(a)[i].includes('outlier')) ?? 0),
      sub: 'Distance > 100mi or fare <= 0'
    },
    {
      label: 'Speed Glitches',
      value: fmt(a.unrealistic_speed_glitches ?? 0),
      sub: 'Derived speed > 80 mph'
    },
  ];

  const grid = document.getElementById('transparency-grid');
  if (grid) {
    grid.innerHTML = cards.map(c => `
      <div class="transparency-card">
        <span class="t-label">${c.label}</span>
        <span class="t-value">${c.value}</span>
        <span class="t-sub">${c.sub}</span>
      </div>
    `).join('');
  }
}