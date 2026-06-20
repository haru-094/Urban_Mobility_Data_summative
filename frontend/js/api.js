import { API_BASE } from './config.js';

/**
 * Builds a query string based on the current values of the global filter elements.
 * @param {Object} extraParams - Additional parameters to merge into the query.
 * @returns {string} The formatted query string (e.g. "?borough=Manhattan&is_rush_hour=true")
 */
export function buildQuery(extraParams = {}) {
  const params = new URLSearchParams();
  const borough = document.getElementById('filter-borough')?.value;
  const rush = document.getElementById('filter-rush')?.value;

  if (borough) params.append('borough', borough);
  if (rush) params.append('is_rush_hour', rush);

  for (const [k, v] of Object.entries(extraParams)) {
    if (v != null && v !== '') {
      params.append(k, v);
    }
  }

  const qs = params.toString();
  return qs ? `?${qs}` : '';
}

/**
 * Robust helper to fetch resources from the backend API.
 * @param {string} endpoint - The relative endpoint path (e.g. "/api/trips/summary")
 * @returns {Promise<Object>} The parsed JSON data.
 */
export async function apiFetch(endpoint) {
  const url = `${API_BASE}${endpoint}`;
  const response = await fetch(url);
  if (!response.ok) {
    const errorText = await response.text();
    let parsedError;
    try {
      parsedError = JSON.parse(errorText);
    } catch {
      parsedError = { error: errorText };
    }
    throw new Error(parsedError.error || `HTTP error! status: ${response.status}`);
  }
  return response.json();
}