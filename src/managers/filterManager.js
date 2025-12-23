// Filter Manager - Handles filtering of TEX rows - Global namespace

window.TableExtensionFilter = (function() {
  'use strict';

  const Utils = window.TableExtensionUtils;
  const SRC_COLUMN = 'SRC';
  const TEX_VALUE = 'TEX';
  let isFilterEnabled = true; // Default enabled (hide TEX rows)
  let filterButton = null; // Store button reference

  /**
   * Get filter state
   * @returns {boolean}
   */
  function isFilterActive() {
    return isFilterEnabled;
  }

  /**
   * Count TEX rows in the table
   * @returns {number}
   */
  function countTexRows() {
    const table = Utils.getTable();
    if (!table) return 0;

    const srcColumnIndex = Utils.findColumnIndex(table, SRC_COLUMN);
    if (srcColumnIndex === -1) return 0;

    const rows = Utils.getTableRows(table);
    let texCount = 0;

    rows.forEach((row) => {
      const srcValue = Utils.getCellValue(row, srcColumnIndex);
      if (srcValue === TEX_VALUE) {
        texCount++;
      }
    });

    return texCount;
  }

  /**
   * Update button text with count
   */
  function updateButtonText() {
    if (!filterButton) return;
    
    const texCount = countTexRows();
    const countText = ` (${texCount})`; // Always show count, even if 0
    
    if (isFilterEnabled) {
      filterButton.textContent = `Show TEX Rows${countText}`;
    } else {
      filterButton.textContent = `Hide TEX Rows${countText}`;
    }
    
    // Disable button if no TEX rows
    if (texCount === 0) {
      filterButton.disabled = true;
      filterButton.style.opacity = '0.5';
      filterButton.style.cursor = 'not-allowed';
    } else {
      filterButton.disabled = false;
      filterButton.style.opacity = '1';
      filterButton.style.cursor = 'pointer';
    }
  }

  /**
   * Toggle filter state
   * @returns {boolean} - New filter state
   */
  function toggleFilter() {
    isFilterEnabled = !isFilterEnabled;
    applyFilter();
    return isFilterEnabled;
  }

  /**
   * Apply filter to table rows - Now shows all rows (no filtering)
   */
  function applyFilter() {
    const table = Utils.getTable();
    if (!table) return;

    const srcColumnIndex = Utils.findColumnIndex(table, SRC_COLUMN);
    if (srcColumnIndex === -1) {
      return;
    }

    const rows = Utils.getTableRows(table);

    // Show all rows - no filtering
    rows.forEach((row) => {
      row.style.display = '';
    });
    
    // Update DataTables if available
    updateDataTables();
  }
  
  /**
   * Update the DataTables info text
   * @param {number} visibleCount - Number of visible rows
   */
  function updateInfoText(visibleCount) {
    const infoDiv = document.getElementById('article_data_info');
    if (!infoDiv) return;
    
    // Get current page info from DataTables if available
    if (window.jQuery && window.jQuery.fn.dataTable) {
      try {
        const dataTable = window.jQuery('#article_data').DataTable();
        if (dataTable) {
          const pageInfo = dataTable.page.info();
          // pageInfo.end is exclusive, so use it directly for the end value
          // pageInfo.start is 0-indexed, so add 1 for display
          const start = pageInfo.start + 1;
          const end = Math.min(pageInfo.end, visibleCount);
          
          if (visibleCount === 0) {
            infoDiv.textContent = 'Showing 0 to 0 of 0 entries';
          } else {
            infoDiv.textContent = `Showing ${start} to ${end} of ${visibleCount} entries`;
          }
          return;
        }
      } catch (e) {
        // DataTables not available, use simple count
      }
    }
    
    // Fallback: Simple count update
    if (visibleCount === 0) {
      infoDiv.textContent = 'Showing 0 to 0 of 0 entries';
    } else {
      infoDiv.textContent = `Showing 1 to ${visibleCount} of ${visibleCount} entries`;
    }
  }

  /**
   * Update DataTables after filtering
   */
  function updateDataTables() {
    // Don't call dataTable.draw() here - it causes row reordering issues
    // The filter now just shows all rows, no DataTables update needed
  }

  /**
   * Create filter button
   * @returns {HTMLElement}
   */
  function createFilterButton() {
    const button = document.createElement('button');
    button.id = 'tex-filter-btn';
    button.className = 'tex-filter-button';
    
    // Store button reference
    filterButton = button;
    
    // Get initial count and set text
    const texCount = countTexRows();
    const countText = ` (${texCount})`; // Always show count, even if 0
    button.textContent = isFilterEnabled ? `Show TEX Rows${countText}` : `Hide TEX Rows${countText}`;
    
    // Disable button if no TEX rows
    const isDisabled = texCount === 0;
    button.disabled = isDisabled;
    
    button.style.cssText = `
      padding: 4px 12px;
      margin: 0;
      margin-left: 10px;
      background: ${isFilterEnabled ? '#667eea' : '#95a5a6'};
      color: white;
      border: none;
      border-radius: 4px;
      cursor: ${isDisabled ? 'not-allowed' : 'pointer'};
      font-size: 13px;
      font-weight: 600;
      transition: background 0.2s;
      display: inline-block;
      vertical-align: middle;
      height: 28px;
      line-height: 20px;
      opacity: ${isDisabled ? '0.5' : '1'};
    `;

    button.addEventListener('click', () => {
      if (button.disabled) return; // Don't toggle if disabled
      const newState = toggleFilter();
      updateButtonText();
      button.style.background = newState ? '#667eea' : '#95a5a6';
    });

    button.addEventListener('mouseenter', () => {
      button.style.opacity = '0.9';
    });

    button.addEventListener('mouseleave', () => {
      button.style.opacity = '1';
    });

    return button;
  }

  /**
   * Initialize filter - no longer creates button, just ensures all rows are visible
   */
  function initializeFilter() {
    // Remove any existing button if it exists
    const existingButton = document.getElementById('tex-filter-btn');
    if (existingButton) {
      existingButton.remove();
    }

    // Ensure all rows are visible (no filtering)
    applyFilter();
  }

  // Public API
  return {
    isFilterActive,
    toggleFilter,
    applyFilter,
    createFilterButton,
    initializeFilter,
    updateButtonText,
    countTexRows
  };
})();
