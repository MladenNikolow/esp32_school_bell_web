// src/utils/HttpClient.js
import TokenManager from './TokenManager.js';
import { isPublicEndpoint, API_CONFIG } from '../config/apiConfig.js';

/**
 * @typedef {Object} RequestOptions
 * @property {Record<string, string>} [headers] - Additional headers
 * @property {boolean} [skipAuth] - Skip automatic token injection
 * @property {AbortSignal} [signal] - Abort signal for request cancellation
 */

/**
 * Enhanced HTTP client with automatic authentication token injection
 */
class HttpClient {
  /**
   * Make a GET request
   * @param {string} url - Request URL
   * @param {RequestOptions} [options] - Request options
   * @returns {Promise<Response>} Fetch response
   */
  async get(url, options = {}) {
    return this.request(url, {
      method: 'GET',
      ...options,
    });
  }

  /**
   * Make a POST request
   * @param {string} url - Request URL
   * @param {any} data - Request body data
   * @param {RequestOptions} [options] - Request options
   * @returns {Promise<Response>} Fetch response
   */
  async post(url, data, options = {}) {
    return this.request(url, {
      method: 'POST',
      body: JSON.stringify(data),
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
      },
      ...options,
    });
  }

  /**
   * Make a PUT request
   * @param {string} url - Request URL
   * @param {any} data - Request body data
   * @param {RequestOptions} [options] - Request options
   * @returns {Promise<Response>} Fetch response
   */
  async put(url, data, options = {}) {
    return this.request(url, {
      method: 'PUT',
      body: JSON.stringify(data),
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
      },
      ...options,
    });
  }

  /**
   * Make a DELETE request
   * @param {string} url - Request URL
   * @param {RequestOptions} [options] - Request options
   * @returns {Promise<Response>} Fetch response
   */
  async delete(url, options = {}) {
    return this.request(url, {
      method: 'DELETE',
      ...options,
    });
  }

  /**
   * Make a generic HTTP request with automatic token injection
   * @param {string} url - Request URL
   * @param {RequestInit & RequestOptions} options - Request options
   * @returns {Promise<Response>} Fetch response
   */
  async request(url, options = {}) {
    const { skipAuth = false, ...fetchOptions } = options;

    // Prepare headers
    const headers = {
      ...fetchOptions.headers,
    };

    // Add authentication token if not skipped and not a login request
    if (!skipAuth && !this.isLoginRequest(url)) {
      const token = TokenManager.getStoredToken();
      
      if (token) {
        headers.Authorization = `Bearer ${token}`;
      } else if (this.requiresAuth(url)) {
        // Block requests that require auth when no token is available
        throw new Error('Authentication required but no token available');
      }
    }

    // Make the request
    const response = await fetch(url, {
      ...fetchOptions,
      headers,
    });

    // Handle authentication errors
    if (response.status === 401 || response.status === 403) {
      // Clear stored token on authentication failure
      TokenManager.clearStoredToken();
      
      // Dispatch custom event for auth error handling
      window.dispatchEvent(new CustomEvent('auth-error', {
        detail: { status: response.status, url }
      }));
      
      throw new Error(`Authentication failed: ${response.status}`);
    }

    return response;
  }

  /**
   * Check if URL is a login request
   * @param {string} url - Request URL
   * @returns {boolean} True if login request
   */
  isLoginRequest(url) {
    return url.includes(API_CONFIG.ENDPOINTS.LOGIN);
  }

  /**
   * Check if URL requires authentication
   * @param {string} url - Request URL
   * @returns {boolean} True if authentication required
   */
  requiresAuth(url) {
    return url.startsWith('/api/') && !isPublicEndpoint(url);
  }

  /**
   * Create a request with automatic retry on auth failure
   * @param {string} url - Request URL
   * @param {RequestInit & RequestOptions} options - Request options
   * @param {number} [maxRetries=1] - Maximum retry attempts
   * @returns {Promise<Response>} Fetch response
   */
  async requestWithRetry(url, options = {}, maxRetries = 1) {
    let lastError;
    
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        return await this.request(url, options);
      } catch (error) {
        lastError = error;
        
        // Don't retry on auth errors or if this is the last attempt
        if (error.message.includes('Authentication failed') || attempt === maxRetries) {
          throw error;
        }
        
        // Wait before retry
        await new Promise(resolve => setTimeout(resolve, 1000 * (attempt + 1)));
      }
    }
    
    throw lastError;
  }
}

// Export singleton instance
export default new HttpClient();