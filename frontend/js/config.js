export const API_BASE = 'http://localhost:5000';

export const COLORS = {
  blue:      '#2563eb',
  slate:     '#475569',
  gray:      '#6b7280',
  lightGray: '#e5e7eb',
  darkGray:  '#1f2937',
  green:     '#10b981',
  amber:     '#f59e0b',
  red:       '#ef4444',
  purple:    '#8b5cf6',
  orange:    '#f97316',
};

export const BOROUGH_COLORS = {
  Manhattan:      COLORS.blue,
  Brooklyn:       COLORS.green,
  Queens:         COLORS.purple,
  Bronx:          COLORS.amber,
  'Staten Island': COLORS.orange,
  EWR:            COLORS.red,
  Unknown:        COLORS.gray,
};

export function configureChartDefaults() {
  if (typeof Chart === 'undefined') return;

  Chart.defaults.color = '#4b5563';
  Chart.defaults.borderColor = '#f3f4f6';
  Chart.defaults.font.family = "'Inter', system-ui, sans-serif";
  Chart.defaults.font.size = 11;
  Chart.defaults.plugins.legend.labels.usePointStyle = true;
  Chart.defaults.plugins.legend.labels.pointStyleWidth = 8;
  Chart.defaults.plugins.legend.labels.padding = 12;

  Chart.defaults.plugins.tooltip.backgroundColor = '#ffffff';
  Chart.defaults.plugins.tooltip.titleColor = '#111827';
  Chart.defaults.plugins.tooltip.bodyColor = '#4b5563';
  Chart.defaults.plugins.tooltip.borderColor = '#e5e7eb';
  Chart.defaults.plugins.tooltip.borderWidth = 1;
  Chart.defaults.plugins.tooltip.padding = 8;
  Chart.defaults.plugins.tooltip.titleFont = { weight: '600', size: 12 };
  Chart.defaults.plugins.tooltip.bodyFont = { size: 11 };
  Chart.defaults.plugins.tooltip.cornerRadius = 4;
  Chart.defaults.plugins.tooltip.displayColors = true;
  Chart.defaults.plugins.tooltip.boxWidth = 8;
  Chart.defaults.plugins.tooltip.boxHeight = 8;
  Chart.defaults.plugins.tooltip.usePointStyle = true;
}