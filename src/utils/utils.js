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
    const searchText = headerText.trim().toLowerCase();
    // First try exact match (case-insensitive)
    let index = headers.findIndex(th => 
      th.textContent.trim().toLowerCase() === searchText
    );
    // If no exact match, try contains match (but be more careful)
    if (index === -1) {
      index = headers.findIndex(th => {
        const headerTextLower = th.textContent.trim().toLowerCase();
        // Only match if the search text is a significant part of the header
        // This prevents "SRC" from matching "MSP" or vice versa
        return headerTextLower.includes(searchText) && 
               (headerTextLower.length <= searchText.length + 2 || 
                headerTextLower.startsWith(searchText) || 
                headerTextLower.endsWith(searchText));
      });
    }
    return index;
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

  /**
   * Parse date string in format "DD/MM/YYYY"
   * @param {string} dateStr - Date string
   * @returns {Date|null}
   */
  function parseDateString(dateStr) {
    if (!dateStr) return null;
    const parts = dateStr.trim().split('/');
    if (parts.length !== 3) return null;
    const [day, month, year] = parts.map(Number);
    if (!day || !month || !year) return null;
    return new Date(year, month - 1, day);
  }

  /**
   * Format date as DD/MM/YYYY
   * @param {Date} date - Date object
   * @returns {string}
   */
  function formatDate(date) {
    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const year = date.getFullYear();
    return `${day}/${month}/${year}`;
  }

  /**
   * Parse date string with time in format "DD/MM/YYYY HH:MM AM/PM"
   * @param {string} dateString - Date string with time
   * @returns {Date|null}
   */
  function parseDate(dateString) {
    if (!dateString || dateString.trim() === '') return null;
    
    // Format: "26/11/2025 06:26 PM"
    const parts = dateString.trim().split(' ');
    if (parts.length < 2) return null;
    
    const datePart = parts[0]; // "26/11/2025"
    const timePart = parts.slice(1).join(' '); // "06:26 PM"
    
    const [day, month, year] = datePart.split('/').map(Number);
    if (!day || !month || !year) return null;
    
    // Create date object (month is 0-indexed in JS)
    const date = new Date(year, month - 1, day);
    
    // Parse time if available
    if (timePart) {
      const timeMatch = timePart.match(/(\d+):(\d+)\s*(AM|PM)/i);
      if (timeMatch) {
        let hours = parseInt(timeMatch[1]);
        const minutes = parseInt(timeMatch[2]);
        const ampm = timeMatch[3].toUpperCase();
        
        if (ampm === 'PM' && hours !== 12) hours += 12;
        if (ampm === 'AM' && hours === 12) hours = 0;
        
        date.setHours(hours, minutes, 0, 0);
      }
    }
    
    return date;
  }

  /**
   * Generate unique abbreviations for names
   * Ensures no two names have the same abbreviation
   * @param {string[]} names - Array of names
   * @returns {Map<string, string>} - Map of name to abbreviation
   */
  function generateUniqueAbbreviations(names) {
    const abbrevMap = new Map();
    const usedAbbrevs = new Set();
    
    // First pass: try to assign first 3 characters
    names.forEach(name => {
      if (!name || name.trim() === '') return;
      
      let abbrev = name.substring(0, 3).toUpperCase();
      let originalAbbrev = abbrev;
      let counter = 3;
      
      // If abbreviation already used, try to make it unique
      while (usedAbbrevs.has(abbrev)) {
        // Try using more characters from the name
        if (name.length > counter) {
          abbrev = name.substring(0, counter + 1).toUpperCase();
          counter++;
        } else {
          // If name is too short, append a number
          abbrev = originalAbbrev + '1';
          let num = 1;
          while (usedAbbrevs.has(abbrev)) {
            num++;
            abbrev = originalAbbrev + num;
          }
        }
      }
      
      usedAbbrevs.add(abbrev);
      abbrevMap.set(name, abbrev);
    });
    
    return abbrevMap;
  }

  // ============ ROW UTILITIES ============

  /**
   * Check if a row is a TEX row based on SRC column
   * @param {HTMLElement} row - Table row
   * @param {number} srcColumnIndex - SRC column index
   * @returns {boolean}
   */
  function isTexRow(row, srcColumnIndex) {
    if (srcColumnIndex === -1) return false;
    const cells = row.querySelectorAll('td');
    if (cells.length <= srcColumnIndex) return false;
    return cells[srcColumnIndex].textContent.trim().toUpperCase() === 'TEX';
  }

  /**
   * Split rows into TEX and non-TEX arrays
   * @param {HTMLElement[]} rows - Array of table rows
   * @param {number} srcColumnIndex - SRC column index
   * @returns {{ texRows: HTMLElement[], nonTexRows: HTMLElement[] }}
   */
  function splitRowsBySrc(rows, srcColumnIndex) {
    const texRows = [];
    const nonTexRows = [];

    for (const row of rows) {
      if (isTexRow(row, srcColumnIndex)) {
        texRows.push(row);
      } else {
        nonTexRows.push(row);
      }
    }

    return { texRows, nonTexRows };
  }

  /**
   * Check if TEX rows are already at bottom (optimization check)
   * @param {HTMLElement[]} rows - Array of table rows
   * @param {number} srcColumnIndex - SRC column index
   * @returns {boolean}
   */
  function areTexRowsAtBottom(rows, srcColumnIndex) {
    let foundTex = false;
    for (const row of rows) {
      if (isTexRow(row, srcColumnIndex)) {
        foundTex = true;
      } else if (foundTex) {
        // Found non-TEX after TEX - not in order
        return false;
      }
    }
    return true;
  }

  // ============ SORTING UTILITIES ============

  /**
   * Compare two cell values for sorting (handles numbers, dates, strings)
   * @param {string} valueA - First value
   * @param {string} valueB - Second value
   * @returns {number} - Comparison result (-1, 0, 1)
   */
  function compareCellValues(valueA, valueB) {
    // Try numeric comparison
    const numA = parseFloat(valueA);
    const numB = parseFloat(valueB);
    const isNumeric = !isNaN(numA) && !isNaN(numB) && valueA !== '' && valueB !== '';

    if (isNumeric) {
      return numA - numB;
    }

    // Try date comparison
    const dateA = parseDate(valueA) || parseDateString(valueA);
    const dateB = parseDate(valueB) || parseDateString(valueB);
    if (dateA && dateB) {
      return dateA - dateB;
    }

    // Fallback to string comparison
    return valueA.localeCompare(valueB);
  }

  // Public API
  return {
    // DOM utilities
    getTable,
    getHeaderRow,
    getHeaders,
    findColumnIndex,
    getTableRows,
    getCellValue,
    
    // Async utilities
    debounce,
    waitForElement,
    
    // Date utilities
    parseDateString,
    formatDate,
    parseDate,
    
    // String utilities
    generateUniqueAbbreviations,
    
    // Row utilities
    isTexRow,
    splitRowsBySrc,
    areTexRowsAtBottom,
    
    // Sorting utilities
    compareCellValues
  };
})();

