// Main content script - orchestrates all modules

(function() {
  'use strict';

  const Utils = window.TableExtensionUtils;
  const API = window.TableExtensionAPI;
  const Table = window.TableExtensionTable;
  const Filter = window.TableExtensionFilter;
  const Copy = window.TableExtensionCopy;
  const Stats = window.TableExtensionStats;
  const Toast = window.TableExtensionToast;
  const PastDue = window.TableExtensionPastDue;

  const ERROR_MESSAGE = 'Internal Server Error';
  const INIT_DELAY = 500;
  const POST_FETCH_DELAY = 200;

  /**
   * Initialize core components (without Done By column)
   */
  function initializeComponents() {
    Filter.initializeFilter();
    Copy.initializeCopyButton();
  }

  /**
   * Refresh table data after DataTables events
   */
  function refreshTableData() {
    Table.populateDoneByColumn();
    Filter.applyFilter();
  }

  /**
   * Handle API fetch success
   * @param {boolean} showLoading - Whether to remove loading status
   */
  function handleApiSuccess(showLoading = false) {
    if (showLoading) {
      Table.removeLoadingStatus();
    }
    // Add Done By column after API response
    Table.addDoneByColumn();
    refreshTableData();
    setTimeout(() => {
      Table.highlightRows();
      PastDue.checkPastDueFiles(Toast.showToast);
      Stats.displayTodayStats(Toast.showToast);
    }, POST_FETCH_DELAY);
  }

  /**
   * Handle API fetch error
   * @param {boolean} showLoading - Whether to remove loading status
   */
  function handleApiError(showLoading = false) {
    if (showLoading) {
      Table.removeLoadingStatus();
    }
    Toast.showToast([ERROR_MESSAGE]);
  }

  /**
   * Fetch API data with error handling
   * @param {boolean} showLoading - Whether to show/remove loading status
   * @param {number} delay - Delay before post-fetch operations
   */
  function fetchApiData(showLoading = false, delay = POST_FETCH_DELAY) {
    if (API.isCurrentlyFetching()) {
      return;
    }

    if (showLoading) {
      Table.showLoadingStatus();
    }

    API.fetchDoneByData()
      .then(() => {
        if (delay > 0) {
          setTimeout(() => {
            handleApiSuccess(showLoading);
          }, delay);
        } else {
          handleApiSuccess(showLoading);
        }
      })
      .catch(() => {
        handleApiError(showLoading);
      });
  }

  /**
   * Set default page length to 500
   * @returns {boolean}
   */
  function setDefaultPageLength() {
    let success = false;

    if (window.jQuery && window.jQuery.fn.dataTable) {
      try {
        const dataTable = window.jQuery('#article_data').DataTable();
        if (dataTable) {
          dataTable.page.len(500).draw();
          success = true;
        }
      } catch (e) {
        // DataTables not ready
      }
    }

    const lengthSelect = document.querySelector('select[name="article_data_length"]');
    if (lengthSelect) {
      let option500 = lengthSelect.querySelector('option[value="500"]');
      if (!option500) {
        option500 = document.createElement('option');
        option500.value = '500';
        option500.textContent = '500';
        lengthSelect.appendChild(option500);
      }

      lengthSelect.value = '500';

      if (!success) {
        const changeEvent = new Event('change', { bubbles: true });
        lengthSelect.dispatchEvent(changeEvent);
      }

      success = true;
    }

    return success;
  }

  /**
   * Setup DataTables event listeners
   */
  function setupDataTablesListener() {
    const table = Utils.getTable();
    if (!table) return;

    if (window.jQuery && window.jQuery.fn.dataTable) {
      try {
        const dataTable = window.jQuery('#article_data').DataTable();
        if (dataTable) {
          dataTable.on('draw', function() {
            setTimeout(() => {
              refreshTableData();
              Table.highlightRows();
            }, 100);
          });
        }
      } catch (e) {
        // DataTables not available
      }
    }

    const paginationContainer = document.getElementById('article_data_paginate');
    if (paginationContainer) {
      paginationContainer.addEventListener('click', () => {
        setTimeout(refreshTableData, POST_FETCH_DELAY);
      });
    }

    const lengthSelect = document.querySelector('select[name="article_data_length"]');
    if (lengthSelect) {
      lengthSelect.addEventListener('change', () => {
        setTimeout(refreshTableData, POST_FETCH_DELAY);
      });
    }
  }

  /**
   * Initialize the extension
   */
  async function initialize() {
    try {
      await Utils.waitForElement('#article_data', 10000);

      let dataTableReady = false;
      if (window.jQuery && window.jQuery.fn.dataTable) {
        try {
          const dataTable = window.jQuery('#article_data').DataTable();
          if (dataTable) {
            dataTableReady = true;
          }
        } catch (e) {
          // DataTables not ready yet
        }
      }

      if (!dataTableReady) {
        await new Promise(resolve => setTimeout(resolve, 500));
      }

      let retryCount = 0;
      while (!setDefaultPageLength() && retryCount < 10) {
        await new Promise(resolve => setTimeout(resolve, 200));
        retryCount++;
      }

      initializeComponents();
      fetchApiData(true);

      setTimeout(() => {
        setupDataTablesListener();
      }, 1000);

    } catch (error) {
      // Initialization failed
    }
  }

  /**
   * Delayed initialization for dynamically loaded tables
   */
  let delayedInitDone = false;
  setTimeout(() => {
    if (!delayedInitDone) {
      const table = Utils.getTable();
      if (table) {
        initializeComponents();
        fetchApiData(false, INIT_DELAY);
        setTimeout(() => {
          setDefaultPageLength();
        }, 1500);
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
          initializeComponents();
          fetchApiData(false, INIT_DELAY);
          setTimeout(() => {
            setDefaultPageLength();
          }, 1500);
        }
      }
    }
  });

  observer.observe(document.body, {
    childList: true,
    subtree: true
  });

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initialize);
  } else {
    initialize();
  }
})();
