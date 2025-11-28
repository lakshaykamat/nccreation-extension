// API Service for fetching data - Global namespace

/**
 * @typedef {Object} ApiResponseItem
 * @property {number} row_number
 * @property {string} Month
 * @property {string} Date
 * @property {string} Article number
 * @property {number|string} Pages
 * @property {string} Completed - "Completed" | "Not started"
 * @property {string} Done by
 * @property {string|number} Time
 */

/**
 * @typedef {ApiResponseItem[]} ApiResponse
 */

window.TableExtensionAPI = (function() {
  'use strict';

  const API_URL = 'https://n8n-ex6e.onrender.com/webhook/last-five-days-files';
  const TIMEOUT = 20000; // 20 seconds

  // State management
  let articleDoneByMap = new Map();
  /** @type {ApiResponse|null} */
  let apiResponseData = null;
  let isFetching = false;
  let hasFetched = false;
  let fetchPromise = null;

  /**
   * Get the article to done-by mapping
   * @returns {Map<string, string>}
   */
  function getArticleMap() {
    return articleDoneByMap;
  }

  /**
   * Get the full API response data
   * @returns {ApiResponse|null}
   */
  function getApiResponseData() {
    return apiResponseData;
  }

  /**
   * Check if data has been fetched
   * @returns {boolean}
   */
  function hasDataFetched() {
    return hasFetched;
  }

  /**
   * Check if currently fetching
   * @returns {boolean}
   */
  function isCurrentlyFetching() {
    return isFetching;
  }

  /**
   * Fetch data from webhook API
   * @param {boolean} forceRefresh - Force refresh even if already fetched
   * @returns {Promise<void>}
   */
  async function fetchDoneByData(forceRefresh = false) {
    // If we already have data and not forcing refresh, skip
    if (hasFetched && !forceRefresh) {
      return;
    }
    
    // If fetch is already in progress, return the existing promise
    if (isFetching && fetchPromise) {
      return fetchPromise;
    }
    
    isFetching = true;
    
    // Create the fetch promise
    fetchPromise = (async () => {
      try {
        // Create a timeout promise
        const timeoutPromise = new Promise((_, reject) => {
          setTimeout(() => reject(new Error('Request timeout')), TIMEOUT);
        });
        
        // Race between fetch and timeout
        const response = await Promise.race([
          fetch(API_URL, {
            method: 'GET',
            headers: {
              'Accept': 'application/json',
            },
          }),
          timeoutPromise
        ]);
        
        // Check for error status codes (4xx, 5xx)
        if (!response.ok || response.status >= 400) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        /** @type {ApiResponse} */
        const data = await response.json();
        
        // Store the full API response data
        apiResponseData = data;
        
        // Create a map of Article number -> Done by
        articleDoneByMap.clear();
        if (Array.isArray(data)) {
          data.forEach(item => {
            if (item['Article number'] && item['Done by']) {
              articleDoneByMap.set(item['Article number'], item['Done by']);
            }
          });
        }
        
        hasFetched = true;
        
        return articleDoneByMap;
      } catch (error) {
        hasFetched = false; // Reset flag on error so we can retry
        throw error;
      } finally {
        isFetching = false;
        fetchPromise = null;
      }
    })();
    
    return fetchPromise;
  }

  // Public API
  return {
    getArticleMap,
    getApiResponseData,
    hasDataFetched,
    isCurrentlyFetching,
    fetchDoneByData
  };
})();
