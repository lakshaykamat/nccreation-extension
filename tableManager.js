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
    
    // Get fresh column indices each time (important after pagination)
    const headers = Utils.getHeaders(table);
    
    // Find columns with strict validation
    let doneByHeaderIndex = -1;
    let articleIdIndex = -1;
    
    headers.forEach((th, index) => {
      const headerText = th.textContent.trim();
      const headerLower = headerText.toLowerCase();
      
      // Exact match for DONE BY
      if (headerLower === 'done by' || headerText === 'DONE BY') {
        doneByHeaderIndex = index;
      }
      
      // Exact match for Article ID (case-insensitive)
      if (headerLower === 'article id' || headerText === 'Article ID') {
        articleIdIndex = index;
      }
    });
    
    // If exact match failed, try the findColumnIndex method
    if (doneByHeaderIndex === -1) {
      doneByHeaderIndex = Utils.findColumnIndex(table, DONE_BY_COLUMN);
    }
    if (articleIdIndex === -1) {
      articleIdIndex = Utils.findColumnIndex(table, ARTICLE_ID_COLUMN);
    }
    
    if (doneByHeaderIndex === -1 || articleIdIndex === -1) {
      console.log('Required columns not found', { 
        doneByHeaderIndex, 
        articleIdIndex,
        availableHeaders: headers.map((h, i) => `${i}: "${h.textContent.trim()}"`).join(', ')
      });
      return;
    }
    
    // Verify column indices are valid
    if (doneByHeaderIndex >= headers.length || articleIdIndex >= headers.length) {
      console.log('Column indices out of range', { doneByHeaderIndex, articleIdIndex, headerCount: headers.length });
      return;
    }
    
    // Final verification - ensure headers match what we expect
    const foundDoneByHeader = headers[doneByHeaderIndex]?.textContent.trim() || '';
    const foundArticleIdHeader = headers[articleIdIndex]?.textContent.trim() || '';
    if (!foundDoneByHeader.toLowerCase().includes('done by') || 
        !foundArticleIdHeader.toLowerCase().includes('article id')) {
      console.log('Column header mismatch - aborting to prevent data corruption', { 
        expectedDoneBy: DONE_BY_COLUMN, 
        foundDoneBy: foundDoneByHeader,
        foundDoneByIndex: doneByHeaderIndex,
        expectedArticleId: ARTICLE_ID_COLUMN,
        foundArticleId: foundArticleIdHeader,
        foundArticleIdIndex: articleIdIndex
      });
      return;
    }
    
    const rows = Utils.getTableRows(table);
    const articleMap = API.getArticleMap();
    let populatedCount = 0;
    
    // Verify header count matches expected column structure
    const expectedMinColumns = Math.max(articleIdIndex, doneByHeaderIndex) + 1;
    if (headers.length < expectedMinColumns) {
      console.log('Header count mismatch', { headers: headers.length, expected: expectedMinColumns });
      return;
    }
    
    rows.forEach((row) => {
      const cells = Array.from(row.querySelectorAll('td'));
      
      // Ensure we have enough cells to match headers
      if (cells.length < headers.length) {
        return; // Skip rows that don't match header structure
      }
      
      // Double-check we're reading from the correct Article ID column
      const articleId = cells[articleIdIndex]?.textContent.trim() || '';
      if (!articleId) {
        return; // Skip rows without article ID
      }
      
      // Verify the cell we're reading from looks like an Article ID (contains alphanumeric pattern)
      // This is a safety check to ensure we're not reading from the wrong column
      if (!/^[A-Z0-9]+/.test(articleId)) {
        console.log('Suspicious Article ID value, skipping row', { articleId, columnIndex: articleIdIndex });
        return;
      }
      
      // Get or create DONE BY cell - verify we're writing to the correct column
      if (cells.length > doneByHeaderIndex) {
        const doneByCell = cells[doneByHeaderIndex];
        // Verify this cell is in the DONE BY column by checking its position matches header
        const doneBy = articleMap.get(articleId) || '-';
        doneByCell.textContent = doneBy;
        populatedCount++;
      } else {
        // Cell doesn't exist, need to add it after Article ID
        const articleIdCell = cells[articleIdIndex];
        const newCell = document.createElement('td');
        newCell.align = 'center';
        newCell.className = ' ';
        newCell.textContent = articleMap.get(articleId) || '-';
        articleIdCell.insertAdjacentElement('afterend', newCell);
        populatedCount++;
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
   * Highlight rows where Done by matches the highlight name
   */
  function highlightRows() {
    const table = Utils.getTable();
    if (!table) {
      console.log('Table not found for highlighting');
      return;
    }

    // Inject CSS first

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

    // Find Article ID column header with strict matching
    let articleIdHeader = headers.find(
      th => {
        const text = th.textContent.trim();
        return text.toLowerCase() === 'article id' || text === 'Article ID';
      }
    );
    
    // Fallback to includes if exact match fails
    if (!articleIdHeader) {
      articleIdHeader = headers.find(
        th => th.textContent.trim().toLowerCase().includes('article id')
      );
    }
    
    if (!articleIdHeader) {
      console.log('Article ID column not found. Available headers:', 
        headers.map((h, i) => `${i}: "${h.textContent.trim()}"`).join(', '));
      return;
    }
    
    // Verify we found the correct column
    const articleIdHeaderText = articleIdHeader.textContent.trim();
    if (!articleIdHeaderText.toLowerCase().includes('article id')) {
      console.log('Found column does not match Article ID:', articleIdHeaderText);
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
    
    // Find Article ID column index (should be the one we just found)
    const articleIdIndex = Utils.findColumnIndex(table, ARTICLE_ID_COLUMN);
    if (articleIdIndex === -1) {
      console.log('Article ID column not found when adding cells');
      return;
    }
    
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
