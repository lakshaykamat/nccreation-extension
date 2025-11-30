// Stats Manager - Handles today's stats display - Global namespace

window.TableExtensionStats = (function() {
  'use strict';

  const Utils = window.TableExtensionUtils;
  const API = window.TableExtensionAPI;

  /**
   * Get portal article IDs and pending QA article IDs
   * @returns {{portalArticleIds: Set, pendingQAArticleIds: Set}}
   */
  function getPortalArticleData() {
    const table = Utils.getTable();
    const portalArticleIds = new Set();
    const pendingQAArticleIds = new Set();

    if (!table) {
      return { portalArticleIds, pendingQAArticleIds };
    }

    const articleIdIndex = Utils.findColumnIndex(table, 'Article ID');
    const actionIndex = Utils.findColumnIndex(table, 'Action');

    if (articleIdIndex === -1) {
      return { portalArticleIds, pendingQAArticleIds };
    }

    const rows = Utils.getTableRows(table);
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

    return { portalArticleIds, pendingQAArticleIds };
  }

  /**
   * Get today's person data from API
   * @param {string} todayStr - Today's date string
   * @returns {Object} - Person data with article IDs and counts
   */
  function getTodayPersonData(todayStr) {
    const apiData = API.getApiResponseData();
    if (!apiData || !Array.isArray(apiData)) {
      return {};
    }

    const personData = {};

    apiData.forEach(item => {
      const itemDate = Utils.parseDateString(item.Date);
      if (!itemDate) return;

      const itemDateStr = Utils.formatDate(itemDate);
      const doneBy = item['Done by'] || '-';
      const articleNumber = item['Article number'] || '';

      if (itemDateStr === todayStr && articleNumber) {
        if (!personData[doneBy]) {
          personData[doneBy] = {
            articleIds: new Set(),
            total: 0
          };
        }
        personData[doneBy].articleIds.add(articleNumber);
        personData[doneBy].total++;
      }
    });

    return personData;
  }

  /**
   * Get article ID breakdown for tooltip
   * @param {string} name - Person name
   * @param {Object} personData - Person data object
   * @param {Set} portalArticleIds - Portal article IDs
   * @param {Set} pendingQAArticleIds - Pending QA article IDs
   * @returns {string}
   */
  function getArticleIdBreakdown(name, personData, portalArticleIds, pendingQAArticleIds) {
    const data = personData[name];
    if (!data) return '';

    const uploaded = [];
    const notUploaded = [];

    data.articleIds.forEach(articleId => {
      const isUploaded = !portalArticleIds.has(articleId) || pendingQAArticleIds.has(articleId);
      if (isUploaded) {
        uploaded.push(articleId);
      } else {
        notUploaded.push(articleId);
      }
    });

    uploaded.sort();
    notUploaded.sort();

    const parts = [];
    uploaded.forEach(id => {
      parts.push(`${id}: UPLOADED`);
    });
    notUploaded.forEach(id => {
      parts.push(`${id}: NOT UPLOADED`);
    });

    return parts.join('\n');
  }

  /**
   * Calculate uploaded count for a person
   * @param {Object} data - Person data
   * @param {Set} portalArticleIds - Portal article IDs
   * @param {Set} pendingQAArticleIds - Pending QA article IDs
   * @returns {number}
   */
  function calculateUploadedCount(data, portalArticleIds, pendingQAArticleIds) {
    let uploadedCount = 0;
    data.articleIds.forEach(articleId => {
      if (!portalArticleIds.has(articleId)) {
        uploadedCount++;
      } else if (pendingQAArticleIds.has(articleId)) {
        uploadedCount++;
      }
    });
    return uploadedCount;
  }

  /**
   * Create person span element with hover and click handlers
   * @param {string} abbrev - Abbreviation
   * @param {number} uploadedCount - Uploaded count
   * @param {number} total - Total count
   * @param {string} tooltipText - Tooltip text
   * @param {Function} onCopy - Copy callback
   * @returns {HTMLElement}
   */
  function createPersonSpan(abbrev, uploadedCount, total, tooltipText, onCopy) {
    const personSpan = document.createElement('span');
    personSpan.textContent = `${abbrev}: ${uploadedCount}/${total}`;
    personSpan.style.cssText = `
      cursor: pointer;
      position: relative;
      padding: 2px 4px;
      border-radius: 3px;
      transition: all 0.2s;
    `;
    personSpan.title = tooltipText;

    personSpan.addEventListener('mouseenter', () => {
      personSpan.style.outline = '2px solid #667eea';
      personSpan.style.outlineOffset = '2px';
    });

    personSpan.addEventListener('mouseleave', () => {
      personSpan.style.outline = '';
      personSpan.style.outlineOffset = '';
    });

    personSpan.addEventListener('click', async () => {
      try {
        await navigator.clipboard.writeText(tooltipText);
        onCopy(`${abbrev} stats`);
      } catch (err) {
        const textarea = document.createElement('textarea');
        textarea.value = tooltipText;
        textarea.style.position = 'fixed';
        textarea.style.opacity = '0';
        document.body.appendChild(textarea);
        textarea.select();
        try {
          document.execCommand('copy');
          onCopy(`${abbrev} stats`);
        } catch (fallbackErr) {
          onCopy(`${abbrev} stats`, true);
        }
        document.body.removeChild(textarea);
      }
    });

    return personSpan;
  }

  /**
   * Display today's stats in the right section
   * @param {Function} showToast - Toast notification function
   */
  function displayTodayStats(showToast) {
    const apiData = API.getApiResponseData();
    if (!apiData || !Array.isArray(apiData)) {
      return;
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayStr = Utils.formatDate(today);

    const { portalArticleIds, pendingQAArticleIds } = getPortalArticleData();
    const personData = getTodayPersonData(todayStr);

    const rightSection = document.querySelector('.RigthSectTp');
    if (!rightSection) {
      return;
    }

    const existingDisplay = document.getElementById('extension-today-stats');
    if (existingDisplay) {
      existingDisplay.remove();
    }

    const namesWithCounts = Object.keys(personData).filter(name => personData[name].total > 0);
    if (namesWithCounts.length === 0) {
      return;
    }

    const sortedNames = namesWithCounts.sort();
    const abbrevMap = Utils.generateUniqueAbbreviations(sortedNames);

    const statsDisplay = document.createElement('span');
    statsDisplay.id = 'extension-today-stats';
    statsDisplay.style.cssText = 'font-weight: 500;';

    const separator = document.createTextNode(' | ');
    statsDisplay.appendChild(separator);

    sortedNames.forEach((name, index) => {
      const abbrev = abbrevMap.get(name) || name.substring(0, 3).toUpperCase();
      const data = personData[name];
      const uploadedCount = calculateUploadedCount(data, portalArticleIds, pendingQAArticleIds);
      const tooltipText = getArticleIdBreakdown(name, personData, portalArticleIds, pendingQAArticleIds);

      const personSpan = createPersonSpan(
        abbrev,
        uploadedCount,
        data.total,
        tooltipText,
        (message, isError) => {
          showToast([isError ? `Failed to copy ${message}` : `Copied ${message} to clipboard`]);
        }
      );

      if (index > 0) {
        statsDisplay.appendChild(document.createTextNode(' '));
      }
      statsDisplay.appendChild(personSpan);
    });

    rightSection.appendChild(statsDisplay);
  }

  return {
    displayTodayStats
  };
})();

