// src/scripts/admin-analytics.js
import { query } from './admin-api.js';
import { showToast, showLoading } from './admin-utils.js';
import { renderLineChart, renderBarChart, renderPieChart } from './admin-charts.js';

/**
 * Safely sets the textContent of an element by ID.
 * @param {string} id - Element ID
 * @param {string|number} value - Value to set
 */
function setText(id, value) {
  const el = document.getElementById(id);
  if (el) {
    el.textContent = value;
  }
}

/**
 * Loads revenue data for a specified period and renders a chart + summary cards.
 * @param {string} [period='day'] - 'day', 'week', 'month', 'year'
 */
export async function loadRevenueChart(period = 'day') {
  try {
    showLoading(true);
    const data = await query('admin/queries:adminGetRevenueReport', { period });

    // Ensure data is an object
    const total = data?.total ?? 0;
    const count = data?.count ?? 0;

    // Update summary cards (if they exist)
    setText('revenue-total', `KES ${total}`);
    setText('revenue-count', count);

    // Render chart only if the canvas exists
    const canvas = document.getElementById('revenue-chart');
    if (canvas) {
      // Use simple labels; adjust if the backend returns detailed series
      renderLineChart('revenue-chart', ['Revenue'], [total], 'Revenue');
    }
  } catch (error) {
    showToast(error.message, 'error');
  } finally {
    showLoading(false);
  }
}

/**
 * Loads user growth data and renders chart.
 * Assumes backend returns { labels: string[], datasets: number[] } or similar.
 */
export async function loadUserGrowthChart() {
  try {
    showLoading(true);
    const data = await query('admin/queries:adminGetUserGrowth', {});

    // Validate data structure to prevent chart errors
    const labels = Array.isArray(data?.labels) ? data.labels : [];
    const datasets = Array.isArray(data?.datasets) ? data.datasets : [];

    renderLineChart('user-growth-chart', labels, datasets, 'New Users');
  } catch (error) {
    showToast(error.message, 'error');
  } finally {
    showLoading(false);
  }
}

/**
 * Loads conversion rate metrics and updates UI elements.
 */
export async function loadConversionRate() {
  try {
    const data = await query('admin/queries:adminGetConversionRates', {});

    setText('total-users', data?.totalUsers ?? '--');
    setText('active-subscriptions', data?.activeSubscriptions ?? '--');
    setText('conversion-rate', data?.conversionRate ?? '--');
  } catch (error) {
    showToast(error.message, 'error');
  }
}

/**
 * Loads retention cohort data and renders chart.
 * Assumes backend returns { labels: string[], values: number[] }.
 */
export async function loadRetention() {
  try {
    showLoading(true);
    const data = await query('admin/queries:adminGetRetention', {});

    const labels = Array.isArray(data?.labels) ? data.labels : [];
    const values = Array.isArray(data?.values) ? data.values : [];

    renderBarChart('retention-chart', labels, values, 'Retention');
  } catch (error) {
    showToast(error.message, 'error');
  } finally {
    showLoading(false);
  }
}

/**
 * Loads aggregate exam performance stats and renders chart.
 * Assumes backend returns { subjects: string[], averageScores: number[] }.
 */
export async function loadExamPerformance() {
  try {
    showLoading(true);
    const data = await query('admin/queries:adminGetExamPerformance', {});

    const subjects = Array.isArray(data?.subjects) ? data.subjects : [];
    const scores = Array.isArray(data?.averageScores) ? data.averageScores : [];

    renderBarChart('exam-performance-chart', subjects, scores, 'Avg Score');
  } catch (error) {
    showToast(error.message, 'error');
  } finally {
    showLoading(false);
  }
}

/**
 * Refreshes all analytics based on a date range (if backend supports).
 * @param {Date|string} start
 * @param {Date|string} end
 */
export function updateDateRange(start, end) {
  // Reload all analytics; pass start/end if backend actions accept them.
  loadRevenueChart();
  loadUserGrowthChart();
  loadRetention();
  loadExamPerformance();
}

// Attach to global if needed for HTML onclick
window.analytics = {
  loadAll() {
    loadRevenueChart();
    loadUserGrowthChart();
    loadConversionRate();
    loadRetention();
    loadExamPerformance();
  }
};