// src/utils/HttpClient.js
import TokenManager from './TokenManager.js';
import HttpDiagnostics from './HttpDiagnostics.js';
import RequestScheduler from './RequestScheduler.js';
import { isPublicEndpoint, API_CONFIG } from '../config/apiConfig.js';

/**
 * @typedef {Object} RequestOptions
 * @property {Record<string, string>} [headers] - Additional headers
 * @property {boolean} [skipAuth] - Skip authentication check
 * @property {AbortSignal} [signal] - Abort signal for request cancellation
 */

/**
 * Enhanced HTTP client with HttpOnly cookie-based authentication.
 * 
 * The server sets an HttpOnly session cookie on login. The browser
 * automatically attaches it to every same-origin request via
 * `credentials: 'same-origin'`. No Authorization header is needed.
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
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
      },
      ...options,
    });
  }

  /**
   * Make a generic HTTP request with cookie-based authentication
   * @param {string} url - Request URL
   * @param {RequestInit & RequestOptions} options - Request options
   * @returns {Promise<Response>} Fetch response
   */
  async request(url, options = {}) {
    const {
      skipAuth = false,
      skipAuthErrorHandling = false,
      priority = null,
      exclusive = false,
      deduplicate = true,
      ...fetchOptions
    } = options;

    // Prepare headers
    const headers = {
      ...fetchOptions.headers,
    };

    // CSRF defense: add X-Requested-With on all state-changing requests.
    // The server must reject POST/PUT/DELETE without this header.
    // Cross-origin forms and simple requests cannot set custom headers.
    const method = (fetchOptions.method || 'GET').toUpperCase();
    if (method !== 'GET' && method !== 'HEAD' && method !== 'OPTIONS') {
      headers['X-Requested-With'] = 'XMLHttpRequest';
    }

    // Check that protected endpoints have an active session
    if (!skipAuth && !this.isLoginRequest(url)) {
      if (this.requiresAuth(url) && !TokenManager.hasAuthSession()) {
        throw new Error('Authentication required but no active session');
      }
    }

    // Make the request — browser sends HttpOnly cookie automatically
    const requestPriority = priority ?? (method === 'GET' ? 'visible' : 'critical');
    const normalizedUrl = new URL(url, window.location.origin).toString();
    const key = method === 'GET' && deduplicate ? `${method}:${normalizedUrl}` : null;
    const queuedAt = performance.now();
    let startedAt = queuedAt;
    const execute = async () => {
      let lastError;
      const attempts = method === 'GET' ? 2 : 1;
      for (let attempt = 0; attempt < attempts; attempt += 1) {
        const diagnostic = HttpDiagnostics.start(method, url, {
          queuedAt: startedAt,
          priority: requestPriority,
          retryAttempt: attempt,
        });
        try {
          const response = await fetch(url, {
            ...fetchOptions,
            headers,
            credentials: 'same-origin',
          });
          HttpDiagnostics.response(diagnostic, response);
          return response;
        } catch (error) {
          HttpDiagnostics.error(diagnostic, error);
          lastError = error;
          if (!(error instanceof TypeError) || attempt + 1 >= attempts) throw error;
          const delay = 250 + Math.floor(Math.random() * 251);
          HttpDiagnostics.event(method, url, 'retry', { retryAttempt: attempt + 1, delayMs: delay });
          await new Promise((resolve) => setTimeout(resolve, delay));
        } finally {
          HttpDiagnostics.finish(diagnostic);
        }
      }
      throw lastError;
    };

    if (key && RequestScheduler.inFlight.has(key)) {
      HttpDiagnostics.event(method, url, 'deduplicated', {
        priority: requestPriority,
        deduplicated: true,
      });
    }

    try {
      const response = await RequestScheduler.schedule(execute, {
        priority: requestPriority,
        key,
        signal: fetchOptions.signal,
        exclusive,
        onQueued: () => HttpDiagnostics.event(method, url, 'queued', {
          queuedAt,
          priority: requestPriority,
        }),
        onStarted: () => {
          startedAt = performance.now();
          HttpDiagnostics.event(method, url, 'dequeued', {
            priority: requestPriority,
            queueWaitMs: Math.round(startedAt - queuedAt),
          });
        },
      });

      if (!skipAuthErrorHandling && (response.status === 401 || response.status === 403)) {
        TokenManager.clearAuthSession();
        window.dispatchEvent(new CustomEvent('auth-error', {
          detail: { status: response.status, url }
        }));
        throw new Error(`Authentication failed: ${response.status}`);
      }

      return response;
    } catch (error) { throw error; }
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
