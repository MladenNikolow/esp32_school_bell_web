// src/utils/HttpRequestAgent.js
import HttpClient from './HttpClient.js';
import TokenManager from './TokenManager.js';
import { API_CONFIG, getApiUrl, isPublicEndpoint, getErrorMessage } from '../config/apiConfig.js';

/**
 * HTTP Request Agent that follows existing ESP32 patterns
 * Provides a simplified interface for common API operations
 */
class HttpRequestAgent {
  constructor() {
    this.httpClient = HttpClient;
    this.tokenManager = TokenManager;
  }

  /**
   * Make an authenticated GET request following ESP32 patterns
   * @param {string} endpoint - API endpoint (e.g., '/api/mode')
   * @param {AbortSignal} [signal] - Abort signal for cancellation
   * @returns {Promise<any>} Parsed JSON response
   */
  async get(endpoint, signal = null) {
    try {
      const response = await this.httpClient.get(endpoint, { signal });
      return this._parseResponse(response);
    } catch (error) {
      if (error.name === 'AbortError') {
        throw error;
      }
      throw new Error(error.message || 'GET request failed');
    }
  }

  /**
   * Make an authenticated POST request following ESP32 patterns
   * @param {string} endpoint - API endpoint
   * @param {any} data - Request payload
   * @param {AbortSignal} [signal] - Abort signal for cancellation
   * @returns {Promise<any>} Parsed JSON response
   */
  async post(endpoint, data, signal = null) {
    try {
      const response = await this.httpClient.post(endpoint, data, { signal });
      return this._parseResponse(response);
    } catch (error) {
      if (error.name === 'AbortError') {
        throw error;
      }
      throw new Error(error.message || 'POST request failed');
    }
  }

  /**
   * Make a login request (unauthenticated)
   * @param {Object} credentials - Login credentials
   * @returns {Promise<any>} Authentication response
   */
  async login(credentials) {
    try {
      const response = await this.httpClient.post(
        API_CONFIG.ENDPOINTS.LOGIN, 
        credentials, 
        { skipAuth: true }
      );
      
      if (!response.ok) {
        const errorData = await this._parseResponseBody(response).catch(() => ({}));
        const errorMessage = getErrorMessage(response.status, errorData.message);
        throw new Error(errorMessage);
      }
      
      const data = await this._parseResponseBody(response);
      
      // Validate response
      if (!data.token) {
        throw new Error('Invalid server response: missing authentication token');
      }
      
      // Store token using TokenManager
      const stored = this.tokenManager.storeToken(data.token);
      if (!stored) {
        throw new Error('Failed to store authentication token');
      }
      
      return data;
    } catch (error) {
      // Ensure clean state on login failure
      this.tokenManager.clearStoredToken();
      
      if (error.name === 'TypeError' && error.message.includes('fetch')) {
        throw new Error(API_CONFIG.ERROR_MESSAGES.NETWORK_ERROR);
      }
      
      throw error;
    }
  }

  /**
   * Make a logout request and clean up tokens
   * @returns {Promise<void>}
   */
  async logout() {
    try {
      // Try to notify server first
      const token = this.tokenManager.getStoredToken();
      if (token) {
        try {
          await this.httpClient.post(API_CONFIG.ENDPOINTS.LOGOUT, {}, { 
            timeout: 5000 // Short timeout for logout
          });
        } catch (error) {
          // Ignore server logout errors
          console.warn('Server logout failed:', error.message);
        }
      }
    } finally {
      // Always clear local token
      this.tokenManager.clearStoredToken();
    }
  }

  /**
   * Validate current token with server
   * @returns {Promise<{valid: boolean, user?: any}>}
   */
  async validateToken() {
    const token = this.tokenManager.getStoredToken();
    if (!token) {
      return { valid: false };
    }

    try {
      const response = await this.httpClient.get(API_CONFIG.ENDPOINTS.VALIDATE_TOKEN);
      
      if (!response.ok) {
        this.tokenManager.clearStoredToken();
        return { valid: false };
      }
      
      const data = await this._parseResponseBody(response);
      return { valid: true, user: data.user };
    } catch (error) {
      console.warn('Token validation failed:', error.message);
      this.tokenManager.clearStoredToken();
      return { valid: false };
    }
  }

