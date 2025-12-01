// Header Builder - Handles table header creation and replacement

window.TableExtensionHeaderBuilder = (function() {
  'use strict';

  const Utils = window.TableExtensionUtils;
  const Sort = window.TableExtensionSort;

  // Header configuration
  const HEADER_CONFIG = [
    { text: 'Client', widthPercent: '6%', widthPx: 61, ariaLabel: 'Client: activate to sort column ascending' },
    { text: 'Journal', widthPercent: '8%', widthPx: 85, ariaLabel: 'Journal: activate to sort column ascending' },
    { text: 'Article ID', widthPercent: '20%', widthPx: 224, ariaLabel: 'Article ID: activate to sort column ascending' },
    { text: 'DONE BY', widthPercent: null, widthPx: 100, ariaLabel: 'DONE BY: activate to sort column ascending' },
    { text: 'SRC', widthPercent: '5%', widthPx: 50, ariaLabel: 'SRC: activate to sort column ascending' },
    { text: 'MSP', widthPercent: '5%', widthPx: 49, ariaLabel: 'MSP: activate to sort column ascending' },
    { text: 'Status', widthPercent: '12%', widthPx: 128, ariaLabel: 'Status: activate to sort column ascending' },
    { text: 'Assign Date', widthPercent: '12%', widthPx: 131, ariaLabel: 'Assign Date: activate to sort column ascending' },
    { text: 'Due Date', widthPercent: '12%', widthPx: 131, ariaLabel: 'Due Date: activate to sort column ascending' },
    { text: 'Priority', widthPercent: '6%', widthPx: 62, ariaLabel: 'Priority: activate to sort column ascending' },
    { text: 'Action', widthPercent: '10%', widthPx: 249, ariaLabel: 'Action: activate to sort column ascending' }
  ];

  /**
   * Create a table header cell with sorting functionality
   * @param {string} text - Header text
   * @param {string|null} widthPercent - Width percentage (e.g., "6%")
   * @param {number} widthPx - Width in pixels
   * @param {number} columnIndex - Column index
   * @param {string} ariaLabel - Aria label for accessibility
   * @returns {HTMLElement}
   */
  function createHeaderCell(text, widthPercent, widthPx, columnIndex, ariaLabel) {
    const th = document.createElement('th');
    
    // Set width attribute (percentage)
    if (widthPercent) {
      th.setAttribute('width', widthPercent);
    }
    
    // Set all required attributes
    th.className = 'ui-state-default';
    th.setAttribute('role', 'columnheader');
    th.setAttribute('tabindex', '0');
    th.setAttribute('aria-controls', 'article_data');
    th.setAttribute('rowspan', '1');
    th.setAttribute('colspan', '1');
    
    // Set style width in pixels
    if (widthPx) {
      th.style.width = widthPx + 'px';
    }
    
    // Set aria-label
    th.setAttribute('aria-label', ariaLabel || `${text}: activate to sort column ascending`);

    // Create wrapper div
    const wrapper = document.createElement('div');
    wrapper.className = 'DataTables_sort_wrapper';
    wrapper.textContent = text;

    // Create sort icon
    const sortIcon = document.createElement('span');
    sortIcon.className = 'DataTables_sort_icon css_right ui-icon ui-icon-carat-2-n-s';
    wrapper.appendChild(sortIcon);

    th.appendChild(wrapper);

    // Add cursor pointer style
    th.style.cursor = 'pointer';
    
    // Store column index for later use
    th.setAttribute('data-column-index', columnIndex);

    return th;
  }

  /**
   * Replace the entire table header with new structure
   * @param {Function} onSortCallback - Optional callback after sorting
   */
  function replaceTableHeader(onSortCallback) {
    const table = Utils.getTable();
    if (!table) return;

    const thead = table.querySelector('thead');
    if (!thead) return;

    // Find existing header row
    let headerRow = thead.querySelector('tr');
    
    // If header row exists, completely remove it and all its contents
    if (headerRow) {
      // Remove all old header cells completely
      headerRow.innerHTML = '';
      
      // Remove all attributes except role to start fresh
      const role = headerRow.getAttribute('role');
      const attributes = Array.from(headerRow.attributes);
      attributes.forEach(attr => {
        if (attr.name !== 'role') {
          headerRow.removeAttribute(attr.name);
        }
      });
      
      // Ensure role is set
      if (!role) {
        headerRow.setAttribute('role', 'row');
      }
    } else {
      // Create new header row if it doesn't exist
      headerRow = document.createElement('tr');
      headerRow.setAttribute('role', 'row');
      thead.appendChild(headerRow);
    }

    // Clear sort state when replacing header
    Sort.clearSortState();

    // Create and append new header cells
    HEADER_CONFIG.forEach((header, index) => {
      const th = createHeaderCell(header.text, header.widthPercent, header.widthPx, index, header.ariaLabel);
      
      // Add click handler for sorting with callback
      th.addEventListener('click', () => {
        Sort.handleColumnSort(index, th, onSortCallback);
      });
      
      headerRow.appendChild(th);
    });

    // Mark header as replaced
    headerRow.setAttribute('data-extension-header', 'true');
  }

  return {
    createHeaderCell,
    replaceTableHeader,
    getHeaderConfig: () => HEADER_CONFIG
  };
})();

