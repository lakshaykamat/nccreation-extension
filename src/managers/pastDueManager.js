// Past Due Manager - Handles past due file checking - Global namespace

window.TableExtensionPastDue = (function() {
  'use strict';

  const Utils = window.TableExtensionUtils;

  /**
   * Check if date is yesterday or older (not today)
   * @param {Date} date - Date to check
   * @returns {boolean}
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
   * @param {Date} assignDate - Assignment date
   * @returns {number}
   */
  function calculateDelayedHours(assignDate) {
    if (!assignDate) return 0;
    const now = new Date();
    const diffMs = now - assignDate;
    return Math.floor(diffMs / (1000 * 60 * 60));
  }

  /**
   * Format hours as text
   * @param {number} hours - Hours to format
   * @returns {string}
   */
  function formatHours(hours) {
    return hours >= 24 ? `${Math.floor(hours / 24)} days` : `${hours} hours`;
  }

  /**
   * Group past due files by name
   * @param {Array} pastDueFiles - Array of past due file objects
   * @returns {Object}
   */
  function groupPastDueFilesByName(pastDueFiles) {
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
      if (file.delayedHours > groupedByName[file.name].maxDelayedHours) {
        groupedByName[file.name].maxDelayedHours = file.delayedHours;
      }
    });
    return groupedByName;
  }

  /**
   * Create messages from grouped past due files
   * @param {Object} groupedByName - Grouped past due files
   * @returns {Array}
   */
  function createPastDueMessages(groupedByName) {
    const messages = [];
    Object.keys(groupedByName).forEach(name => {
      const group = groupedByName[name];
      const displayName = name === '-' ? 'Someone' : name;
      const count = group.articleIds.length;
      const articleList = group.articleIds.length > 0 ? group.articleIds.join(', ') : 'N/A';
      const hoursText = formatHours(group.maxDelayedHours);
      messages.push({
        text: `${displayName} didn't uploaded ${count} ${count === 1 ? 'yesterday file' : 'yesterday files'} (${articleList}) [${hoursText}]`,
        hours: group.maxDelayedHours
      });
    });
    return messages.sort((a, b) => b.hours - a.hours);
  }

  /**
   * Check for past due files and return messages
   * @param {Function} showToast - Toast notification function
   */
  function checkPastDueFiles(showToast) {
    const table = Utils.getTable();
    if (!table) return;

    const assignDateIndex = Utils.findColumnIndex(table, 'Assign Date');
    const doneByIndex = Utils.findColumnIndex(table, 'DONE BY');
    const articleIdIndex = Utils.findColumnIndex(table, 'Article ID');
    const actionIndex = Utils.findColumnIndex(table, 'Action');

    if (assignDateIndex === -1 || doneByIndex === -1) {
      return;
    }

    const rows = Utils.getTableRows(table);
    const pastDueFiles = [];

    rows.forEach((row) => {
      if (row.style.display === 'none') return;

      const cells = Array.from(row.querySelectorAll('td'));
      if (cells.length <= Math.max(assignDateIndex, doneByIndex)) return;

      if (actionIndex !== -1 && cells.length > actionIndex) {
        const actionText = cells[actionIndex]?.textContent.trim() || '';
        if (actionText.includes('Pending QA Validation') || actionText.includes('QA Validation')) {
          return;
        }
      }

      const assignDateText = cells[assignDateIndex]?.textContent.trim() || '';
      const doneBy = cells[doneByIndex]?.textContent.trim() || '-';
      const articleId = articleIdIndex !== -1 ? (cells[articleIdIndex]?.textContent.trim() || '') : '';

      if (!assignDateText) return;

      const assignDate = Utils.parseDate(assignDateText);
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

    const groupedByName = groupPastDueFilesByName(pastDueFiles);
    const messages = createPastDueMessages(groupedByName);
    const messageTexts = messages.map(msg => typeof msg === 'string' ? msg : msg.text);

    showToast(messageTexts);
  }

  return {
    checkPastDueFiles
  };
})();

