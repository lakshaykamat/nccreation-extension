// Popup script for extension control

document.addEventListener('DOMContentLoaded', function() {
  const toggle = document.getElementById('cssToggle');
  
  // Load saved state
  chrome.storage.local.get(['extensionCSSEnabled'], function(result) {
    const enabled = result.extensionCSSEnabled !== false; // Default to true
    toggle.checked = enabled;
  });
  
  // Handle toggle change
  toggle.addEventListener('change', function() {
    const enabled = toggle.checked;
    
    // Save state
    chrome.storage.local.set({ extensionCSSEnabled: enabled }, function() {
      // Send message to content script to update CSS
      chrome.tabs.query({ active: true, currentWindow: true }, function(tabs) {
        if (tabs[0]) {
          chrome.tabs.sendMessage(tabs[0].id, {
            type: 'toggleCSS',
            enabled: enabled
          });
        }
      });
    });
  });
});

