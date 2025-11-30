// Copy Manager - Handles copying table data - Global namespace

window.TableExtensionCopy = (function() {
  'use strict';

  const Utils = window.TableExtensionUtils;
  const API = window.TableExtensionAPI;
  const ARTICLE_ID_COLUMN = 'Article ID';
  const DONE_BY_COLUMN = 'DONE BY';

  /**
   * Get all article data formatted as [ARTICLE ID] [DONE BY]
   * @returns {Array<{articleId: string, doneBy: string}>}
   */
  function getFormattedData() {
    const table = Utils.getTable();
    if (!table) return [];

    const articleIdIndex = Utils.findColumnIndex(table, ARTICLE_ID_COLUMN);
    const doneByIndex = Utils.findColumnIndex(table, DONE_BY_COLUMN);

    if (articleIdIndex === -1 || doneByIndex === -1) {
      return [];
    }

    const rows = Utils.getTableRows(table);
    const data = [];

    rows.forEach((row) => {
      // Only include visible rows (not filtered out)
      if (row.style.display !== 'none') {
        const articleId = Utils.getCellValue(row, articleIdIndex);
        const doneBy = Utils.getCellValue(row, doneByIndex);
        
        if (articleId) {
          data.push({
            articleId: articleId.trim(),
            doneBy: doneBy.trim() || '-'
          });
        }
      }
    });

    // Sort by doneBy, then by articleId
    data.sort((a, b) => {
      const doneByCompare = a.doneBy.localeCompare(b.doneBy);
      if (doneByCompare !== 0) return doneByCompare;
      return a.articleId.localeCompare(b.articleId);
    });

    return data;
  }

  /**
   * Format data as ARTICLE ID DONE BY
   * @param {Array<{articleId: string, doneBy: string}>} data
   * @returns {string}
   */
  function formatDataForCopy(data) {
    return data.map(item => `${item.articleId} ${item.doneBy}`).join('\n');
  }

  /**
   * Copy formatted data to clipboard
   */
  async function copyToClipboard() {
    try {
      const data = getFormattedData();
      if (data.length === 0) {
        alert('No data to copy');
        return;
      }

      const formattedText = formatDataForCopy(data);
      
      // Use modern Clipboard API
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(formattedText);
        showCopyFeedback(true);
      } else {
        // Fallback for older browsers
        const textArea = document.createElement('textarea');
        textArea.value = formattedText;
        textArea.style.position = 'fixed';
        textArea.style.left = '-999999px';
        document.body.appendChild(textArea);
        textArea.select();
        document.execCommand('copy');
        document.body.removeChild(textArea);
        showCopyFeedback(true);
      }
    } catch (error) {
      showCopyFeedback(false);
    }
  }

  /**
   * Show feedback when copy is successful/failed
   * @param {boolean} success
   */
  function showCopyFeedback(success) {
    const button = document.getElementById('copy-data-btn');
    if (!button) return;

    const originalText = button.textContent;
    const originalBackground = button.style.background || '#27ae60';
    
    if (success) {
      // Show "Copied" with gray background
      button.textContent = 'Copied';
      button.style.background = '#95a5a6';
      
      // After 1 second, reset to original
      setTimeout(() => {
        button.textContent = originalText;
        button.style.background = originalBackground;
      }, 1000);
    } else {
      button.textContent = '✗ Failed';
      button.style.background = '#e74c3c';
      setTimeout(() => {
        button.textContent = originalText;
        button.style.background = originalBackground;
      }, 2000);
    }
  }

  /**
   * Create copy button
   * @returns {HTMLElement}
   */
  function createCopyButton() {
    const button = document.createElement('button');
    button.id = 'copy-data-btn';
    button.className = 'copy-data-button';
    button.textContent = 'Copy Data';
    button.style.cssText = `
      padding: 4px 12px;
      margin: 0;
      margin-left: 10px;
      background: #27ae60;
      color: white;
      border: none;
      border-radius: 4px;
      cursor: pointer;
      font-size: 13px;
      font-weight: 600;
      transition: background 0.2s;
      display: inline-block;
      vertical-align: middle;
      height: 28px;
      line-height: 20px;
    `;

    button.addEventListener('click', () => {
      copyToClipboard();
    });

    button.addEventListener('mouseenter', () => {
      if (button.textContent === 'Copy Data') {
        button.style.opacity = '0.9';
      }
    });

    button.addEventListener('mouseleave', () => {
      if (button.textContent === 'Copy Data') {
        button.style.opacity = '1';
      }
    });

    return button;
  }

  /**
   * Initialize copy button
   */
  function initializeCopyButton() {
    // Find the filter div to add button next to search bar
    const filterDiv = document.querySelector('#article_data_wrapper .dataTables_filter');
    if (!filterDiv) {
      setTimeout(initializeCopyButton, 1000);
      return;
    }

    // Check if button already exists
    if (document.getElementById('copy-data-btn')) {
      return;
    }

    // Create and add button
    const button = createCopyButton();
    
    // Add button to the filter div
    const label = filterDiv.querySelector('label');
    if (label) {
      const input = label.querySelector('input');
      if (input && input.parentNode) {
        // Insert button after the input element (or after filter button if it exists)
        const filterButton = document.getElementById('tex-filter-btn');
        if (filterButton && filterButton.parentNode === label) {
          filterButton.parentNode.insertBefore(button, filterButton.nextSibling);
        } else {
          input.parentNode.insertBefore(button, input.nextSibling);
        }
      } else {
        label.appendChild(button);
      }
    } else {
      filterDiv.appendChild(button);
    }
  }

  // Public API
  return {
    copyToClipboard,
    getFormattedData,
    createCopyButton,
    initializeCopyButton
  };
})();

