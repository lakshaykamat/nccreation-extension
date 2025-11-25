// Utility functions - Global namespace
window.TableExtensionUtils = (function() {
  'use strict';

  /**
   * Get table element by ID
   * @param {string} tableId - Table ID
   * @returns {HTMLElement|null}
   */
  function getTable(tableId = 'article_data') {
    return document.getElementById(tableId);
  }

  /**
   * Get header row from table
   * @param {HTMLElement} table - Table element
   * @returns {HTMLElement|null}
   */
  function getHeaderRow(table) {
    return table ? table.querySelector('thead tr') : null;
  }

  /**
   * Get all header cells
   * @param {HTMLElement} table - Table element
   * @returns {Array<HTMLElement>}
   */
  function getHeaders(table) {
    const headerRow = getHeaderRow(table);
    return headerRow ? Array.from(headerRow.querySelectorAll('th')) : [];
  }

  /**
   * Find column index by header text
   * @param {HTMLElement} table - Table element
   * @param {string} headerText - Text to search for in header
   * @returns {number} - Column index or -1 if not found
   */
  function findColumnIndex(table, headerText) {
    const headers = getHeaders(table);
    return headers.findIndex(th => 
      th.textContent.trim().includes(headerText)
    );
  }

  /**
   * Get all table rows
   * @param {HTMLElement} table - Table element
   * @returns {NodeList}
   */
  function getTableRows(table) {
    const tbody = table ? table.querySelector('tbody') : null;
    return tbody ? tbody.querySelectorAll('tr') : [];
  }

  /**
   * Get cell value from row
   * @param {HTMLElement} row - Table row
   * @param {number} columnIndex - Column index
   * @returns {string} - Cell text content
   */
  function getCellValue(row, columnIndex) {
    const cells = Array.from(row.querySelectorAll('td'));
    return cells[columnIndex] ? cells[columnIndex].textContent.trim() : '';
  }

  /**
   * Create a debounced function
   * @param {Function} func - Function to debounce
   * @param {number} wait - Wait time in ms
   * @returns {Function}
   */
  function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
      const later = () => {
        clearTimeout(timeout);
        func(...args);
      };
      clearTimeout(timeout);
      timeout = setTimeout(later, wait);
    };
  }

  /**
   * Wait for element to appear in DOM
   * @param {string} selector - CSS selector
   * @param {number} timeout - Timeout in ms
   * @returns {Promise<HTMLElement>}
   */
  function waitForElement(selector, timeout = 5000) {
    return new Promise((resolve, reject) => {
      const element = document.querySelector(selector);
      if (element) {
        resolve(element);
        return;
      }

      const observer = new MutationObserver((mutations, obs) => {
        const element = document.querySelector(selector);
        if (element) {
          obs.disconnect();
          resolve(element);
        }
      });

      observer.observe(document.body, {
        childList: true,
        subtree: true
      });

      setTimeout(() => {
        observer.disconnect();
        reject(new Error(`Element ${selector} not found within ${timeout}ms`));
      }, timeout);
    });
  }

  // Public API
  return {
    getTable,
    getHeaderRow,
    getHeaders,
    findColumnIndex,
    getTableRows,
    getCellValue,
    debounce,
    waitForElement
  };
})();

