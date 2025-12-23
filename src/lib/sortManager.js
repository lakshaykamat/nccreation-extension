// Sort Manager - Handles table column sorting functionality

window.TableExtensionSort = (function() {
  'use strict';

  const Utils = window.TableExtensionUtils;
  const SRC_COLUMN = 'SRC';

  // Track current sort state: { columnIndex: 'asc' | 'desc' | null }
  let sortState = {};

  /**
   * Get current sort state
   * @returns {Object}
   */
  function getSortState() {
    return sortState;
  }

  /**
   * Clear sort state
   */
  function clearSortState() {
    sortState = {};
  }

  /**
   * Update sort icon based on sort state
   * @param {HTMLElement} headerCell - Header cell element
   * @param {string} direction - 'asc', 'desc', or null
   */
  function updateSortIcon(headerCell, direction) {
    const wrapper = headerCell.querySelector('.DataTables_sort_wrapper');
    if (!wrapper) return;

    const icon = wrapper.querySelector('.DataTables_sort_icon');
    if (!icon) return;

    // Remove all sort icon classes
    icon.className = 'DataTables_sort_icon css_right ui-icon';

    if (direction === 'asc') {
      icon.classList.add('ui-icon-triangle-1-n');
      headerCell.setAttribute('aria-sort', 'ascending');
    } else if (direction === 'desc') {
      icon.classList.add('ui-icon-triangle-1-s');
      headerCell.setAttribute('aria-sort', 'descending');
    } else {
      icon.classList.add('ui-icon-carat-2-n-s');
      headerCell.removeAttribute('aria-sort');
    }
  }


  /**
   * Handle column sorting
   * @param {number} columnIndex - Column index to sort
   * @param {HTMLElement} headerCell - Header cell element
   * @param {Function} onAfterSort - Callback after sorting (optional)
   */
  function handleColumnSort(columnIndex, headerCell, onAfterSort) {
    const table = Utils.getTable();
    if (!table) return;

    const rows = Array.from(Utils.getTableRows(table));
    if (rows.length === 0) return;

    // Get current sort direction for this column
    const currentDirection = sortState[columnIndex];
    let newDirection = 'asc';

    // Toggle: null/desc -> asc, asc -> desc
    if (currentDirection === 'asc') {
      newDirection = 'desc';
    }

    // Clear sort icons from all headers
    const headers = Utils.getHeaders(table);
    headers.forEach((th, idx) => {
      if (idx !== columnIndex) {
        updateSortIcon(th, null);
        sortState[idx] = null;
      }
    });

    // Get SRC column index for TEX detection
    const srcColumnIndex = Utils.findColumnIndex(table, SRC_COLUMN);

    // Sort rows - TEX rows always go to bottom
    rows.sort((a, b) => {
      const isATex = Utils.isTexRow(a, srcColumnIndex);
      const isBTex = Utils.isTexRow(b, srcColumnIndex);

      // If one is TEX and the other is not, TEX always goes to bottom
      if (isATex && !isBTex) {
        return 1; // A (TEX) goes after B
      }
      if (!isATex && isBTex) {
        return -1; // A goes before B (TEX)
      }
      // If both are TEX or both are not TEX, sort normally

      const cellsA = Array.from(a.querySelectorAll('td'));
      const cellsB = Array.from(b.querySelectorAll('td'));

      if (cellsA.length <= columnIndex || cellsB.length <= columnIndex) {
        return 0;
      }

      const valueA = cellsA[columnIndex].textContent.trim();
      const valueB = cellsB[columnIndex].textContent.trim();

      const comparison = Utils.compareCellValues(valueA, valueB);
      return newDirection === 'asc' ? comparison : -comparison;
    });

    // Re-append sorted rows
    const tbody = table.querySelector('tbody');
    if (tbody) {
      rows.forEach(row => tbody.appendChild(row));
    }

    // Update sort state and icon
    sortState[columnIndex] = newDirection;
    updateSortIcon(headerCell, newDirection);

    // Call callback if provided
    if (onAfterSort) {
      setTimeout(() => {
        onAfterSort();
      }, 50);
    }
  }

  return {
    getSortState,
    clearSortState,
    updateSortIcon,
    handleColumnSort
  };
})();

