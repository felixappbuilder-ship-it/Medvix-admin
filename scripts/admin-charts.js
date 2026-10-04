// src/scripts/admin-charts.js
import { Chart, registerables } from 'chart.js';
// Register all Chart.js components
Chart.register(...registerables);

// Keep references to avoid memory leaks when re-rendering
const chartInstances = {};

/**
 * Renders a line chart on a canvas element.
 * @param {string} canvasId - ID of the <canvas>
 * @param {string[]} labels
 * @param {number[]} dataPoints
 * @param {string} label
 * @param {Object} [options]
 */
export function renderLineChart(canvasId, labels, dataPoints, label, options = {}) {
  const canvas = document.getElementById(canvasId);
  if (!canvas) return;

  // Destroy existing chart on this canvas
  if (chartInstances[canvasId]) {
    chartInstances[canvasId].destroy();
  }

  chartInstances[canvasId] = new Chart(canvas, {
    type: 'line',
    data: {
      labels,
      datasets: [{
        label,
        data: dataPoints,
        borderColor: '#4f46e5',
        backgroundColor: 'rgba(79, 70, 229, 0.1)',
        fill: true,
        tension: 0.3,
      }],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      ...options,
    },
  });
}

/**
 * Renders a bar chart.
 * @param {string} canvasId
 * @param {string[]} labels
 * @param {number[]} dataPoints
 * @param {string} label
 * @param {Object} [options]
 */
export function renderBarChart(canvasId, labels, dataPoints, label, options = {}) {
  const canvas = document.getElementById(canvasId);
  if (!canvas) return;

  if (chartInstances[canvasId]) {
    chartInstances[canvasId].destroy();
  }

  chartInstances[canvasId] = new Chart(canvas, {
    type: 'bar',
    data: {
      labels,
      datasets: [{
        label,
        data: dataPoints,
        backgroundColor: '#4f46e5',
      }],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      ...options,
    },
  });
}

/**
 * Renders a pie (or doughnut) chart.
 * @param {string} canvasId
 * @param {string[]} labels
 * @param {number[]} dataPoints
 * @param {Object} [options]
 */
export function renderPieChart(canvasId, labels, dataPoints, options = {}) {
  const canvas = document.getElementById(canvasId);
  if (!canvas) return;

  if (chartInstances[canvasId]) {
    chartInstances[canvasId].destroy();
  }

  chartInstances[canvasId] = new Chart(canvas, {
    type: 'doughnut',
    data: {
      labels,
      datasets: [{
        data: dataPoints,
        backgroundColor: [
          '#4f46e5',
          '#10b981',
          '#f59e0b',
          '#ef4444',
          '#8b5cf6',
          '#06b6d4',
        ],
      }],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      ...options,
    },
  });
}

/**
 * Destroys all chart instances (useful on page unload).
 */
export function destroyAllCharts() {
  Object.values(chartInstances).forEach(chart => chart.destroy());
  Object.keys(chartInstances).forEach(id => delete chartInstances[id]);
}