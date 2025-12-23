// Main content script - orchestrates all modules with PARALLEL execution

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
  const Notification = window.TableExtensionNotification;

  const ERROR_MESSAGE = 'Internal Server Error';

  // ============ PARALLEL TASK HELPERS ============

  /**
   * Wait for DataTables to be ready
   * @returns {Promise<boolean>}
   */
  function waitForDataTables(maxAttempts = 20) {
    return new Promise((resolve) => {
      let attempts = 0;
      const check = () => {
        if (window.jQuery && window.jQuery.fn.dataTable) {
          try {
            const dt = window.jQuery('#article_data').DataTable();
            if (dt) {
              resolve(true);
              return;
            }
          } catch (e) {}
        }
        attempts++;
        if (attempts < maxAttempts) {
          setTimeout(check, 100);
        } else {
          resolve(false);
        }
      };
      check();
    });
  }

  /**
   * Set page length to 500
   * @returns {Promise<boolean>}
   */
  async function setPageLength() {
    // Try DataTables API first
    if (window.jQuery && window.jQuery.fn.dataTable) {
      try {
        const dataTable = window.jQuery('#article_data').DataTable();
        if (dataTable) {
          dataTable.page.len(500).draw();
          return true;
        }
      } catch (e) {}
    }

    // Fallback to DOM manipulation
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
      lengthSelect.dispatchEvent(new Event('change', { bubbles: true }));
      return true;
    }

    return false;
  }

  /**
   * Initialize UI components (filter, copy button)
   */
  function initializeUIComponents() {
    Filter.initializeFilter();
    Copy.initializeCopyButton();
  }

  /**
   * Setup DataTables event listeners
   */
  function setupEventListeners() {
    const table = Utils.getTable();
    if (!table) return;

    // Setup TEX row sorting hooks
    Table.setupDataTablesTexSorting();

    // Handle pagination clicks
    const paginationContainer = document.getElementById('article_data_paginate');
    if (paginationContainer) {
      paginationContainer.addEventListener('click', () => {
        requestAnimationFrame(() => {
          Table.populateDoneByColumn();
          Table.applyTableOrder();
        });
      });
    }

    // Handle page length changes
    const lengthSelect = document.querySelector('select[name="article_data_length"]');
    if (lengthSelect) {
      lengthSelect.addEventListener('change', () => {
        requestAnimationFrame(() => {
          Table.populateDoneByColumn();
          Table.applyTableOrder();
        });
      });
    }
  }

  /**
   * Apply table modifications after API data is ready
   */
  function applyTableModifications() {
    Table.removeLoadingStatus();
    Table.addDoneByColumn();
    Table.replaceTableHeader();
    Table.populateDoneByColumn();
    Table.finalizeInitialLoad();
  }

  // ============ MAIN PARALLEL INITIALIZATION ============

  // Flag to prevent initialize() from running twice
  let initializationStarted = false;

  /**
   * Initialize the extension with PARALLEL execution
   */
  async function initialize() {
    // Prevent duplicate initialization
    if (initializationStarted) return;
    initializationStarted = true;

    try {
      // PHASE 1: Start API fetch IMMEDIATELY (don't wait for anything)
      const apiPromise = API.fetchDoneByData().catch(() => null);

      // PHASE 2: Wait for table element (in parallel with API fetch)
      const tablePromise = Utils.waitForElement('#article_data', 10000);

      // Wait for table to appear
      await tablePromise;

      // PHASE 3: Run these in PARALLEL once table is found
      const [dataTablesReady] = await Promise.all([
        waitForDataTables(),
        // Initialize UI components immediately
        Promise.resolve().then(() => initializeUIComponents()),
        // Show loading status
        Promise.resolve().then(() => Table.showLoadingStatus())
      ]);

      // PHASE 4: Set page length and setup listeners (parallel)
      await Promise.all([
        setPageLength(),
        Promise.resolve().then(() => setupEventListeners())
      ]);

      // PHASE 5: Wait for API data, then apply table modifications
      await apiPromise;

      // Apply all table modifications at once
      applyTableModifications();

      // PHASE 6: Run post-processing in PARALLEL
      await Promise.all([
        Promise.resolve().then(() => PastDue.checkPastDueFiles(Toast.showToast)),
        Promise.resolve().then(() => Stats.displayTodayStats(Toast.showToast))
      ]);

    } catch (error) {
      console.error('[Content] Initialization error:', error);
      Toast.showToast([ERROR_MESSAGE]);
    }
  }

  // ============ FALLBACK INITIALIZATION ============

  /**
   * Fallback for dynamically loaded tables
   */
  function fallbackInit() {
    if (initializationStarted) return;
    
    const table = Utils.getTable();
    if (table) {
      initialize();
    }
  }

  // Delayed fallback (only runs if main init hasn't started)
  setTimeout(fallbackInit, 2000);

  // MutationObserver fallback
  const observer = new MutationObserver(() => {
    if (initializationStarted) {
      observer.disconnect();
      return;
    }
    
    const table = Utils.getTable();
    if (table) {
      const headerRow = Utils.getHeaderRow(table);
      if (headerRow) {
        const hasExtension = Array.from(headerRow.querySelectorAll('th')).some(
          th => th.textContent.trim().includes('DONE BY')
        );
        if (!hasExtension) {
          observer.disconnect();
          initialize();
        }
      }
    }
  });

  observer.observe(document.body, { childList: true, subtree: true });

  // ============ MESSAGE HANDLING ============

  /**
   * Check unuploaded files for a profile
   */
  async function checkUnuploadedFilesForProfile(profile) {
    // Ensure API data is ready
    if (!API.hasDataFetched() && !API.isCurrentlyFetching()) {
      await API.fetchDoneByData();
    }

    const apiData = API.getApiResponseData();
    if (!apiData || !Array.isArray(apiData) || apiData.length === 0) {
      await Notification.sendNotification('No Data', {
        body: 'API data not available',
        tag: 'debug-no-api'
      });
      return;
    }

    const table = Utils.getTable();
    if (!table) {
      await Notification.sendNotification('No Table', {
        body: 'Table not found',
        tag: 'debug-no-table'
      });
      return;
    }

    const articleIdIndex = Utils.findColumnIndex(table, 'Article ID');
    const actionIndex = Utils.findColumnIndex(table, 'Action');

    if (articleIdIndex === -1) {
      await Notification.sendNotification('Error', {
        body: 'Article ID column not found',
        tag: 'debug-no-column'
      });
      return;
    }

    // Collect data in parallel-friendly way
    const portalArticleIds = new Set();
    const pendingQAArticleIds = new Set();
    const rows = Utils.getTableRows(table);

    rows.forEach(row => {
      const articleId = Utils.getCellValue(row, articleIdIndex).trim();
      if (articleId) {
        portalArticleIds.add(articleId);
        if (actionIndex !== -1) {
          const actionText = Utils.getCellValue(row, actionIndex);
          if (actionText.toLowerCase().includes('pending qa validation')) {
            pendingQAArticleIds.add(articleId);
          }
        }
      }
    });

    // Find unuploaded files
    const profileArticleIds = [];
    let profileItemsCount = 0;

    apiData.forEach(item => {
      const doneBy = item['Done by'] || '-';
      const articleNumber = item['Article number'] || '';

      if (doneBy === profile) {
        profileItemsCount++;
        if (articleNumber) {
          const isInPortal = portalArticleIds.has(articleNumber);
          const hasPendingQA = pendingQAArticleIds.has(articleNumber);
          if (isInPortal && !hasPendingQA) {
            profileArticleIds.push(articleNumber);
          }
        }
      }
    });

    // Send notification
    if (profileArticleIds.length > 0) {
      const articleList = profileArticleIds.slice(0, 10).join(', ');
      const moreText = profileArticleIds.length > 10 
        ? ` and ${profileArticleIds.length - 10} more` 
        : '';
      await Notification.sendNotification('Unuploaded Files', {
        body: `${profileArticleIds.length} file(s): ${articleList}${moreText}`,
        tag: `unuploaded-${profile}`,
        requireInteraction: true
      });
    } else {
      await Notification.sendNotification('Check Complete', {
        body: `No unuploaded files for ${profile} (${profileItemsCount} items checked)`,
        tag: `check-${profile}`
      });
    }
  }

  // Message listener
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.type === 'CHECK_UNUPLOADED_FILES' && message.profile) {
      checkUnuploadedFilesForProfile(message.profile)
        .then(() => sendResponse({ success: true }))
        .catch((err) => sendResponse({ success: false, error: err.message }));
      return true;
    }
    if (message.type === 'PROFILE_CHANGED') {
      sendResponse({ success: true });
    }
    return true;
  });

  // ============ START ============

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initialize);
  } else {
    initialize();
  }
})();