  /**
   * Check if user is currently authenticated
   * @returns {boolean}
   */
  isAuthenticated() {
    return this.tokenManager.hasStoredToken();
  }

  /**
   * Get current authentication token
   * @returns {string|null}
   */
  getToken() {
    return this.tokenManager.getStoredToken();
  }

  /**
   * Clear authentication state
   */
  clearAuth() {
    this.tokenManager.clearStoredToken();
  }

  /**
   * Create an abort controller for request cancellation
   * @returns {AbortController}
   */
  createAbortController() {
    return new AbortController();
  }

  /**
   * Parse HTTP response with proper error handling
   * Handles JSON responses, empty responses (204), and content-type validation
   * @param {Response} response - Fetch Response object
   * @returns {Promise<any>} Parsed response data
   * @private
   */
  async _parseResponse(response) {
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    
    return this._parseResponseBody(response);
  }

  /**
   * Parse response body handling empty responses and JSON parsing errors
   * @param {Response} response - Fetch Response object
   * @returns {Promise<any>} Parsed response data or empty object
   * @private
   */
  async _parseResponseBody(response) {
    // Handle 204 No Content and other empty responses
    if (response.status === 204 || response.headers.get('content-length') === '0') {
      return {};
    }

    const contentType = response.headers.get('content-type');
    
    // Check if response is JSON
    if (contentType && !contentType.includes('application/json')) {
      throw new Error(`Unexpected content-type: ${contentType}. Expected application/json`);
    }

    try {
      let text = await response.text();
      
      // Return empty object for empty text
      if (!text) {
        return {};
      }

      // Clean malformed JSON - escape control characters in strings
      // This handles cases where server returns unescaped control chars
      try {
        return JSON.parse(text);
      } catch (initialError) {
        if (initialError instanceof SyntaxError) {
          // Try to clean control characters and retry
          const cleaned = this._cleanJsonString(text);
          if (cleaned !== text) {
            try {
              return JSON.parse(cleaned);
            } catch (retryError) {
              // If cleaning didn't help, throw detailed error with response preview
              console.error('Response text (first 200 chars):', text.substring(0, 200));
              throw new Error(`Invalid JSON response: ${initialError.message}`);
            }
          }
          // If no cleaning was done, throw original error
          console.error('Response text (first 200 chars):', text.substring(0, 200));
          throw new Error(`Invalid JSON response: ${initialError.message}`);
        }
        throw initialError;
      }
    } catch (error) {
      throw error;
    }
  }

  /**
   * Clean JSON string by escaping unescaped control characters
   * @param {string} jsonString - Raw JSON string
   * @returns {string} Cleaned JSON string
   * @private
   */
  _cleanJsonString(jsonString) {
    // Replace unescaped control characters (0x00-0x1F) with escaped versions
    return jsonString.replace(/[\x00-\x1F]/g, (char) => {
      const code = char.charCodeAt(0);
      return `\\u${code.toString(16).padStart(4, '0')}`;
    });
  }

  /**
   * Make a request with automatic retry on network errors
   * @param {Function} requestFn - Function that makes the request
   * @param {number} maxRetries - Maximum retry attempts
   * @param {number} delay - Delay between retries in ms
   * @returns {Promise<any>}
   */
  async withRetry(requestFn, maxRetries = 2, delay = 1000) {
    let lastError;
    
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        return await requestFn();
      } catch (error) {
        lastError = error;
        
        // Don't retry on auth errors or if this is the last attempt
        if (error.message.includes('Authentication failed') || 
            error.message.includes('401') || 
            error.message.includes('403') ||
            attempt === maxRetries) {
          throw error;
        }
        
        // Wait before retry
        await new Promise(resolve => setTimeout(resolve, delay * (attempt + 1)));
      }
    }
    
    throw lastError;
  }
}

// Export singleton instance
export default new HttpRequestAgent();