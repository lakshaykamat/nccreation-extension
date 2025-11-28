// Background service worker for hourly checks

const DEFAULT_CHECK_INTERVAL_HOURS = 3;
const MIN_CHECK_INTERVAL_HOURS = 1;
const MAX_CHECK_INTERVAL_HOURS = 10;
const PROFILE_STORAGE_KEY = 'selectedProfile';
const PROFILES_STORAGE_KEY = 'profilesList';
const NOTIFICATIONS_ENABLED_KEY = 'notificationsEnabled';
const CHECK_INTERVAL_KEY = 'checkIntervalHours';
const PORTAL_URL = 'https://powertrack3.aptaracorp.com/AptaraVendorAPI/vendorWorkflow.html';
const API_URL = 'https://n8n-ex6e.onrender.com/webhook/last-five-days-files';

// Fallback profiles (will be overridden by storage if available)
const DEFAULT_PROFILES = ['Anuradha', 'Ankur', 'Ruchi', 'DDN', 'Karishma', 'Divyasnh', 'Amiti', 'Ncxmlr'];

let checkInterval = null;

/**
 * Get profiles list from storage or use default
 */
async function getProfilesList() {
  try {
    const result = await chrome.storage.sync.get([PROFILES_STORAGE_KEY]);
    return result[PROFILES_STORAGE_KEY] || DEFAULT_PROFILES;
  } catch (error) {
    console.error('[Background] Error getting profiles list:', error);
    return DEFAULT_PROFILES;
  }
}

/**
 * Format notification message for unuploaded files
 * @param {string} profile - Profile name
 * @param {number} count - Number of unuploaded files
 * @param {Array<string>} articleIds - Array of article IDs
 * @param {number} maxDisplay - Maximum number of article IDs to display (default: 10)
 * @returns {string} Formatted message
 */
function formatUnuploadedFilesMessage(profile, count, articleIds, maxDisplay = 10) {
  const articleList = articleIds.slice(0, maxDisplay).join(', ');
  const moreText = articleIds.length > maxDisplay ? ` and ${articleIds.length - maxDisplay} more` : '';
  const fileText = count === 1 ? 'file' : 'files';
  return `${profile}: ${count} ${fileText} not uploaded: ${articleList}${moreText}`;
}

/**
 * Format notification message for check complete (no unuploaded files)
 * @param {string} profile - Profile name
 * @param {number} itemsChecked - Number of items checked
 * @returns {string} Formatted message
 */
function formatCheckCompleteMessage(profile, itemsChecked) {
  return `No unuploaded files found for ${profile} (checked ${itemsChecked} items)`;
}

/**
 * Format notification message for all profiles check complete
 * @param {boolean} hasUnuploaded - Whether any profile has unuploaded files
 * @returns {string} Formatted message
 */
function formatAllProfilesCheckMessage(hasUnuploaded) {
  return hasUnuploaded 
    ? 'All profiles checked - notifications sent for profiles with unuploaded files'
    : 'All profiles checked - no unuploaded files found';
}

/**
 * Send Chrome notification from background script
 */
async function sendBackgroundNotification(title, message, tag = null) {
  try {
    const notificationId = tag || `notification-${Date.now()}-${Math.random()}`;
    await chrome.notifications.create(notificationId, {
      type: 'basic',
      iconUrl: chrome.runtime.getURL('icons/logo-32.png'),
      title: title,
      message: message
    });
    console.log('[Background] Notification sent:', title, 'ID:', notificationId);
  } catch (error) {
    console.error('[Background] Error sending notification:', error);
  }
}

/**
 * Extract text content from HTML cell
 */
