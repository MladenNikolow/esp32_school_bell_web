// src/services/AuthService.js
import HttpClient from '../utils/HttpClient.js';
import TokenManager from '../utils/TokenManager.js';
import ErrorHandlingService from './ErrorHandlingService.js';
import { API_CONFIG } from '../config/apiConfig.js';

/**
 * @typedef {Object} LoginCredentials
 * @property {string} username - User's username
 * @property {string} password - User's password
 */

/**
 * @typedef {Object} UserInfo
 * @property {string} username - User's username
 */

/**
 * @typedef {Object} AuthResponse
 * @property {string} token - Authentication token
 * @property {UserInfo} user - User information
 */

/**
 * Authentication service for handling login, logout, and token management
 * Integrates with ESP32 server authentication endpoints
 */
class AuthService {
  constructor() {
    this.httpClient = HttpClient;
    this.tokenManager = TokenManager;
    this.errorHandler = ErrorHandlingService;
  }

  /**
   * Authenticate user with credentials.
   * The server responds with a Set-Cookie header containing the HttpOnly session cookie.
   * @param {LoginCredentials} credentials - User credentials
   * @returns {Promise<AuthResponse>} Authentication response (user info, message)
   */
  async login(credentials) {
    // Validate credentials before sending
    this.validateCredentials(credentials);

    try {
      const response = await this.httpClient.post(API_CONFIG.ENDPOINTS.LOGIN, credentials, {
        skipAuth: true // Login requests don't need auth
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(this.errorHandler.getAuthErrorMessage({ 
          message: `${response.status}: ${errorData.message || 'Login failed'}` 
        }));
      }

      const data = await response.json();

      // Mark client-side auth metadata (actual token is in HttpOnly cookie)
      this.tokenManager.markAuthenticated();

      return {
        user: data.user || { username: credentials.username },
        message: data.message || 'Login successful'
      };
    } catch (error) {
      // Ensure no partial auth state on login failure
      this.tokenManager.clearAuthSession();
      
      // Use error handler for consistent error processing
      const errorInfo = this.errorHandler.handleAuthError(error, { action: 'login' });
      throw new Error(errorInfo.message);
    }
  }

  /**
   * Log out current user.
   * The server responds with an expired Set-Cookie to clear the HttpOnly cookie.
   * @returns {Promise<void>}
   */
  async logout() {
    try {
      // Notify server of logout (best effort) — server clears the HttpOnly cookie
      if (this.tokenManager.hasAuthSession()) {
        await this.httpClient.post(API_CONFIG.ENDPOINTS.LOGOUT, {}, {
          timeout: 5000,
          skipAuthErrorHandling: true
        }).catch(error => {
          this.errorHandler.logError(error, 'logout', { hasSession: true });
        });
      }
    } finally {
      // Always clear client-side auth metadata
      this.tokenManager.clearAuthSession();
    }
  }

  /**
   * Validate current session with server
   * @returns {Promise<{valid: boolean, user?: UserInfo}>}
   */
  async validateStoredToken() {
    try {
      // Always ask the server — the HttpOnly session cookie is the source of truth
      // and is shared across tabs (unlike sessionStorage).
      const response = await this.httpClient.get(API_CONFIG.ENDPOINTS.VALIDATE_TOKEN, {
        skipAuth: true,
        skipAuthErrorHandling: true
      });
      
      if (!response.ok) {
        this.tokenManager.clearAuthSession();
        return { valid: false };
      }
      
      const data = await response.json();
      // Sync client-side metadata so other code paths see us as authenticated
      this.tokenManager.markAuthenticated();
      return { 
        valid: true, 
        user: data.user || null 
      };
    } catch (error) {
      this.errorHandler.logError(error, 'session-validation', { hasSession: false });
      this.tokenManager.clearAuthSession();
      return { valid: false };
    }
  }

  /**
   * Check if there is an active auth session (client-side hint)
   * @returns {boolean}
   */
  hasAuthSession() {
    return this.tokenManager.hasAuthSession();
  }

  /**
   * Clear client-side auth metadata
   */
  clearAuthSession() {
    this.tokenManager.clearAuthSession();
  }

  /**
   * Check if user is currently authenticated (client-side hint)
   * @returns {boolean} True if authenticated
   */
  isAuthenticated() {
    return this.tokenManager.hasAuthSession();
  }

  /**
   * Validate credentials format
   * @param {LoginCredentials} credentials - Credentials to validate
   * @throws {Error} If credentials are invalid
   */
  validateCredentials(credentials) {
    if (!credentials || typeof credentials !== 'object') {
      throw new Error('Invalid credentials: must be an object');
    }

    if (!credentials.username || typeof credentials.username !== 'string') {
      throw new Error('Invalid credentials: username is required');
    }

    if (!credentials.password || typeof credentials.password !== 'string') {
      throw new Error('Invalid credentials: password is required');
    }

    if (credentials.username.trim().length === 0) {
      throw new Error('Invalid credentials: username cannot be empty');
    }

    if (credentials.password.length === 0) {
      throw new Error('Invalid credentials: password cannot be empty');
    }

    // Basic length validation
    if (credentials.username.length > 100) {
      throw new Error('Invalid credentials: username too long');
    }

    if (credentials.password.length > 200) {
      throw new Error('Invalid credentials: password too long');
    }
  }

  /**
   * Get user-friendly login error message
   * @param {number} status - HTTP status code
   * @param {Object} errorData - Error data from server
   * @returns {string} User-friendly error message
   */
  getLoginErrorMessage(status, errorData) {
    const serverMessage = errorData.message || errorData.error;

    switch (status) {
      case 400:
        return serverMessage || 'Invalid login request';
      case 401:
        return 'Invalid username or password';
      case 403:
        return 'Account access denied';
      case 429:
        return 'Too many login attempts. Please try again later.';
      case 500:
        return 'Server error. Please try again later.';
      case 503:
        return 'Authentication service temporarily unavailable';
      default:
        return serverMessage || `Authentication failed (${status})`;
    }
  }

  /**
   * Check if session is expired based on age
   * @param {number} maxAge - Maximum age in milliseconds
   * @returns {boolean} True if session is expired
   */
  isSessionExpired(maxAge = 24 * 60 * 60 * 1000) { // Default 24 hours
    return this.tokenManager.isSessionExpired(maxAge);
  }
}

// Export singleton instance
export default new AuthService();