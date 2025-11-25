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
    if (document.getElementById('extension-page-css')) {
      return; // Already injected
    }

    const style = document.createElement('style');
    style.id = 'extension-page-css';
    style.textContent = `
      .MiddleDiv {
        padding: 0 !important;
      }
    `;
    document.head.appendChild(style);
    console.log('Page CSS injected: .MiddleDiv padding removed');
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

  // Run when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initialize);
  } else {
    initialize();
  }
})();
