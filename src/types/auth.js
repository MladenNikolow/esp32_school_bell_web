// src/types/auth.js
// TypeScript-style interface definitions using JSDoc

/**
 * Authentication state interface (HttpOnly cookie-based)
 * @typedef {Object} AuthState
 * @property {boolean} isAuthenticated - Whether the user has an active session
 * @property {boolean} isLoading - For login/logout operations
 * @property {boolean} isInitializing - For app startup session check
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
 * Authentication response interface (HttpOnly cookie-based).
 * The actual token is set via Set-Cookie header, not in the JSON body.
 * @typedef {Object} AuthResponse
 * @property {UserInfo} user - User information
 * @property {string} [message] - Optional success message
 */

/**
 * HTTP request options interface
 * @typedef {Object} RequestOptions
 * @property {Record<string, string>} [headers] - Additional headers
 * @property {boolean} [skipAuth] - Skip authentication check
 * @property {AbortSignal} [signal] - Abort signal for request cancellation
 */

/**
 * Client-side session metadata stored in sessionStorage.
 * The actual auth token is in the HttpOnly cookie managed by the browser.
 * @typedef {Object} SessionMeta
 * @property {boolean} authenticated - Whether a login has been confirmed
 * @property {number} timestamp - When the session was established
 */

/**
 * @deprecated Use SessionMeta instead
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