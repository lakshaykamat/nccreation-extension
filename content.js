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
  const Notification = window.TableExtensionNotification;

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

  /**
   * Check unuploaded files for a specific profile
   * @param {string} profile - Profile name to check
   */
  async function checkUnuploadedFilesForProfile(profile) {
    console.log('[Content] checkUnuploadedFilesForProfile called for:', profile);
    
    // Ensure API data is fetched first
    if (!API.hasDataFetched() && !API.isCurrentlyFetching()) {
      console.log('[Content] Fetching API data...');
      await API.fetchDoneByData();
    }

    const apiData = API.getApiResponseData();
    console.log('[Content] API data available:', !!apiData, apiData?.length || 0);
    
    if (!apiData || !Array.isArray(apiData) || apiData.length === 0) {
      console.log('[Content] No API data available');
      // Send test notification to verify system works
      await Notification.sendNotification('Debug: No API Data', {
        body: 'API data not available yet',
        tag: 'debug-no-api'
      });
      return;
    }

    const table = Utils.getTable();
    if (!table) {
      console.log('[Content] Table not found');
      await Notification.sendNotification('Debug: No Table', {
        body: 'Table element not found',
        tag: 'debug-no-table'
      });
      return;
    }

    // Get portal article IDs and pending QA article IDs
    const articleIdIndex = Utils.findColumnIndex(table, 'Article ID');
    const actionIndex = Utils.findColumnIndex(table, 'Action');

    console.log('[Content] Column indices - Article ID:', articleIdIndex, 'Action:', actionIndex);

    if (articleIdIndex === -1) {
      console.log('[Content] Article ID column not found');
      await Notification.sendNotification('Debug: No Article ID Column', {
        body: 'Article ID column not found',
        tag: 'debug-no-column'
      });
      return;
    }

    const portalArticleIds = new Set();
    const pendingQAArticleIds = new Set();
    const rows = Utils.getTableRows(table);
    console.log('[Content] Total rows in table:', rows.length);

    rows.forEach(row => {
      const articleId = Utils.getCellValue(row, articleIdIndex).trim();
      if (articleId) {
        portalArticleIds.add(articleId);

        if (actionIndex !== -1) {
          const cells = Array.from(row.querySelectorAll('td'));
          const actionCell = cells[actionIndex];
          if (actionCell) {
            const actionText = actionCell.textContent.trim();
            if (actionText.toLowerCase().includes('pending qa validation')) {
              pendingQAArticleIds.add(articleId);
            }
          }
        }
      }
    });

    console.log('[Content] Portal article IDs:', portalArticleIds.size);
    console.log('[Content] Pending QA article IDs:', pendingQAArticleIds.size);

    // Get article IDs assigned to this profile from API
    const profileArticleIds = [];
    let profileItemsCount = 0;
    
    apiData.forEach(item => {
      const doneBy = item['Done by'] || '-';
      const articleNumber = item['Article number'] || '';
      
      if (doneBy === profile) {
        profileItemsCount++;
        if (articleNumber) {
          // Unuploaded = in portal table AND NOT pending QA (ignore QA as requested)
          const isInPortal = portalArticleIds.has(articleNumber);
          const hasPendingQA = pendingQAArticleIds.has(articleNumber);
          
          // Not uploaded if: in portal AND not pending QA
          if (isInPortal && !hasPendingQA) {
            profileArticleIds.push(articleNumber);
          }
        }
      }
    });

    console.log('[Content] Profile items in API:', profileItemsCount);
    console.log('[Content] Unuploaded files found:', profileArticleIds.length, profileArticleIds);

    // Send notification if there are unuploaded files
    if (profileArticleIds.length > 0) {
      const articleList = profileArticleIds.slice(0, 10).join(', ');
      const moreText = profileArticleIds.length > 10 ? ` and ${profileArticleIds.length - 10} more` : '';
      const message = `${profileArticleIds.length} file${profileArticleIds.length === 1 ? '' : 's'} not uploaded: ${articleList}${moreText}`;
      
      console.log('[Content] Sending notification for unuploaded files');
      await Notification.sendNotification('Unuploaded Files Reminder', {
        body: message,
        tag: `unuploaded-${profile}`,
        requireInteraction: true
      });
    } else {
      // Send test notification to verify it's working
      console.log('[Content] No unuploaded files, sending test notification');
      await Notification.sendNotification('Check Complete', {
        body: `No unuploaded files found for ${profile} (checked ${profileItemsCount} items)`,
        tag: `check-${profile}`
      });
    }
  }

  /**
   * Send test Chrome system notification
   */
  async function sendTestNotification() {
    await Notification.sendNotification('Extension Loaded', {
      body: 'Table extension has been initialized successfully',
      tag: 'extension-init'
    });
  }

  // Listen for messages from background script
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    console.log('[Content] Message received:', message.type, message);
    
    if (message.type === 'CHECK_UNUPLOADED_FILES' && message.profile) {
      console.log('[Content] Processing check for profile:', message.profile);
      checkUnuploadedFilesForProfile(message.profile).then(() => {
        sendResponse({ success: true });
      }).catch((err) => {
        console.error('[Content] Error checking files:', err);
        sendResponse({ success: false, error: err.message });
      });
      return true; // Keep message channel open for async response
    } else if (message.type === 'PROFILE_CHANGED') {
      // Profile changed, can update UI if needed
      sendResponse({ success: true });
    }
    return true; // Keep message channel open for async response
  });

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      initialize();
      sendTestNotification();
    });
  } else {
    initialize();
    sendTestNotification();
  }
})();
