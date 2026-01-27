// src/utils/TokenManager.js

/**
 * @typedef {import('../types/auth.js').TokenData} TokenData
 */

/**
 * Token management utility for localStorage operations
 */
class TokenManager {
  constructor() {
    this.storageKey = 'esp32_auth_token';
  }

  /**
   * Store authentication token in localStorage
   * @param {string} token - Token to store
   * @returns {boolean} True if stored successfully
   */
  storeToken(token) {
    try {
      if (!token || typeof token !== 'string') {
        throw new Error('Invalid token provided');
      }

      const tokenData = {
        token,
        timestamp: Date.now(),
      };

      localStorage.setItem(this.storageKey, JSON.stringify(tokenData));
      return true;
    } catch (error) {
      console.error('Failed to store token:', error);
      return false;
    }
  }

  /**
   * Retrieve stored token from localStorage
   * @returns {string|null} Stored token or null if not found
   */
  getStoredToken() {
    try {
      const storedData = localStorage.getItem(this.storageKey);
      if (!storedData) {
        return null;
      }

      const parsed = JSON.parse(storedData);
      
      // Validate token data structure
      if (!parsed || typeof parsed !== 'object' || !parsed.token) {
        this.clearStoredToken(); // Clear invalid data
        return null;
      }

      return parsed.token;
    } catch (error) {
      console.warn('Failed to parse stored token:', error);
      this.clearStoredToken(); // Clear corrupted data
      return null;
    }
  }

  /**
   * Get full token data including metadata
   * @returns {TokenData|null} Token data or null if not found
   */
  getTokenData() {
    try {
      const storedData = localStorage.getItem(this.storageKey);
      if (!storedData) {
        return null;
      }

      const parsed = JSON.parse(storedData);
      
      // Validate token data structure
      if (!parsed || typeof parsed !== 'object' || !parsed.token) {
        this.clearStoredToken(); // Clear invalid data
        return null;
      }

      return parsed;
    } catch (error) {
      console.warn('Failed to parse stored token data:', error);
      this.clearStoredToken(); // Clear corrupted data
      return null;
    }
  }

  /**
   * Clear stored token from localStorage
   * @returns {boolean} True if cleared successfully
   */
  clearStoredToken() {
    try {
      localStorage.removeItem(this.storageKey);
      return true;
    } catch (error) {
      console.warn('Failed to clear stored token:', error);
      return false;
    }
  }

  /**
   * Check if a token is currently stored
   * @returns {boolean} True if token exists
   */
  hasStoredToken() {
    return !!this.getStoredToken();
  }

  /**
   * Check if localStorage is available
   * @returns {boolean} True if localStorage is available
   */
  isStorageAvailable() {
    try {
      const testKey = '__storage_test__';
      localStorage.setItem(testKey, 'test');
      localStorage.removeItem(testKey);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Get token age in milliseconds
   * @returns {number|null} Age in milliseconds or null if no token
   */
  getTokenAge() {
    const tokenData = this.getTokenData();
    if (!tokenData || !tokenData.timestamp) {
      return null;
    }

    return Date.now() - tokenData.timestamp;
  }

  /**
   * Check if token is older than specified age
   * @param {number} maxAge - Maximum age in milliseconds
   * @returns {boolean} True if token is too old
   */
  isTokenExpired(maxAge) {
    const age = this.getTokenAge();
    return age !== null && age > maxAge;
  }
}

// Export singleton instance
export default new TokenManager();