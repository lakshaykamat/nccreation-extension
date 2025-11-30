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
   * Apply filter to table rows
   */
  function applyFilter() {
    const table = Utils.getTable();
    if (!table) return;

    const srcColumnIndex = Utils.findColumnIndex(table, SRC_COLUMN);
    if (srcColumnIndex === -1) {
      return;
    }

    const rows = Utils.getTableRows(table);
    let hiddenCount = 0;
    let visibleCount = 0;

    rows.forEach((row) => {
      const srcValue = Utils.getCellValue(row, srcColumnIndex);
      const isTexRow = srcValue === TEX_VALUE;

      if (isFilterEnabled && isTexRow) {
        // Hide TEX rows when filter is enabled
        row.style.display = 'none';
        hiddenCount++;
      } else {
        // Show all rows when filter is disabled, or show non-TEX rows
        row.style.display = '';
        visibleCount++;
      }
    });

    // Update button text with count
    updateButtonText();
    
    // Update DataTables if available
    updateDataTables();
    
    // Don't update info text - let DataTables manage pagination text naturally
    // Filtering only hides/shows rows with CSS, pagination should show total count
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
    if (window.jQuery && window.jQuery.fn.dataTable) {
      try {
        const dataTable = window.jQuery('#article_data').DataTable();
        if (dataTable) {
          // Trigger redraw to update pagination info
          // Don't update info text - let DataTables manage it naturally
          dataTable.draw(false); // false = don't reset paging
        }
      } catch (e) {
        // DataTables not available or not initialized
      }
    }
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
   * Initialize filter - add button and apply default filter
   */
  function initializeFilter() {
    // Find the search/filter div to add button next to search bar
    const filterDiv = document.querySelector('#article_data_wrapper .dataTables_filter');
    if (!filterDiv) {
      setTimeout(initializeFilter, 1000);
      return;
    }

    // Check if button already exists
    if (document.getElementById('tex-filter-btn')) {
      return;
    }

    // Create and add button
    const button = createFilterButton();
    
    // Add button to the filter div (same line as search bar)
    // The filter div contains a label, so we add the button after the label
    const label = filterDiv.querySelector('label');
    if (label) {
      // Add button after the label's input
      const input = label.querySelector('input');
      if (input && input.parentNode) {
        // Insert button after the input element
        input.parentNode.insertBefore(button, input.nextSibling);
      } else {
        // Fallback: append to label
        label.appendChild(button);
      }
    } else {
      // Fallback: append to filter div
      filterDiv.appendChild(button);
    }
    
    // Ensure filter div displays inline
    filterDiv.style.display = 'inline-block';
    filterDiv.style.verticalAlign = 'middle';

    // Apply filter by default
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
