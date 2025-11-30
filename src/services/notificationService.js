// Notification Service - Handles Chrome system notifications - Global namespace

window.TableExtensionNotification = (function() {
  'use strict';

  /**
   * Request notification permission if needed
   * @returns {Promise<string>} - Permission status
   */
  async function requestPermission() {
    if (!('Notification' in window)) {
      return 'unsupported';
    }

    if (Notification.permission === 'default') {
      return await Notification.requestPermission();
    }

    return Notification.permission;
  }

  /**
   * Send Chrome system notification
   * @param {string} title - Notification title
   * @param {Object} options - Notification options
   * @param {string} options.body - Notification body text
   * @param {string} options.icon - Icon URL (optional)
   * @param {string} options.tag - Notification tag for replacing (optional)
   * @param {number} options.requireInteraction - Require user interaction (optional)
   * @returns {Promise<Notification|null>} - Notification object or null if failed
   */
  async function sendNotification(title, options = {}) {
    if (!('Notification' in window)) {
      return null;
    }

    const permission = await requestPermission();

    if (permission !== 'granted') {
      return null;
    }

    const notificationOptions = {
      body: options.body || '',
      icon: options.icon || chrome.runtime.getURL('icons/logo-32.png'),
      tag: options.tag || 'default',
      requireInteraction: options.requireInteraction || false,
      ...options
    };

    return new Notification(title, notificationOptions);
  }

  return {
    sendNotification,
    requestPermission
  };
})();

