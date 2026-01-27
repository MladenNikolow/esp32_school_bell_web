// src/types/auth.js
// TypeScript-style interface definitions using JSDoc

/**
 * Authentication state interface
 * @typedef {Object} AuthState
 * @property {string|null} token - JWT or session token from server
 * @property {boolean} isAuthenticated - Computed from token presence and validity
 * @property {boolean} isLoading - For login/logout operations
 * @property {boolean} isInitializing - For app startup token check
 * @property {string|null} error - Authentication error messages
 * @property {UserInfo|null} user - User information from login response
 */

/**
 * User information interface
 * @typedef {Object} UserInfo
 * @property {string} username - User's username
 * @property {string} [email] - User's email address (optional)
 * @property {string} [role] - User's role or permission level (optional)
 * @property {string} [displayName] - User's display name (optional)
 */

/**
 * Login credentials interface
 * @typedef {Object} LoginCredentials
 * @property {string} username - User's username
 * @property {string} password - User's password
 */

/**
 * Authentication response interface
 * @typedef {Object} AuthResponse
 * @property {string} token - Authentication token
 * @property {UserInfo} user - User information
 * @property {string} [message] - Optional success message
 */

/**
 * HTTP request options interface
 * @typedef {Object} RequestOptions
 * @property {Record<string, string>} [headers] - Additional headers
 * @property {boolean} [skipAuth] - Skip automatic token injection
 * @property {AbortSignal} [signal] - Abort signal for request cancellation
 */

/**
 * Token storage data interface
 * @typedef {Object} TokenData
 * @property {string} token - The authentication token
 * @property {number} timestamp - When the token was stored
 */

/**
 * Authentication error interface
 * @typedef {Object} AuthError
 * @property {string} message - Error message
 * @property {number} [status] - HTTP status code (if applicable)
 * @property {string} [code] - Error code (if applicable)
 */

// Export types for JSDoc usage
export {};