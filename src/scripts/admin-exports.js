// src/scripts/admin-exports.js

/**
 * Converts an array of objects to CSV and triggers download.
 * Uses PapaParse if available, otherwise a simple implementation.
 * @param {Array<Object>} data
 * @param {string} filename
 */
export function exportCSV(data, filename = 'export.csv') {
  if (!data || data.length === 0) {
    console.warn('No data to export');
    return;
  }

  // Prefer PapaParse if loaded (it may be imported elsewhere or globally)
  if (typeof Papa !== 'undefined' && Papa.unparse) {
    const csv = Papa.unparse(data);
    downloadBlob(csv, filename, 'text/csv;charset=utf-8;');
    return;
  }

  // Fallback manual CSV generation
  const headers = Object.keys(data[0]);
  const csvRows = [];

  // Header row
  csvRows.push(headers.join(','));

  // Data rows
  for (const row of data) {
    const values = headers.map(header => {
      const escaped = ('' + (row[header] || '')).replace(/"/g, '""');
      return `"${escaped}"`;
    });
    csvRows.push(values.join(','));
  }

  const csvString = csvRows.join('\n');
  downloadBlob(csvString, filename, 'text/csv;charset=utf-8;');
}

/**
 * Exports data as a JSON file.
 * @param {*} data
 * @param {string} filename
 */
export function exportJSON(data, filename = 'export.json') {
  const json = JSON.stringify(data, null, 2);
  downloadBlob(json, filename, 'application/json');
}

/**
 * Exports an HTML element as a PDF.
 * Uses html2pdf if available (CDN global), otherwise alerts.
 * @param {string} elementId - ID of the element to capture
 * @param {string} filename - output filename
 */
export function exportPDF(elementId, filename = 'export.pdf') {
  const element = document.getElementById(elementId);
  if (!element) {
    console.error('Element not found:', elementId);
    return;
  }

  if (typeof html2pdf !== 'undefined') {
    html2pdf().set({ margin: 0.5, filename, image: { type: 'jpeg', quality: 0.98 } })
      .from(element)
      .save();
  } else {
    // Fallback if html2pdf is not loaded
    alert('PDF export requires html2pdf library. Please include it via CDN.');
    // Or open a print dialog
    window.print();
  }
}

// Internal helper to trigger download of a Blob
function downloadBlob(content, filename, mimeType) {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}