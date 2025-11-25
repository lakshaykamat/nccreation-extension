// Table Manager - Handles column addition and population - Global namespace

window.TableExtensionTable = (function() {
  'use strict';

  const Utils = window.TableExtensionUtils;
  const API = window.TableExtensionAPI;
  const ARTICLE_ID_COLUMN = 'Article ID';
  const DONE_BY_COLUMN = 'DONE BY';
  
  // Highlight rules: name -> color mapping
  // Easy to add new entries: just add 'Name': 'color' to this object
  const HIGHLIGHT_RULES = {
    'Ruchi': '#e3f2fd',  // Light blue
    // 'DDN': '#fff3e0',  // Light orange (example - uncomment to enable)
    // 'Ankur': '#f3e5f5', // Light purple (example - uncomment to enable)
  };

  /**
   * Show loading status in the DONE BY column
   */
  function showLoadingStatus() {
    const table = Utils.getTable();
    if (!table) return;
    
    const headers = Utils.getHeaders(table);
    const doneByHeaderIndex = Utils.findColumnIndex(table, DONE_BY_COLUMN);
    
    if (doneByHeaderIndex === -1) return;
    
    // Update header to show loading
    const doneByHeader = headers[doneByHeaderIndex];
    const wrapper = doneByHeader.querySelector('.DataTables_sort_wrapper');
    if (wrapper) {
      wrapper.innerHTML = 'DONE BY <span style="color: #667eea; font-size: 10px;">(Loading...)</span>';
    }
    
    // Update all cells to show loading
    const rows = Utils.getTableRows(table);
    rows.forEach((row) => {
      const cells = Array.from(row.querySelectorAll('td'));
      if (cells.length > doneByHeaderIndex) {
        const doneByCell = cells[doneByHeaderIndex];
        doneByCell.innerHTML = '<span style="color: #999; font-style: italic;">Loading...</span>';
      }
    });
  }

  /**
   * Remove loading status from header
   */
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

  /**
   * Populate the DONE BY column with data from API
   */
  function populateDoneByColumn() {
    const table = Utils.getTable();
    if (!table) return;
    
    const headers = Utils.getHeaders(table);
    const doneByHeaderIndex = Utils.findColumnIndex(table, DONE_BY_COLUMN);
    const articleIdIndex = Utils.findColumnIndex(table, ARTICLE_ID_COLUMN);
    
    if (doneByHeaderIndex === -1 || articleIdIndex === -1) {
      console.log('Required columns not found');
      return;
    }
    
    const rows = Utils.getTableRows(table);
    const articleMap = API.getArticleMap();
    let populatedCount = 0;
    
    rows.forEach((row) => {
      const cells = Array.from(row.querySelectorAll('td'));
      
      if (cells.length > articleIdIndex) {
        const articleId = Utils.getCellValue(row, articleIdIndex);
        
        // Get or create DONE BY cell
        if (cells.length > doneByHeaderIndex) {
          const doneByCell = cells[doneByHeaderIndex];
          const doneBy = articleMap.get(articleId) || '-';
          doneByCell.textContent = doneBy;
          populatedCount++;
        } else if (cells.length > articleIdIndex) {
          // Cell doesn't exist, need to add it
          const articleIdCell = cells[articleIdIndex];
          const newCell = document.createElement('td');
          newCell.align = 'center';
          newCell.className = ' ';
          newCell.textContent = articleMap.get(articleId) || '-';
          articleIdCell.insertAdjacentElement('afterend', newCell);
          populatedCount++;
        }
      }
    });
    
    console.log(`Populated DONE BY column for ${populatedCount} rows`);
    
    // Highlight rows with "Ruchi" in Done by
    highlightRows();
    
    // Re-sort by DONE BY column after populating
    setTimeout(() => {
      if (window.jQuery && window.jQuery.fn.dataTable) {
        try {
          const dataTable = window.jQuery('#article_data').DataTable();
          if (dataTable) {
            const doneByIndex = Utils.findColumnIndex(Utils.getTable(), DONE_BY_COLUMN);
            if (doneByIndex !== -1) {
              dataTable.order([doneByIndex, 'asc']).draw(false);
              // Re-highlight after sort
              setTimeout(() => {
                highlightRows();
              }, 150);
            }
          }
        } catch (e) {
          // DataTables not available
        }
      }
    }, 100);
  }

  /**
   * Inject CSS for highlighting if not already present
   */
  function injectHighlightCSS() {
    if (document.getElementById('table-highlight-style')) {
      return; // Already injected
    }

    // Generate CSS for all highlight rules
    let cssRules = '';
    Object.keys(HIGHLIGHT_RULES).forEach((name, index) => {
      const color = HIGHLIGHT_RULES[name];
      const className = `highlight-row-${index}`;
      cssRules += `
        #article_data tbody tr.${className} {
          background-color: ${color} !important;
        }
        #article_data tbody tr.${className} td {
          background-color: transparent !important;
        }
      `;
    });

    const style = document.createElement('style');
    style.id = 'table-highlight-style';
    style.textContent = cssRules;
    document.head.appendChild(style);
  }

  /**
   * Highlight rows where Done by matches the highlight name
   */
  function highlightRows() {
    const table = Utils.getTable();
    if (!table) {
      console.log('Table not found for highlighting');
      return;
    }

    // Inject CSS first
    injectHighlightCSS();

    const doneByIndex = Utils.findColumnIndex(table, DONE_BY_COLUMN);
    if (doneByIndex === -1) {
      console.log('DONE BY column index not found for highlighting');
      return;
    }

    const rows = Utils.getTableRows(table);
    const highlightCounts = {};
    const foundValues = new Set();

    // Initialize counts for each rule
    Object.keys(HIGHLIGHT_RULES).forEach(name => {
      highlightCounts[name] = 0;
    });

    rows.forEach((row) => {
      const doneBy = Utils.getCellValue(row, doneByIndex).trim();
      foundValues.add(doneBy);
      
      // Remove all highlight classes first
      Object.keys(HIGHLIGHT_RULES).forEach((name, index) => {
        row.classList.remove(`highlight-row-${index}`);
      });
      row.style.removeProperty('background-color');
      row.removeAttribute('data-highlighted');
      
      // Check if this row matches any highlight rule
      if (HIGHLIGHT_RULES.hasOwnProperty(doneBy)) {
        const color = HIGHLIGHT_RULES[doneBy];
        const index = Object.keys(HIGHLIGHT_RULES).indexOf(doneBy);
        
        // Use both class and inline style with !important
        row.classList.add(`highlight-row-${index}`);
        row.style.setProperty('background-color', color, 'important');
        row.setAttribute('data-highlighted', doneBy);
        highlightCounts[doneBy]++;
      }
    });

    // Log results
    const totalHighlighted = Object.values(highlightCounts).reduce((sum, count) => sum + count, 0);
    if (totalHighlighted > 0) {
      const summary = Object.keys(HIGHLIGHT_RULES)
        .filter(name => highlightCounts[name] > 0)
        .map(name => `${name}: ${highlightCounts[name]}`)
        .join(', ');
      console.log(`Highlighted ${totalHighlighted} rows (${summary})`);
    } else {
      console.log(`No rows found matching highlight rules. Found values:`, Array.from(foundValues).slice(0, 10));
    }
  }

  /**
   * Add DONE BY column to the table
   */
  function addDoneByColumn() {
    const table = Utils.getTable();
    if (!table) {
      console.log('Table not found');
      return;
    }

    const headerRow = Utils.getHeaderRow(table);
    if (!headerRow) return;

    // Check if column already exists
    const headers = Utils.getHeaders(table);
    const existingHeader = headers.find(
      th => th.textContent.trim().includes(DONE_BY_COLUMN)
    );
    
    if (existingHeader) {
      console.log('DONE BY column already exists');
      populateDoneByColumn();
      return;
    }

    // Find Article ID column header
    const articleIdHeader = headers.find(
      th => th.textContent.trim().includes(ARTICLE_ID_COLUMN)
    );
    
    if (!articleIdHeader) {
      console.log('Article ID column not found');
      return;
    }

    // Create new header column
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
    
    // Insert after Article ID header
    articleIdHeader.insertAdjacentElement('afterend', newHeader);
    
    // Enable sorting on the new column
    enableSortingOnDoneByColumn();

    // Add data cells to all rows
    const rows = Utils.getTableRows(table);
    const articleMap = API.getArticleMap();
    
    rows.forEach((row) => {
      const cells = Array.from(row.querySelectorAll('td'));
      if (cells.length > 2) {
        const articleIdCell = cells[2];
        const articleId = articleIdCell.textContent.trim();
        const doneBy = articleMap.get(articleId) || '-';
        
        const newCell = document.createElement('td');
        newCell.align = 'center';
        newCell.className = ' ';
        newCell.textContent = doneBy;
        articleIdCell.insertAdjacentElement('afterend', newCell);
      }
    });

    console.log('DONE BY column added successfully');
  }

  /**
   * Enable sorting on DONE BY column and sort by default
   */
  function enableSortingOnDoneByColumn() {
    // Wait a bit for DataTables to recognize the new column
    setTimeout(() => {
      if (window.jQuery && window.jQuery.fn.dataTable) {
        try {
          const dataTable = window.jQuery('#article_data').DataTable();
          if (dataTable) {
            // Find the DONE BY column index
            const doneByIndex = Utils.findColumnIndex(Utils.getTable(), DONE_BY_COLUMN);
            if (doneByIndex !== -1) {
              // Sort by DONE BY column (ascending) by default
              dataTable.order([doneByIndex, 'asc']).draw();
              console.log('Sorted by DONE BY column');
            }
          }
        } catch (e) {
          console.log('Could not enable sorting:', e);
        }
      }
    }, 500);
  }

  // Public API
  return {
    showLoadingStatus,
    removeLoadingStatus,
    populateDoneByColumn,
    addDoneByColumn,
    enableSortingOnDoneByColumn,
    highlightRows
  };
})();
