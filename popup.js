// Popup script for profile selection

(function() {
  'use strict';

  // ============================================
  // PROFILE CONFIGURATION - Add/Remove profiles here
  // ============================================
  const PROFILES = [
    'Anuradha',
    'Ankur',
    'Ruchi',
    'DDN',
    'Karishma',
    'Divyasnh',
    'Amiti',
    'Ncxmlr'
  ];
  // ============================================

  const PROFILE_STORAGE_KEY = 'selectedProfile';
  const PROFILES_STORAGE_KEY = 'profilesList';
  const NOTIFICATIONS_ENABLED_KEY = 'notificationsEnabled';
  const CHECK_INTERVAL_KEY = 'checkIntervalHours';
  const DEFAULT_INTERVAL_HOURS = 3;
  const MIN_INTERVAL_HOURS = 1;
  const MAX_INTERVAL_HOURS = 10;
  const SELECT_ID = 'profile-select';
  const STATUS_ID = 'status';
  const TOGGLE_ID = 'notification-toggle';
  const INTERVAL_INPUT_ID = 'check-interval';

  const select = document.getElementById(SELECT_ID);
  const status = document.getElementById(STATUS_ID);
  const toggle = document.getElementById(TOGGLE_ID);
  const intervalInput = document.getElementById(INTERVAL_INPUT_ID);

  /**
   * Populate profile select dropdown
   */
  function populateProfiles() {
    // Clear existing options except the first one
    while (select.children.length > 1) {
      select.removeChild(select.lastChild);
    }

    // Add profile options
    PROFILES.forEach(profile => {
      const option = document.createElement('option');
      option.value = profile;
      option.textContent = profile;
      select.appendChild(option);
    });

    // Add ALL option
    const allOption = document.createElement('option');
    allOption.value = 'ALL';
    allOption.textContent = 'ALL';
    select.appendChild(allOption);

    // Store profiles list in storage for background script
    chrome.storage.sync.set({ [PROFILES_STORAGE_KEY]: PROFILES });
  }

  /**
   * Show status message
   * @param {string} message - Status message
   * @param {boolean} isError - Whether it's an error
   */
  function showStatus(message, isError = false) {
    status.textContent = message;
    status.className = `status ${isError ? 'error' : 'success'}`;
    status.style.display = 'block';
    
    setTimeout(() => {
      status.style.display = 'none';
    }, 2000);
  }

  /**
   * Load saved profile
   */
  async function loadProfile() {
    try {
      const result = await chrome.storage.sync.get([PROFILE_STORAGE_KEY]);
      if (result[PROFILE_STORAGE_KEY]) {
        select.value = result[PROFILE_STORAGE_KEY];
      }
    } catch (error) {
      showStatus('Failed to load profile', true);
    }
  }

  /**
   * Save selected profile
   */
  async function saveProfile(profile) {
    try {
      await chrome.storage.sync.set({ [PROFILE_STORAGE_KEY]: profile });
      showStatus('Profile saved successfully');
      
      // Notify content script about profile change
      chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        if (tabs[0]) {
          chrome.tabs.sendMessage(tabs[0].id, {
            type: 'PROFILE_CHANGED',
            profile: profile
          });
        }
      });
    } catch (error) {
      showStatus('Failed to save profile', true);
    }
  }

  /**
   * Load notification toggle state
   */
  async function loadNotificationToggle() {
    try {
      const result = await chrome.storage.sync.get([NOTIFICATIONS_ENABLED_KEY]);
      const isEnabled = result[NOTIFICATIONS_ENABLED_KEY] === true;
      toggle.classList.toggle('active', isEnabled);
    } catch (error) {
      showStatus('Failed to load notification settings', true);
    }
  }

  /**
   * Save notification toggle state
   */
  async function saveNotificationToggle(isEnabled) {
    try {
      await chrome.storage.sync.set({ [NOTIFICATIONS_ENABLED_KEY]: isEnabled });
      showStatus(isEnabled ? 'Notifications enabled' : 'Notifications disabled');
    } catch (error) {
      showStatus('Failed to save notification settings', true);
    }
  }

  /**
   * Load check interval from storage
   */
  async function loadCheckInterval() {
    try {
      const result = await chrome.storage.sync.get([CHECK_INTERVAL_KEY]);
      const intervalHours = result[CHECK_INTERVAL_KEY] || DEFAULT_INTERVAL_HOURS;
      // Validate and clamp to min/max
      const validInterval = Math.max(MIN_INTERVAL_HOURS, Math.min(MAX_INTERVAL_HOURS, intervalHours));
      intervalInput.value = validInterval;
      // Save the validated value back
      if (validInterval !== intervalHours) {
        await chrome.storage.sync.set({ [CHECK_INTERVAL_KEY]: validInterval });
      }
    } catch (error) {
      showStatus('Failed to load check interval', true);
      intervalInput.value = DEFAULT_INTERVAL_HOURS;
    }
  }

  /**
   * Save check interval to storage
   */
  async function saveCheckInterval() {
    try {
      let intervalHours = parseInt(intervalInput.value, 10);
      
      // Validate input
      if (isNaN(intervalHours) || intervalHours < MIN_INTERVAL_HOURS) {
        intervalHours = MIN_INTERVAL_HOURS;
        intervalInput.value = MIN_INTERVAL_HOURS;
      } else if (intervalHours > MAX_INTERVAL_HOURS) {
        intervalHours = MAX_INTERVAL_HOURS;
        intervalInput.value = MAX_INTERVAL_HOURS;
      }
      
      await chrome.storage.sync.set({ [CHECK_INTERVAL_KEY]: intervalHours });
      showStatus(`Check interval set to ${intervalHours} hour${intervalHours !== 1 ? 's' : ''}`);
    } catch (error) {
      showStatus('Failed to save check interval', true);
    }
  }

  // Initialize dropdown and load profile on popup open
  populateProfiles();
  loadProfile();
  loadNotificationToggle();
  loadCheckInterval();

  // Handle profile selection change
  select.addEventListener('change', (e) => {
    const selectedProfile = e.target.value;
    if (selectedProfile) {
      saveProfile(selectedProfile);
    }
  });

  // Handle notification toggle
  toggle.addEventListener('click', () => {
    const isCurrentlyEnabled = toggle.classList.contains('active');
    const newState = !isCurrentlyEnabled;
    toggle.classList.toggle('active', newState);
    saveNotificationToggle(newState);
  });

  // Handle check interval change
  intervalInput.addEventListener('change', () => {
    saveCheckInterval();
  });

  // Validate on input to prevent invalid values
  intervalInput.addEventListener('input', (e) => {
    let value = parseInt(e.target.value, 10);
    if (!isNaN(value)) {
      if (value < MIN_INTERVAL_HOURS) {
        e.target.value = MIN_INTERVAL_HOURS;
      } else if (value > MAX_INTERVAL_HOURS) {
        e.target.value = MAX_INTERVAL_HOURS;
      }
    }
  });
})();

