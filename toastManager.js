// Toast Manager - Handles toast notifications - Global namespace

window.TableExtensionToast = (function() {
  'use strict';

  /**
   * Add toast animation styles if not exists
   */
  function ensureToastStyles() {
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
  }

  /**
   * Create close button for toast
   * @param {HTMLElement} toast - Toast element
   * @param {number} autoRemoveTimeout - Auto remove timeout ID
   * @returns {HTMLElement}
   */
  function createCloseButton(toast, autoRemoveTimeout) {
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
      if (autoRemoveTimeout) {
        clearTimeout(autoRemoveTimeout);
      }
      toast.style.animation = 'slideIn 0.3s ease-out reverse';
      setTimeout(() => {
        if (toast.parentNode) {
          toast.remove();
        }
      }, 300);
    };
    return closeBtn;
  }

  /**
   * Create toast header with close button
   * @param {HTMLElement} toast - Toast element
   * @param {number} autoRemoveTimeout - Auto remove timeout ID
   * @returns {HTMLElement}
   */
  function createToastHeader(toast, autoRemoveTimeout) {
    const header = document.createElement('div');
    header.style.cssText = `
      display: flex;
      justify-content: flex-end;
      align-items: center;
      margin-bottom: 8px;
    `;
    const closeBtn = createCloseButton(toast, autoRemoveTimeout);
    header.appendChild(closeBtn);
    return header;
  }

  /**
   * Create messages container
   * @param {Array} messages - Array of message strings
   * @returns {HTMLElement}
   */
  function createMessagesContainer(messages) {
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
    return messagesContainer;
  }

  /**
   * Create and show toast notification with multiple messages
   * @param {Array<string|Object>} messages - Array of message strings or objects
   */
  function showToast(messages) {
    const existingToast = document.getElementById('extension-toast');
    if (existingToast) {
      existingToast.remove();
    }

    if (!messages || messages.length === 0) return;

    ensureToastStyles();

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

    const header = createToastHeader(toast, autoRemoveTimeout);
    toast.appendChild(header);

    const messagesContainer = createMessagesContainer(messages);
    toast.appendChild(messagesContainer);

    document.body.appendChild(toast);
  }

  return {
    showToast
  };
})();

