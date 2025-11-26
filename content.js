// Main content script - orchestrates all modules

(function() {
  'use strict';

  const Utils = window.TableExtensionUtils;
  const API = window.TableExtensionAPI;
  const Table = window.TableExtensionTable;
  const Filter = window.TableExtensionFilter;
  const Copy = window.TableExtensionCopy;

  /**
   * Inject CSS to remove padding from .MiddleDiv
   */
  function injectPageCSS() {
    // Check if CSS is already injected
    if (document.getElementById('extension-page-css')) {
      return; // Already injected
    }

    // Check storage for toggle state (default to enabled)
    chrome.storage.local.get(['extensionCSSEnabled'], function(result) {
      const enabled = result.extensionCSSEnabled !== false; // Default to true
      if (enabled) {
        const style = document.createElement('style');
        style.id = 'extension-page-css';
        style.textContent = `
          .MiddleDiv {
            padding: 0 !important;
          }
          .ce_border td {
            padding: 0 !important;
          }
          .tabContentSection {
            padding: 0 !important;
          }
          #article_data tbody tr {
            height: auto !important;
            min-height: auto !important;
            max-height: none !important;
          }
          .colErrorMessage {
            margin: 0 !important;
          }
          .fg-toolbar.ui-toolbar.ui-widget-header.ui-corner-tl.ui-corner-tr.ui-helper-clearfix {
            display: flex !important;
            justify-content: space-around !important;
            align-items: center !important;
          }
          .dataTables_wrapper .ui-toolbar {
            padding: 0 !important;
          }
          .dataTables-toolbar-wrapper {
            display: flex !important;
            align-items: center !important;
          }
          .dataTables_length {
            width: auto !important;
          }
          .dataTables_filter {
            width: auto !important;
          }
        `;
        document.head.appendChild(style);
        console.log('Page CSS injected');
      }
    });
  }

  /**
   * Remove extension CSS
   */
  function removePageCSS() {
    const style = document.getElementById('extension-page-css');
    if (style) {
      style.remove();
      console.log('Page CSS removed');
    }
  }

  /**
   * Toggle CSS based on state
   */
  function toggleCSS(enabled) {
    if (enabled) {
      // Inject CSS if not already present
      if (!document.getElementById('extension-page-css')) {
        const style = document.createElement('style');
        style.id = 'extension-page-css';
        style.textContent = `
          .MiddleDiv {
            padding: 0 !important;
          }
          .ce_border td {
            padding: 0 !important;
          }
          .tabContentSection {
            padding: 0 !important;
          }
          #article_data tbody tr {
            height: auto !important;
            min-height: auto !important;
            max-height: none !important;
          }
          .colErrorMessage {
            margin: 0 !important;
          }
          .fg-toolbar.ui-toolbar.ui-widget-header.ui-corner-tl.ui-corner-tr.ui-helper-clearfix {
            display: flex !important;
            justify-content: space-around !important;
            align-items: center !important;
          }
          .dataTables_wrapper .ui-toolbar {
            padding: 0 !important;
          }
          .dataTables-toolbar-wrapper {
            display: flex !important;
            align-items: center !important;
          }
          .dataTables_length {
            width: auto !important;
          }
          .dataTables_filter {
            width: auto !important;
          }
        `;
        document.head.appendChild(style);
        console.log('Page CSS enabled');
      }
    } else {
      removePageCSS();
      console.log('Page CSS disabled');
    }
  }

  // Listen for messages from popup
  chrome.runtime.onMessage.addListener(function(request, sender, sendResponse) {
    if (request.type === 'toggleCSS') {
      toggleCSS(request.enabled);
      sendResponse({ success: true });
    }
    return true;
  });

  /**
   * Create dataTables_info and pagination elements inside toolbar container
   */
  function createDataTablesInfo() {
    // Find the toolbar container
    const toolbar = document.querySelector('.fg-toolbar.ui-toolbar.ui-widget-header.ui-corner-tl.ui-corner-tr.ui-helper-clearfix');
    
    if (!toolbar) {
      console.log('Toolbar container not found');
      return;
    }

    // Check if wrapper already exists
    let wrapper = toolbar.querySelector('.dataTables-toolbar-wrapper');
    if (!wrapper) {
      wrapper = document.createElement('div');
      wrapper.className = 'dataTables-toolbar-wrapper';
      toolbar.appendChild(wrapper);
    }

    // Check if dataTables_info already exists
    let infoDiv = document.getElementById('article_data_info');
    
    if (!infoDiv) {
      // Create the dataTables_info div
      infoDiv = document.createElement('div');
      infoDiv.className = 'dataTables_info';
      infoDiv.id = 'article_data_info';
      infoDiv.textContent = 'Showing 1 to 4 of 4 entries';
    } else {
      // If it exists but is not in the wrapper, move it
      if (infoDiv.parentNode !== wrapper) {
        infoDiv.remove();
      }
    }
    
    // Add infoDiv to wrapper if not already there
    if (!wrapper.contains(infoDiv)) {
      wrapper.appendChild(infoDiv);
    }

    // Check if pagination already exists
    let paginateDiv = document.getElementById('article_data_paginate');
    
    if (!paginateDiv) {
      // Create the pagination div
      paginateDiv = document.createElement('div');
      paginateDiv.className = 'dataTables_paginate fg-buttonset ui-buttonset fg-buttonset-multi ui-buttonset-multi paging_full_numbers';
      paginateDiv.id = 'article_data_paginate';
      
      // Create First button
      const firstBtn = document.createElement('a');
      firstBtn.tabIndex = 0;
      firstBtn.className = 'first ui-corner-tl ui-corner-bl fg-button ui-button ui-state-default ui-state-disabled';
      firstBtn.id = 'article_data_first';
      firstBtn.textContent = 'First';
      paginateDiv.appendChild(firstBtn);
      
      // Create Previous button
      const prevBtn = document.createElement('a');
      prevBtn.tabIndex = 0;
      prevBtn.className = 'previous fg-button ui-button ui-state-default ui-state-disabled';
      prevBtn.id = 'article_data_previous';
      prevBtn.textContent = 'Previous';
      paginateDiv.appendChild(prevBtn);
      
      // Create page number span
      const pageSpan = document.createElement('span');
      const pageBtn = document.createElement('a');
      pageBtn.tabIndex = 0;
      pageBtn.className = 'fg-button ui-button ui-state-default ui-state-disabled';
      pageBtn.textContent = '1';
      pageSpan.appendChild(pageBtn);
      paginateDiv.appendChild(pageSpan);
      
      // Create Next button
      const nextBtn = document.createElement('a');
      nextBtn.tabIndex = 0;
      nextBtn.className = 'next fg-button ui-button ui-state-default ui-state-disabled';
      nextBtn.id = 'article_data_next';
      nextBtn.textContent = 'Next';
      paginateDiv.appendChild(nextBtn);
      
      // Create Last button
      const lastBtn = document.createElement('a');
      lastBtn.tabIndex = 0;
      lastBtn.className = 'last ui-corner-tr ui-corner-br fg-button ui-button ui-state-default ui-state-disabled';
      lastBtn.id = 'article_data_last';
      lastBtn.textContent = 'Last';
      paginateDiv.appendChild(lastBtn);
    } else {
      // If it exists but is not in the wrapper, move it
      if (paginateDiv.parentNode !== wrapper) {
        paginateDiv.remove();
      }
    }
    
    // Add paginateDiv to wrapper if not already there
    if (!wrapper.contains(paginateDiv)) {
      wrapper.appendChild(paginateDiv);
    }
    
    console.log('dataTables_info and pagination elements created inside wrapper');
  }

  /**
   * Setup DataTables event listeners
   */
  function setupDataTablesListener() {
    const table = Utils.getTable();
    if (!table) return;
    
    // Try to access DataTables API if available
    if (window.jQuery && window.jQuery.fn.dataTable) {
      try {
        const dataTable = window.jQuery('#article_data').DataTable();
        if (dataTable) {
          // Listen for draw event (fires on pagination, sorting, filtering)
          dataTable.on('draw', function() {
            console.log('DataTables draw event - populating DONE BY column');
            setTimeout(() => {
              Table.populateDoneByColumn(); // This will also highlight rows
              Filter.applyFilter(); // Reapply filter after draw
              // Ensure highlighting is applied after draw
              Table.highlightRows();
            }, 100);
          });
          console.log('DataTables listener attached');
        }
      } catch (e) {
        console.log('Could not attach DataTables listener:', e);
      }
    }
    
    // Fallback: Listen for pagination button clicks
    const paginationContainer = document.getElementById('article_data_paginate');
    if (paginationContainer) {
      paginationContainer.addEventListener('click', () => {
        setTimeout(() => {
          Table.populateDoneByColumn();
          Filter.applyFilter();
        }, 200);
      });
    }
    
    // Listen for page size changes
    const lengthSelect = document.querySelector('select[name="article_data_length"]');
    if (lengthSelect) {
      lengthSelect.addEventListener('change', () => {
        setTimeout(() => {
          Table.populateDoneByColumn();
          Filter.applyFilter();
        }, 200);
      });
    }
  }

  /**
   * Initialize the extension
   */
  async function initialize() {
    try {
      // Inject page CSS first
      injectPageCSS();
      
      // Wait for table to be available
      await Utils.waitForElement('#article_data', 10000);
      
      // Create dataTables_info element
      createDataTablesInfo();
      
      // Add the column first
      Table.addDoneByColumn();
      
      // Initialize filter
      Filter.initializeFilter();
      
      // Initialize copy button
      Copy.initializeCopyButton();
      
      // Fetch data from API (non-blocking)
      if (!API.isCurrentlyFetching()) {
        Table.showLoadingStatus();
        API.fetchDoneByData()
          .then(() => {
            Table.removeLoadingStatus();
            Table.populateDoneByColumn(); // This calls highlightRows internally
            Filter.applyFilter();
            // Explicitly call highlightRows after a short delay to ensure it runs
            setTimeout(() => {
              Table.highlightRows();
            }, 200);
          })
          .catch(err => {
            console.error('Failed to fetch data:', err);
            Table.removeLoadingStatus();
            Table.populateDoneByColumn();
            Filter.applyFilter();
            // Explicitly call highlightRows after a short delay
            setTimeout(() => {
              Table.highlightRows();
            }, 200);
          });
      }
      
      // Setup DataTables listeners
      setTimeout(() => {
        setupDataTablesListener();
      }, 1000);
      
    } catch (error) {
      console.error('Initialization error:', error);
    }
  }

  /**
   * Delayed initialization for dynamically loaded tables
   */
  let delayedInitDone = false;
  setTimeout(() => {
    if (!delayedInitDone) {
      // Inject CSS if not already done
      injectPageCSS();
      
      const table = Utils.getTable();
      if (table) {
        createDataTablesInfo();
        Table.addDoneByColumn();
        Filter.initializeFilter();
        Copy.initializeCopyButton();
        API.fetchDoneByData().catch(err => console.error('Delayed fetch failed:', err));
        delayedInitDone = true;
      }
    }
  }, 2000);

  /**
   * MutationObserver for table changes
   */
  let observerTriggered = false;
  const observer = new MutationObserver(() => {
    const table = Utils.getTable();
    if (table) {
      const headerRow = Utils.getHeaderRow(table);
      if (headerRow) {
        const existingHeader = Array.from(headerRow.querySelectorAll('th')).find(
          th => th.textContent.trim().includes('DONE BY')
        );
        if (!existingHeader && !observerTriggered) {
          observerTriggered = true;
          createDataTablesInfo();
          Table.addDoneByColumn();
          Filter.initializeFilter();
          Copy.initializeCopyButton();
          API.fetchDoneByData().catch(err => console.error('Observer fetch failed:', err));
        }
      }
    }
  });

  // Start observing
  observer.observe(document.body, {
    childList: true,
    subtree: true
  });

  // Observer to create dataTables_info and pagination when toolbar appears
  const toolbarObserver = new MutationObserver(() => {
    const toolbar = document.querySelector('.fg-toolbar.ui-toolbar.ui-widget-header.ui-corner-tl.ui-corner-tr.ui-helper-clearfix');
    if (toolbar && (!document.getElementById('article_data_info') || !document.getElementById('article_data_paginate'))) {
      createDataTablesInfo();
    }
  });

  toolbarObserver.observe(document.body, {
    childList: true,
    subtree: true
  });

  // Run when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initialize);
  } else {
    initialize();
  }
})();
