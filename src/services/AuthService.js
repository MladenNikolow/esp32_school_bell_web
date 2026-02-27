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
   * Authenticate user with credentials
   * @param {LoginCredentials} credentials - User credentials
   * @returns {Promise<AuthResponse>} Authentication response
   */
  async login(credentials) {
    // Validate credentials before sending
    this.validateCredentials(credentials);

    try {
      const response = await this.httpClient.post(API_CONFIG.ENDPOINTS.LOGIN, credentials, {
        skipAuth: true // Login requests don't need auth token
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(this.errorHandler.getAuthErrorMessage({ 
          message: `${response.status}: ${errorData.message || 'Login failed'}` 
        }));
      }

      const data = await response.json();
      
      // Validate response structure
      if (!data.token) {
        throw new Error('Invalid server response: missing authentication token');
      }

      // Store token using TokenManager
      const stored = this.tokenManager.storeToken(data.token);
      if (!stored) {
        throw new Error('Failed to store authentication token');
      }

      return {
        token: data.token,
        user: data.user || { username: credentials.username },
        message: data.message || 'Login successful'
      };
    } catch (error) {
      // Ensure no partial auth state on login failure
      this.tokenManager.clearStoredToken();
      
      // Use error handler for consistent error processing
      const errorInfo = this.errorHandler.handleAuthError(error, { action: 'login' });
      throw new Error(errorInfo.message);
    }
  }

  /**
   * Log out current user
   * @returns {Promise<void>}
   */
  async logout() {
    const token = this.tokenManager.getStoredToken();
    
    try {
      // Notify server of logout (best effort)
      if (token) {
        await this.httpClient.post(API_CONFIG.ENDPOINTS.LOGOUT, {}, {
          timeout: 5000 // Short timeout for logout
        }).catch(error => {
          this.errorHandler.logError(error, 'logout', { token: !!token });
        });
      }
    } finally {
      // Always clear local storage regardless of server response
      this.tokenManager.clearStoredToken();
    }
  }

  /**
   * Validate stored token with server
   * @returns {Promise<{valid: boolean, user?: UserInfo}>}
   */
  async validateStoredToken() {
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
      
      const data = await response.json();
      return { 
        valid: true, 
        user: data.user || null 
      };
    } catch (error) {
      this.errorHandler.logError(error, 'token-validation', { hasToken: !!token });
      this.tokenManager.clearStoredToken();
      return { valid: false };
    }
  }

  /**
   * Get stored authentication token
   * @returns {string|null} Stored token or null if not found
   */
  getStoredToken() {
    return this.tokenManager.getStoredToken();
  }

  /**
   * Store authentication token
   * @param {string} token - Token to store
   */
  storeToken(token) {
    return this.tokenManager.storeToken(token);
  }

  /**
   * Clear stored authentication token
   */
  clearStoredToken() {
    this.tokenManager.clearStoredToken();
  }

  /**
   * Check if user is currently authenticated
   * @returns {boolean} True if authenticated
   */
  isAuthenticated() {
    return this.tokenManager.hasStoredToken();
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
   * Create authentication headers for manual requests
   * @returns {Object} Headers object with Authorization header
   */
  getAuthHeaders() {
    const token = this.getStoredToken();
    return token ? { Authorization: `Bearer ${token}` } : {};
  }

  /**
   * Check if token is expired based on age
   * @param {number} maxAge - Maximum age in milliseconds
   * @returns {boolean} True if token is expired
   */
  isTokenExpired(maxAge = 24 * 60 * 60 * 1000) { // Default 24 hours
    return this.tokenManager.isTokenExpired(maxAge);
  }

  /**
   * Get token metadata
   * @returns {Object|null} Token data with timestamp
   */
  getTokenData() {
    return this.tokenManager.getTokenData();
  }
}

// Export singleton instance
export default new AuthService();