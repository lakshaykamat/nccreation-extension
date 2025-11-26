// Main content script - orchestrates all modules

(function() {
  'use strict';

  const Utils = window.TableExtensionUtils;
  const API = window.TableExtensionAPI;
  const Table = window.TableExtensionTable;
  const Filter = window.TableExtensionFilter;
  const Copy = window.TableExtensionCopy;

  /**
   * Create and show toast notification with multiple messages
   */
  function showToast(messages) {
    // Remove existing toast if any
    const existingToast = document.getElementById('extension-toast');
    if (existingToast) {
      existingToast.remove();
    }

    if (!messages || messages.length === 0) return;

    // Add animation style if not exists
    if (!document.getElementById('toast-animation-style')) {
      const style = document.createElement('style');
      style.id = 'toast-animation-style';
      style.textContent = `
        @keyframes slideIn {
          from {
            transform: translateX(-100%);
            opacity: 0;
          }
          to {
            transform: translateX(0);
            opacity: 1;
          }
        }
      `;
      document.head.appendChild(style);
    }

    // Create toast container
    const toast = document.createElement('div');
    toast.id = 'extension-toast';
    toast.style.cssText = `
      position: fixed;
      top: 20px;
      left: 20px;
      background-color: #ff4444;
      color: white;
      padding: 16px 20px;
      border-radius: 8px;
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
      z-index: 10000;
      font-family: Arial, sans-serif;
      font-size: 14px;
      max-width: 500px;
      max-height: 400px;
      overflow-y: auto;
      animation: slideIn 0.3s ease-out;
    `;

    // Create header with close button
    const header = document.createElement('div');
    header.style.cssText = `
      display: flex;
      justify-content: flex-end;
      align-items: center;
      margin-bottom: 8px;
    `;

    const closeBtn = document.createElement('button');
    closeBtn.innerHTML = '&times;';
    closeBtn.style.cssText = `
      background: none;
      border: none;
      color: white;
      font-size: 24px;
      cursor: pointer;
      padding: 0;
      width: 24px;
      height: 24px;
      line-height: 24px;
      display: flex;
      align-items: center;
      justify-content: center;
      opacity: 0.8;
      transition: opacity 0.2s;
    `;
    closeBtn.onmouseover = () => closeBtn.style.opacity = '1';
    closeBtn.onmouseout = () => closeBtn.style.opacity = '0.8';
    closeBtn.onclick = () => {
      toast.style.animation = 'slideIn 0.3s ease-out reverse';
      setTimeout(() => {
        if (toast.parentNode) {
          toast.remove();
        }
      }, 300);
    };

    header.appendChild(closeBtn);
    toast.appendChild(header);

    // Create messages container
    const messagesContainer = document.createElement('div');
    messages.forEach((msgObj, index) => {
      const messageDiv = document.createElement('div');
      messageDiv.textContent = typeof msgObj === 'string' ? msgObj : msgObj.text;
      messageDiv.style.cssText = `
        margin-bottom: ${index < messages.length - 1 ? '8px' : '0'};
        line-height: 1.5;
      `;
      messagesContainer.appendChild(messageDiv);
    });

    toast.appendChild(messagesContainer);
    document.body.appendChild(toast);

    // Auto remove after 30 seconds
    const autoRemoveTimeout = setTimeout(() => {
      if (toast.parentNode) {
        toast.style.animation = 'slideIn 0.3s ease-out reverse';
        setTimeout(() => {
          if (toast.parentNode) {
            toast.remove();
          }
        }, 300);
      }
    }, 30000);

    // Clear timeout if manually closed
    const originalClose = closeBtn.onclick;
    closeBtn.onclick = () => {
      clearTimeout(autoRemoveTimeout);
      originalClose();
    };
  }

  /**
   * Parse date string in format "DD/MM/YYYY HH:MM AM/PM"
   */
  function parseDate(dateString) {
    if (!dateString || dateString.trim() === '') return null;
    
    // Format: "26/11/2025 06:26 PM"
    const parts = dateString.trim().split(' ');
    if (parts.length < 2) return null;
    
    const datePart = parts[0]; // "26/11/2025"
    const timePart = parts.slice(1).join(' '); // "06:26 PM"
    
    const [day, month, year] = datePart.split('/').map(Number);
    if (!day || !month || !year) return null;
    
    // Create date object (month is 0-indexed in JS)
    const date = new Date(year, month - 1, day);
    
    // Parse time if available
    if (timePart) {
      const timeMatch = timePart.match(/(\d+):(\d+)\s*(AM|PM)/i);
      if (timeMatch) {
        let hours = parseInt(timeMatch[1]);
        const minutes = parseInt(timeMatch[2]);
        const ampm = timeMatch[3].toUpperCase();
        
        if (ampm === 'PM' && hours !== 12) hours += 12;
        if (ampm === 'AM' && hours === 12) hours = 0;
        
        date.setHours(hours, minutes, 0, 0);
      }
    }
    
    return date;
  }

  /**
   * Check if date is in the past (before today)
   */
  function isPastDate(date) {
    if (!date) return false;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const compareDate = new Date(date);
    compareDate.setHours(0, 0, 0, 0);
    return compareDate < today;
  }

  /**
   * Calculate hours delayed (difference between now and assign date)
   */
  function calculateDelayedHours(assignDate) {
    if (!assignDate) return 0;
    const now = new Date();
    const diffMs = now - assignDate;
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    return diffHours;
  }

  /**
   * Check for past due files and show toast
   */
  function checkPastDueFiles() {
    const table = Utils.getTable();
    if (!table) return;

    const assignDateIndex = Utils.findColumnIndex(table, 'Assign Date');
    const doneByIndex = Utils.findColumnIndex(table, 'DONE BY');
    const articleIdIndex = Utils.findColumnIndex(table, 'Article ID');

    if (assignDateIndex === -1 || doneByIndex === -1) {
      console.log('Required columns not found for past due check');
      return;
    }

    const rows = Utils.getTableRows(table);
    const pastDueFiles = [];

    rows.forEach((row) => {
      // Skip hidden rows
      if (row.style.display === 'none') return;

      const cells = Array.from(row.querySelectorAll('td'));
      if (cells.length <= Math.max(assignDateIndex, doneByIndex)) return;

      const assignDateText = cells[assignDateIndex]?.textContent.trim() || '';
      const doneBy = cells[doneByIndex]?.textContent.trim() || '-';
      const articleId = articleIdIndex !== -1 ? (cells[articleIdIndex]?.textContent.trim() || '') : '';

      if (!assignDateText) return;

      const assignDate = parseDate(assignDateText);
      if (assignDate && isPastDate(assignDate)) {
        const delayedHours = calculateDelayedHours(assignDate);
        pastDueFiles.push({
          name: doneBy,
          articleId: articleId,
          delayedHours: delayedHours
        });
      }
    });

    if (pastDueFiles.length === 0) return;

    // Group by name and calculate max delayed hours per person
    const groupedByName = {};
    pastDueFiles.forEach(file => {
      if (!groupedByName[file.name]) {
        groupedByName[file.name] = {
          articleIds: [],
          maxDelayedHours: 0
        };
      }
      if (file.articleId) {
        groupedByName[file.name].articleIds.push(file.articleId);
      }
      // Track the maximum delayed hours for this person
      if (file.delayedHours > groupedByName[file.name].maxDelayedHours) {
        groupedByName[file.name].maxDelayedHours = file.delayedHours;
      }
    });

    // Create messages with delayed hours
    const messages = [];
    Object.keys(groupedByName).forEach(name => {
      const group = groupedByName[name];
      const displayName = name === '-' ? 'Someone' : name;
      const count = group.articleIds.length;
      const articleList = group.articleIds.length > 0 ? group.articleIds.join(', ') : 'N/A';
      const hours = group.maxDelayedHours;
      const hoursText = hours >= 24 ? `${Math.floor(hours / 24)} days` : `${hours} hours`;
      const message = {
        text: `${displayName} didn't uploaded ${count} ${count === 1 ? 'yesterday file' : 'yesterday files'} (${articleList}) [${hoursText}]`,
        hours: group.maxDelayedHours
      };
      messages.push(message);
    });

    // Sort by delayed hours (highest first)
    messages.sort((a, b) => b.hours - a.hours);

    // Extract text from message objects for display
    const messageTexts = messages.map(msg => typeof msg === 'string' ? msg : msg.text);
    
    // Show all messages in one toast
    showToast(messageTexts);
  }



  /**
   * Set default page length to 500
   * Returns true if successful, false otherwise
   */
  function setDefaultPageLength() {
    let success = false;
    
    // Wait for DataTables to be initialized
    if (window.jQuery && window.jQuery.fn.dataTable) {
      try {
        const dataTable = window.jQuery('#article_data').DataTable();
        if (dataTable) {
          // Set page length to 500 using DataTables API
          dataTable.page.len(500).draw();
          console.log('Set page length to 500 via API');
          success = true;
        }
      } catch (e) {
        console.log('Could not set page length via API:', e);
      }
    }
    
    // Also update the select element directly
    const lengthSelect = document.querySelector('select[name="article_data_length"]');
    if (lengthSelect) {
      // Check if 500 option exists, if not add it
      let option500 = lengthSelect.querySelector('option[value="500"]');
      if (!option500) {
        option500 = document.createElement('option');
        option500.value = '500';
        option500.textContent = '500';
        lengthSelect.appendChild(option500);
      }
      
      // Set 500 as selected
      lengthSelect.value = '500';
      
      // Trigger change event to update DataTables if API method didn't work
      if (!success) {
        const changeEvent = new Event('change', { bubbles: true });
        lengthSelect.dispatchEvent(changeEvent);
      }
      
      console.log('Updated length select to 500');
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
      // Wait for table to be available
      await Utils.waitForElement('#article_data', 10000);
      
      // Wait for DataTables to be initialized
      let dataTableReady = false;
      if (window.jQuery && window.jQuery.fn.dataTable) {
        try {
          const dataTable = window.jQuery('#article_data').DataTable();
          if (dataTable) {
            dataTableReady = true;
          }
        } catch (e) {
          // DataTables not ready yet, wait a bit
        }
      }
      
      // Wait a bit for DataTables to fully initialize if needed
      if (!dataTableReady) {
        await new Promise(resolve => setTimeout(resolve, 500));
      }
      
      // Set page length to 500 IMMEDIATELY before anything else
      let retryCount = 0;
      while (!setDefaultPageLength() && retryCount < 10) {
        await new Promise(resolve => setTimeout(resolve, 200));
        retryCount++;
      }
      
      // Add the column first
      Table.addDoneByColumn();
      
      // Initialize filter
      Filter.initializeFilter();
      
      // Initialize copy button
      Copy.initializeCopyButton();
      
      // NOW fetch data from API after page length is set
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
              // Check for past due files and show toast
              checkPastDueFiles();
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
      const table = Utils.getTable();
      if (table) {
        Table.addDoneByColumn();
        Filter.initializeFilter();
        Copy.initializeCopyButton();
        API.fetchDoneByData()
          .then(() => {
            setTimeout(() => {
              checkPastDueFiles();
            }, 500);
          })
          .catch(err => console.error('Delayed fetch failed:', err));
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
          Table.addDoneByColumn();
          Filter.initializeFilter();
          Copy.initializeCopyButton();
          API.fetchDoneByData()
            .then(() => {
              setTimeout(() => {
                checkPastDueFiles();
              }, 500);
            })
            .catch(err => console.error('Observer fetch failed:', err));
          setTimeout(() => {
            setDefaultPageLength();
          }, 1500);
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
