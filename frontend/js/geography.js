import { apiFetch, buildQuery } from './api.js';
import { fmt, fmtCurrency, fmtMiles, destroyChart, charts } from './utils.js';
import { BOROUGH_COLORS, COLORS } from './config.js';

let currentZoneType = 'pickup';
let currentZoneLimit = 10;
let currentZoneData = [];
let zoneSortCol = 'total_trips';
let zoneSortAsc = false;

export function getZoneType() { return currentZoneType; }
export function getZoneLimit() { return currentZoneLimit; }
export function getZoneData() { return currentZoneData; }
export function getZoneSortCol() { return zoneSortCol; }
export function getZoneSortAsc() { return zoneSortAsc; }

export async function loadTopZones() {
  const qs = buildQuery({ type: currentZoneType, limit: currentZoneLimit });
  const data = await apiFetch(`/api/trips/top-zones${qs}`);
  if (!data.success) throw new Error(data.error || 'Failed to fetch top zones');
  currentZoneData = data.data;
  renderZonesChart(currentZoneData);
  renderZonesTable(currentZoneData);
}

export async function updateZoneType(type) {
  currentZoneType = type;
  updateChartTitle();
  await loadTopZones();
}

export async function updateZoneLimit(limit) {
  currentZoneLimit = parseInt(limit);
  updateChartTitle();
  await loadTopZones();
}

export function sortZonesTable(col) {
  if (zoneSortCol === col) {
    zoneSortAsc = !zoneSortAsc;
  } else {
    zoneSortCol = col;
    zoneSortAsc = false;
  }
  renderZonesTable(currentZoneData);
}

function updateChartTitle() {
  const titleEl = document.getElementById('zone-chart-title');
  if (titleEl) {
    const typeLabel = currentZoneType === 'pickup' ? 'Pickup' : 'Drop-off';
    titleEl.textContent = `Top ${currentZoneLimit} ${typeLabel} Zones`;
  }
}

function renderZonesChart(rows) {
  const labels = rows.map(r => r.zone.length > 22 ? r.zone.slice(0, 20) + '…' : r.zone);
  const trips = rows.map(r => r.total_trips);

  const bgCols = rows.map(r => (BOROUGH_COLORS[r.borough] || COLORS.slate) + '33');
  const borderCols = rows.map(r => BOROUGH_COLORS[r.borough] || COLORS.slate);

  destroyChart('zones');
  const zonesCanvas = document.getElementById('chart-zones');
  if (zonesCanvas) {
    charts['zones'] = new Chart(zonesCanvas, {
      type: 'bar',
      data: {
        labels,
        datasets: [{
          label: 'Total Trips',
          data: trips,
          backgroundColor: bgCols,
          borderColor: borderCols,
          borderWidth: 1,
          borderRadius: 2,
        }],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        indexAxis: 'y',
        plugins: {
          legend: { display: false },
          tooltip: {
            callbacks: {
              label: ctx => ` ${fmt(ctx.parsed.x)} trips`,
              afterLabel: ctx => `Borough: ${rows[ctx.dataIndex].borough}`,
            },
          },
        },
        scales: {
          x: { ticks: { color: '#6b7280', callback: v => fmt(v) } },
          y: { grid: { display: false }, ticks: { color: '#4b5563', font: { size: 10 } } },
        },
      },
    });
  }
}

function renderZonesTable(rows) {
  const sorted = [...rows].sort((a, b) => {
    const av = a[zoneSortCol];
    const bv = b[zoneSortCol];
    const cmp = typeof av === 'string' ? av.localeCompare(bv) : (av - bv);
    return zoneSortAsc ? cmp : -cmp;
  });

  const tbody = document.getElementById('zones-tbody');
  if (!tbody) return;

  tbody.innerHTML = sorted.map((r, i) => {
    const rankClass = i < 3 ? `rank-${i + 1}` : '';
    const bColor = BOROUGH_COLORS[r.borough] || '#4b5563';
    return `
      <tr>
        <td><span class="rank-badge ${rankClass}">${i + 1}</span></td>
        <td>${r.zone}</td>
        <td style="color:${bColor}; font-weight: 500;">${r.borough}</td>
        <td style="font-weight: 600;">${fmt(r.total_trips)}</td>
        <td>${fmtCurrency(r.avg_fare)}</td>
        <td>${fmtMiles(r.avg_distance)}</td>
      </tr>`;
  }).join('');
}