// Table Manager - Handles column addition and population - Global namespace

window.TableExtensionTable = (function () {
  'use strict';

  const Utils = window.TableExtensionUtils;
  const API = window.TableExtensionAPI;
  const HeaderBuilder = window.TableExtensionHeaderBuilder;
  const ARTICLE_ID_COLUMN = 'Article ID';
  const DONE_BY_COLUMN = 'DONE BY';
  const SRC_COLUMN = 'SRC';

  // Highlight rules: name -> color mapping
  const HIGHLIGHT_RULES = {
    'Ruchi': '#e3f2fd',
  };

  // Cell colors for SRC column values
  const SRC_CELL_COLORS = {
    'DOCX': '#eeeeee',
    'TEX': '#e5e5e5',
  };

  // Flag to prevent recursive reordering
  let isReordering = false;

  // ============ CORE FUNCTIONS ============

  function showLoadingStatus() {
    const table = Utils.getTable();
    if (!table) return;

    const headers = Utils.getHeaders(table);
    const doneByHeaderIndex = Utils.findColumnIndex(table, DONE_BY_COLUMN);

    if (doneByHeaderIndex === -1) return;

    const doneByHeader = headers[doneByHeaderIndex];
    const wrapper = doneByHeader.querySelector('.DataTables_sort_wrapper');
    if (wrapper) {
      wrapper.innerHTML = 'DONE BY <span style="color: #667eea; font-size: 10px;">(Loading...)</span>';
    }

    const rows = Utils.getTableRows(table);
    rows.forEach((row) => {
      const cells = Array.from(row.querySelectorAll('td'));
      if (cells.length > doneByHeaderIndex) {
        const doneByCell = cells[doneByHeaderIndex];
        doneByCell.innerHTML = '<span style="color: #999; font-style: italic;">Loading...</span>';
      }
    });
  }

  function removeLoadingStatus() {
    const table = Utils.getTable();
    if (!table) return;

    const headers = Utils.getHeaders(table);
    const doneByHeader = headers.find(
      th => th.textContent.trim().includes(DONE_BY_COLUMN)
    );

    if (doneByHeader) {
      const wrapper = doneByHeader.querySelector('.DataTables_sort_wrapper');
      if (wrapper) {
        wrapper.innerHTML = 'DONE BY<span class="DataTables_sort_icon css_right ui-icon ui-icon-carat-2-n-s"></span>';
      }
    }
  }

  function populateDoneByColumn() {
    const table = Utils.getTable();
    if (!table) return;

    const headers = Utils.getHeaders(table);

    let doneByHeaderIndex = -1;
    let articleIdIndex = -1;

    headers.forEach((th, index) => {
      const headerText = th.textContent.trim();
      const headerLower = headerText.toLowerCase();

      if (headerLower === 'done by' || headerText === 'DONE BY') {
        doneByHeaderIndex = index;
      }
      if (headerLower === 'article id' || headerText === 'Article ID') {
        articleIdIndex = index;
      }
    });

    if (doneByHeaderIndex === -1) {
      doneByHeaderIndex = Utils.findColumnIndex(table, DONE_BY_COLUMN);
    }
    if (articleIdIndex === -1) {
      articleIdIndex = Utils.findColumnIndex(table, ARTICLE_ID_COLUMN);
    }

    if (doneByHeaderIndex === -1 || articleIdIndex === -1) {
      return;
    }

    if (doneByHeaderIndex >= headers.length || articleIdIndex >= headers.length) {
      return;
    }

    const foundDoneByHeader = headers[doneByHeaderIndex]?.textContent.trim() || '';
    const foundArticleIdHeader = headers[articleIdIndex]?.textContent.trim() || '';
    if (!foundDoneByHeader.toLowerCase().includes('done by') ||
      !foundArticleIdHeader.toLowerCase().includes('article id')) {
      return;
    }

    const rows = Utils.getTableRows(table);
    const articleMap = API.getArticleMap();

    const expectedMinColumns = Math.max(articleIdIndex, doneByHeaderIndex) + 1;
    if (headers.length < expectedMinColumns) {
      return;
    }

    rows.forEach((row) => {
      const cells = Array.from(row.querySelectorAll('td'));

      if (cells.length < headers.length) {
        return;
      }

      const articleId = cells[articleIdIndex]?.textContent.trim() || '';
      if (!articleId) {
        return;
      }

      if (!/^[A-Z0-9]+/.test(articleId)) {
        return;
      }

      const doneBy = articleMap.get(articleId) || '-';
      
      if (cells.length > doneByHeaderIndex) {
        const doneByCell = cells[doneByHeaderIndex];
        doneByCell.textContent = doneBy;
      } else {
        const articleIdCell = cells[articleIdIndex];
        if (articleIdCell) {
          const newCell = document.createElement('td');
          newCell.align = 'center';
          newCell.className = ' ';
          newCell.textContent = doneBy;
          articleIdCell.insertAdjacentElement('afterend', newCell);
        }
      }
    });
  }

  function colorSrcCells() {
    const table = Utils.getTable();
    if (!table) return;

    const srcColumnIndex = Utils.findColumnIndex(table, SRC_COLUMN);
    if (srcColumnIndex === -1) return;

    const rows = Utils.getTableRows(table);

    rows.forEach((row) => {
      const cells = Array.from(row.querySelectorAll('td'));
      if (cells.length <= srcColumnIndex) return;

      const srcValue = Utils.getCellValue(row, srcColumnIndex).trim().toUpperCase();
      const cellColor = SRC_CELL_COLORS[srcValue];

      cells.forEach((cell) => {
        if (cellColor) {
          cell.style.setProperty('background-color', cellColor, 'important');
        } else {
          cell.style.removeProperty('background-color');
        }
      });
    });
  }

  function highlightRows() {
    const table = Utils.getTable();
    if (!table) return;

    const doneByIndex = Utils.findColumnIndex(table, DONE_BY_COLUMN);
    if (doneByIndex === -1) return;

    const rows = Utils.getTableRows(table);

    rows.forEach((row) => {
      const doneBy = Utils.getCellValue(row, doneByIndex).trim();

      Object.keys(HIGHLIGHT_RULES).forEach((name, index) => {
        row.classList.remove(`highlight-row-${index}`);
      });
      row.style.removeProperty('background-color');
      row.removeAttribute('data-highlighted');

      if (HIGHLIGHT_RULES.hasOwnProperty(doneBy)) {
        const color = HIGHLIGHT_RULES[doneBy];
        const index = Object.keys(HIGHLIGHT_RULES).indexOf(doneBy);
        row.classList.add(`highlight-row-${index}`);
        row.style.setProperty('background-color', color, 'important');
        row.setAttribute('data-highlighted', doneBy);
      }
    });

    colorSrcCells();
  }

  function addDoneByColumn() {
    const table = Utils.getTable();
    if (!table) return;

    const headerRow = Utils.getHeaderRow(table);
    if (!headerRow) return;

    const headers = Utils.getHeaders(table);
    const existingHeader = headers.find(
      th => th.textContent.trim().includes(DONE_BY_COLUMN)
    );

    if (existingHeader) {
      populateDoneByColumn();
      return;
    }

    let articleIdHeader = headers.find(
      th => {
        const text = th.textContent.trim();
        return text.toLowerCase() === 'article id' || text === 'Article ID';
      }
    );

    if (!articleIdHeader) {
      articleIdHeader = headers.find(
        th => th.textContent.trim().toLowerCase().includes('article id')
      );
    }

    if (!articleIdHeader) return;

    const articleIdHeaderText = articleIdHeader.textContent.trim();
    if (!articleIdHeaderText.toLowerCase().includes('article id')) return;

    const newHeader = document.createElement('th');
    newHeader.className = 'ui-state-default';
    newHeader.setAttribute('role', 'columnheader');
    newHeader.setAttribute('tabindex', '0');
    newHeader.setAttribute('aria-controls', 'article_data');
    newHeader.setAttribute('rowspan', '1');
    newHeader.setAttribute('colspan', '1');
    newHeader.style.width = '100px';

    const wrapper = document.createElement('div');
    wrapper.className = 'DataTables_sort_wrapper';
    wrapper.textContent = DONE_BY_COLUMN;

    const sortIcon = document.createElement('span');
    sortIcon.className = 'DataTables_sort_icon css_right ui-icon ui-icon-carat-2-n-s';
    wrapper.appendChild(sortIcon);

    newHeader.appendChild(wrapper);
    articleIdHeader.insertAdjacentElement('afterend', newHeader);

    const rows = Utils.getTableRows(table);
    const articleMap = API.getArticleMap();
    const articleIdIndex = Utils.findColumnIndex(table, ARTICLE_ID_COLUMN);
    if (articleIdIndex === -1) return;

    rows.forEach((row) => {
      const cells = Array.from(row.querySelectorAll('td'));
      if (cells.length > articleIdIndex) {
        const articleIdCell = cells[articleIdIndex];
        const articleId = articleIdCell.textContent.trim();
        if (articleId) {
          const doneBy = articleMap.get(articleId) || '-';
          const newCell = document.createElement('td');
          newCell.align = 'center';
          newCell.className = ' ';
          newCell.textContent = doneBy;
          articleIdCell.insertAdjacentElement('afterend', newCell);
        }
      }
    });
  }

  // ============ TEX ROW ORDERING ============

  /**
   * Move TEX rows to bottom of table - CORE function
   * This is the ONLY function that moves rows
   */
  function moveTexRowsToBottom() {
    // Prevent recursive calls
    if (isReordering) return;
    
    const table = Utils.getTable();
    if (!table) return;

    const rows = Array.from(Utils.getTableRows(table));
    if (rows.length === 0) return;

    const srcColumnIndex = Utils.findColumnIndex(table, SRC_COLUMN);
    if (srcColumnIndex === -1) return;

    // Check if already in correct order (optimization)
    if (Utils.areTexRowsAtBottom(rows, srcColumnIndex)) return;

    const { texRows, nonTexRows } = Utils.splitRowsBySrc(rows, srcColumnIndex);
    if (texRows.length === 0) return;

    const tbody = table.querySelector('tbody');
    if (!tbody) return;

    // Set flag to prevent recursive calls
    isReordering = true;

    // Move rows using fragment for performance
    const fragment = document.createDocumentFragment();
    nonTexRows.forEach(row => fragment.appendChild(row));
    texRows.forEach(row => fragment.appendChild(row));
    tbody.appendChild(fragment);

    // Clear flag
    isReordering = false;
  }

  /**
   * Apply everything: move TEX rows then highlight
   */
  function applyTableOrder() {
    moveTexRowsToBottom();
    highlightRows();
  }

  /**
   * Finalize initial load - main entry point after data is loaded
   */
  function finalizeInitialLoad() {
    applyTableOrder();
  }

  // ============ DATATABLES INTEGRATION ============

  let dataTablesHooksInstalled = false;

  /**
   * Setup DataTables hooks - called once
   */
  function setupDataTablesTexSorting() {
    if (dataTablesHooksInstalled) return;
    if (!window.jQuery || !window.jQuery.fn.dataTable) return;

    try {
      const dataTable = window.jQuery('#article_data').DataTable();
      if (!dataTable) return;

      // Remove any existing handlers and add new ones
      dataTable.off('.texsort');
      
      // Single handler for all DataTables events
      dataTable.on('draw.texsort', function() {
        // Use requestAnimationFrame to ensure DOM is updated
        requestAnimationFrame(() => {
          applyTableOrder();
        });
      });

      dataTablesHooksInstalled = true;

      // Apply immediately
      applyTableOrder();
    } catch (e) {
      // DataTables not available
    }
  }

  /**
   * Sort by DONE BY column initially
   */
  function enableSortingOnDoneByColumn() {
    setupDataTablesTexSorting();

    if (window.jQuery && window.jQuery.fn.dataTable) {
      try {
        const dataTable = window.jQuery('#article_data').DataTable();
        if (dataTable) {
          const doneByIndex = Utils.findColumnIndex(Utils.getTable(), DONE_BY_COLUMN);
          if (doneByIndex !== -1) {
            dataTable.order([doneByIndex, 'asc']).draw();
            // The draw event will trigger applyTableOrder
          }
        }
      } catch (e) {
        // Fallback: just apply order
        applyTableOrder();
      }
    }
  }

  function replaceTableHeader() {
    HeaderBuilder.replaceTableHeader(highlightRows);
  }

  function handleColumnSort(columnIndex, headerCell) {
    const Sort = window.TableExtensionSort;
    Sort.handleColumnSort(columnIndex, headerCell, () => {
      applyTableOrder();
    });
  }

  // Public API
  return {
    showLoadingStatus,
    removeLoadingStatus,
    populateDoneByColumn,
    addDoneByColumn,
    enableSortingOnDoneByColumn,
    highlightRows,
    colorSrcCells,
    replaceTableHeader,
    handleColumnSort,
    setupDataTablesTexSorting,
    moveTexRowsToBottom,
    finalizeInitialLoad,
    applyTableOrder
  };
})();