function extractCellText(html) {
  // Remove HTML tags and decode entities
  return html
    .replace(/<[^>]*>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .trim();
}

/**
 * Fetch and parse portal page HTML
 */
async function fetchPortalData() {
  try {
    console.log('[Background] Fetching portal page...');
    const response = await fetch(PORTAL_URL, {
      credentials: 'include'
    });
    
    if (!response.ok) {
      throw new Error(`Failed to fetch portal: ${response.status}`);
    }
    
    const html = await response.text();
    console.log('[Background] Portal page fetched, length:', html.length);
    
    // Find table with id="article_data"
    const tableMatch = html.match(/<table[^>]*id=["']article_data["'][^>]*>([\s\S]*?)<\/table>/i);
    if (!tableMatch) {
      console.log('[Background] Table not found in portal page');
      return { portalArticleIds: new Set(), pendingQAArticleIds: new Set() };
    }
    
    const tableHtml = tableMatch[1];
    
    // Find header row to determine column indices
    const headerMatch = tableHtml.match(/<thead[^>]*>([\s\S]*?)<\/thead>/i);
    if (!headerMatch) {
      console.log('[Background] Header not found');
      return { portalArticleIds: new Set(), pendingQAArticleIds: new Set() };
    }
    
    const headerHtml = headerMatch[1];
    const headerCells = headerHtml.match(/<th[^>]*>([\s\S]*?)<\/th>/gi) || [];
    
    let articleIdIndex = -1;
    let actionIndex = -1;
    
    headerCells.forEach((cell, index) => {
      const text = extractCellText(cell).toLowerCase();
      if (text.includes('article id')) {
        articleIdIndex = index;
      }
      if (text.includes('action')) {
        actionIndex = index;
      }
    });
    
    console.log('[Background] Column indices - Article ID:', articleIdIndex, 'Action:', actionIndex);
    
    if (articleIdIndex === -1) {
      console.log('[Background] Article ID column not found');
      return { portalArticleIds: new Set(), pendingQAArticleIds: new Set() };
    }
    
    // Extract article IDs and pending QA status from tbody rows
    const portalArticleIds = new Set();
    const pendingQAArticleIds = new Set();
    
    // Match all table rows in tbody
    const tbodyMatch = tableHtml.match(/<tbody[^>]*>([\s\S]*?)<\/tbody>/i);
    if (tbodyMatch) {
      const tbodyHtml = tbodyMatch[1];
      const rowMatches = tbodyHtml.match(/<tr[^>]*>([\s\S]*?)<\/tr>/gi) || [];
      
      rowMatches.forEach(rowHtml => {
        // Extract all td cells from this row
        const cellMatches = rowHtml.match(/<td[^>]*>([\s\S]*?)<\/td>/gi) || [];
        
        if (cellMatches.length > articleIdIndex) {
          const articleIdCell = cellMatches[articleIdIndex];
          const articleId = extractCellText(articleIdCell);
          
          if (articleId) {
            portalArticleIds.add(articleId);
            
            // Check for pending QA validation
            if (actionIndex !== -1 && cellMatches.length > actionIndex) {
              const actionCell = cellMatches[actionIndex];
              const actionText = extractCellText(actionCell).toLowerCase();
              if (actionText.includes('pending qa validation')) {
                pendingQAArticleIds.add(articleId);
              }
            }
          }
        }
      });
    }
    
    console.log('[Background] Portal article IDs:', portalArticleIds.size);
    console.log('[Background] Pending QA article IDs:', pendingQAArticleIds.size);
    
    return { portalArticleIds, pendingQAArticleIds };
  } catch (error) {
    console.error('[Background] Error fetching portal data:', error);
    return { portalArticleIds: new Set(), pendingQAArticleIds: new Set() };
  }
}

/**
 * Fetch API data
 */
async function fetchApiData() {
  try {
    console.log('[Background] Fetching API data...');
    const response = await fetch(API_URL, {
      method: 'GET',
      headers: { 'Accept': 'application/json' }
    });
    
    if (!response.ok || response.status >= 400) {
      throw new Error(`API error! status: ${response.status}`);
    }
    
    const data = await response.json();
    console.log('[Background] API data fetched, items:', data?.length || 0);
    return Array.isArray(data) ? data : [];
  } catch (error) {
    console.error('[Background] Error fetching API data:', error);
    return [];
  }
}

/**
 * Check unuploaded files for a specific profile
 */
async function checkProfileUnuploadedFiles(profile, portalData, apiData) {
  const { portalArticleIds, pendingQAArticleIds } = portalData;
  
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

  console.log(`[Background] ${profile} - Items in API: ${profileItemsCount}, Unuploaded: ${profileArticleIds.length}`);

  // Send notification if there are unuploaded files
  if (profileArticleIds.length > 0) {
    const message = formatUnuploadedFilesMessage(profile, profileArticleIds.length, profileArticleIds);
    
    // Use unique tag for each profile to ensure separate notifications
    await sendBackgroundNotification('Unuploaded Files Reminder', message, `unuploaded-${profile}-${Date.now()}`);
    return true; // Has unuploaded files
  }
  
  return false; // No unuploaded files
}

/**
 * Check for unuploaded files for selected profile
 */
async function checkUnuploadedFiles() {
  try {
    console.log('[Background] Checking unuploaded files...');
    const result = await chrome.storage.sync.get([PROFILE_STORAGE_KEY]);
    const selectedProfile = result[PROFILE_STORAGE_KEY];
    console.log('[Background] Selected profile:', selectedProfile);

    if (!selectedProfile) {
      console.log('[Background] No profile selected, skipping');
      return;
    }

    // Get profiles list and determine which profiles to check
    const allProfiles = await getProfilesList();
    const profilesToCheck = selectedProfile === 'ALL' ? allProfiles : [selectedProfile];

    // Fetch portal data and API data in parallel
    const [portalData, apiData] = await Promise.all([
      fetchPortalData(),
      fetchApiData()
    ]);

    if (apiData.length === 0) {
      console.log('[Background] No API data available');
      await sendBackgroundNotification('Check Complete', 'No API data available');
      return;
    }

    // Check each profile with delay between notifications
    let hasAnyUnuploaded = false;
    for (let i = 0; i < profilesToCheck.length; i++) {
      const profile = profilesToCheck[i];
      const hasUnuploaded = await checkProfileUnuploadedFiles(profile, portalData, apiData);
      if (hasUnuploaded) {
        hasAnyUnuploaded = true;
      }
      
      // Add delay between notifications (except for the last one)
      // This ensures each notification is sent separately
      if (i < profilesToCheck.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 1000)); // 1 second delay
      }
    }

    // If checking all profiles, send summary
    if (selectedProfile === 'ALL') {
      const summaryMessage = formatAllProfilesCheckMessage(hasAnyUnuploaded);
      await sendBackgroundNotification('Check Complete', summaryMessage);
    }

  } catch (error) {
    console.error('[Background] Error checking files:', error);
    await sendBackgroundNotification('Error', `Failed to check files: ${error.message}`);
  }
}

/**
 * Check if notifications are enabled
 * @returns {Promise<boolean>}
 */
async function areNotificationsEnabled() {
  try {
    const result = await chrome.storage.sync.get([NOTIFICATIONS_ENABLED_KEY]);
    return result[NOTIFICATIONS_ENABLED_KEY] === true;
  } catch (error) {
    console.error('[Background] Error checking notification status:', error);
    return false; // Default to disabled if error
  }
}

/**
 * Get check interval in milliseconds from storage
 * @returns {Promise<number>} Interval in milliseconds
 */
async function getCheckIntervalMs() {
  try {
    const result = await chrome.storage.sync.get([CHECK_INTERVAL_KEY]);
    let intervalHours = result[CHECK_INTERVAL_KEY] || DEFAULT_CHECK_INTERVAL_HOURS;
    
    // Validate and clamp to min/max
    intervalHours = Math.max(MIN_CHECK_INTERVAL_HOURS, Math.min(MAX_CHECK_INTERVAL_HOURS, intervalHours));
    
    // Convert hours to milliseconds
    return intervalHours * 60 * 60 * 1000;
  } catch (error) {
    console.error('[Background] Error getting check interval:', error);
    return DEFAULT_CHECK_INTERVAL_HOURS * 60 * 60 * 1000; // Default to 3 hours
  }
}

/**
 * Start hourly check interval
 */
async function startHourlyCheck() {
  const enabled = await areNotificationsEnabled();
  if (!enabled) {
    console.log('[Background] Notifications are disabled, not starting check');
    stopHourlyCheck();
    return;
  }

  if (checkInterval) {
    clearInterval(checkInterval);
  }

  // Get the configured interval
  const intervalMs = await getCheckIntervalMs();
  const intervalHours = intervalMs / (60 * 60 * 1000);

  // Check immediately
  checkUnuploadedFiles();
  
  // Then check every interval
  checkInterval = setInterval(() => {
    checkUnuploadedFiles();
  }, intervalMs);
  
  console.log('[Background] Check started with interval:', intervalHours, 'hours');
}

/**
 * Stop hourly check interval
 */
function stopHourlyCheck() {
  if (checkInterval) {
    clearInterval(checkInterval);
    checkInterval = null;
  }
}

// Listen for profile, notification setting, and interval changes
chrome.storage.onChanged.addListener((changes, areaName) => {
  if (areaName === 'sync') {
    if (changes[PROFILE_STORAGE_KEY]) {
      const newProfile = changes[PROFILE_STORAGE_KEY].newValue;
      if (newProfile) {
        startHourlyCheck();
      } else {
        stopHourlyCheck();
      }
    }
    
    if (changes[NOTIFICATIONS_ENABLED_KEY]) {
      const isEnabled = changes[NOTIFICATIONS_ENABLED_KEY].newValue === true;
      console.log('[Background] Notification setting changed:', isEnabled);
      if (isEnabled) {
        startHourlyCheck();
      } else {
        stopHourlyCheck();
      }
    }
    
    if (changes[CHECK_INTERVAL_KEY]) {
      const newIntervalHours = changes[CHECK_INTERVAL_KEY].newValue;
      console.log('[Background] Check interval changed to:', newIntervalHours, 'hours');
      // Restart the check with new interval if notifications are enabled
      areNotificationsEnabled().then(enabled => {
        if (enabled && checkInterval) {
          startHourlyCheck();
        }
      });
    }
  }
});

// Start check on service worker startup
chrome.runtime.onStartup.addListener(() => {
  chrome.storage.sync.get([PROFILE_STORAGE_KEY, NOTIFICATIONS_ENABLED_KEY]).then((result) => {
    if (result[PROFILE_STORAGE_KEY] && result[NOTIFICATIONS_ENABLED_KEY] === true) {
      startHourlyCheck();
    }
  });
});

// Start check when extension is installed/updated
chrome.runtime.onInstalled.addListener(() => {
  chrome.storage.sync.get([PROFILE_STORAGE_KEY, NOTIFICATIONS_ENABLED_KEY]).then((result) => {
    if (result[PROFILE_STORAGE_KEY] && result[NOTIFICATIONS_ENABLED_KEY] === true) {
      startHourlyCheck();
    }
  });
});

// Also start check immediately when background script loads
chrome.storage.sync.get([PROFILE_STORAGE_KEY, NOTIFICATIONS_ENABLED_KEY]).then((result) => {
  console.log('[Background] Script loaded, checking profile:', result[PROFILE_STORAGE_KEY]);
  console.log('[Background] Notifications enabled:', result[NOTIFICATIONS_ENABLED_KEY]);
  if (result[PROFILE_STORAGE_KEY] && result[NOTIFICATIONS_ENABLED_KEY] === true) {
    console.log('[Background] Starting hourly check');
    startHourlyCheck();
  } else {
    console.log('[Background] Not starting check - profile or notifications not enabled');
  }
});

