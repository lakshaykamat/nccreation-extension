// API Service for fetching data - Global namespace

window.TableExtensionAPI = (function() {
  'use strict';

  const API_URL = 'https://n8n-ex6e.onrender.com/webhook/powertrack3';
  const TIMEOUT = 30000; // 30 seconds

  // State management
  let articleDoneByMap = new Map();
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
      console.log('Data already fetched, skipping...');
      return;
    }
    
    // If fetch is already in progress, return the existing promise
    if (isFetching && fetchPromise) {
      console.log('Fetch already in progress, reusing promise...');
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
        
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const data = await response.json();
        
        // Create a map of Article number -> Done by
        articleDoneByMap.clear();
        if (Array.isArray(data)) {
          data.forEach(item => {
            if (item['Article number'] && item['Done by']) {
              articleDoneByMap.set(item['Article number'], item['Done by']);
            }
          });
        }
        
        console.log(`Loaded ${articleDoneByMap.size} article assignments from API`);
        hasFetched = true;
        
        return articleDoneByMap;
      } catch (error) {
        console.error('Error fetching done by data:', error);
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
    hasDataFetched,
    isCurrentlyFetching,
    fetchDoneByData
  };
})();
