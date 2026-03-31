// src/utils/TokenManager.js

/**
 * Token management utility for HttpOnly cookie-based authentication.
 * 
 * The actual auth token is stored as an HttpOnly session cookie by the server
 * (Set-Cookie header with no Expires/Max-Age). JavaScript cannot read or write
 * the cookie directly — the browser handles it automatically.
 * 
 * This class only tracks lightweight client-side auth metadata (login timestamp)
 * in sessionStorage so the UI can determine authenticated state and session age.
 * The sessionStorage data is automatically cleared when the browser is closed.
 */
class TokenManager {
  constructor() {
    this.storageKey = 'esp32_auth_meta';
  }

  /**
   * Record that a successful login occurred.
   * Called after the server sets the HttpOnly session cookie.
   * @returns {boolean} True if recorded successfully
   */
  markAuthenticated() {
    try {
      const meta = {
        authenticated: true,
        timestamp: Date.now(),
      };
      sessionStorage.setItem(this.storageKey, JSON.stringify(meta));
      return true;
    } catch (error) {
      console.error('Failed to store auth metadata:', error);
      return false;
    }
  }

  /**
   * Check if the client believes it is authenticated.
   * This is a client-side hint only — the server is the source of truth
   * via the HttpOnly cookie.
   * @returns {boolean} True if auth metadata exists
   */
  hasAuthSession() {
    try {
      const stored = sessionStorage.getItem(this.storageKey);
      if (!stored) return false;

      const parsed = JSON.parse(stored);
      return !!(parsed && parsed.authenticated);
    } catch {
      this.clearAuthSession();
      return false;
    }
  }

  /**
   * Clear client-side auth metadata.
   * Note: This does NOT clear the HttpOnly cookie — that requires
   * a server call to /api/logout which responds with an expired Set-Cookie.
   * @returns {boolean} True if cleared successfully
   */
  clearAuthSession() {
    try {
      sessionStorage.removeItem(this.storageKey);
      return true;
    } catch (error) {
      console.warn('Failed to clear auth metadata:', error);
      return false;
    }
  }

  /**
   * Get session age in milliseconds
   * @returns {number|null} Age in milliseconds or null if no session
   */
  getSessionAge() {
    try {
      const stored = sessionStorage.getItem(this.storageKey);
      if (!stored) return null;

      const parsed = JSON.parse(stored);
      if (!parsed || !parsed.timestamp) return null;

      return Date.now() - parsed.timestamp;
    } catch {
      return null;
    }
  }

  /**
   * Check if session is older than specified age
   * @param {number} maxAge - Maximum age in milliseconds
   * @returns {boolean} True if session is too old
   */
  isSessionExpired(maxAge) {
    const age = this.getSessionAge();
    return age !== null && age > maxAge;
  }

  // ── Legacy API shims (for backward-compatible call sites) ──

  /**
   * @deprecated Use markAuthenticated(). Kept for backward compatibility.
   * @param {string} _token - Ignored; cookie is set by server
   * @returns {boolean}
   */
  storeToken(_token) {
    return this.markAuthenticated();
  }

  /**
   * @deprecated Cookie is HttpOnly; JS cannot read the token value.
   * Returns a truthy placeholder when authenticated so existing
   * null-checks (e.g. `if (token)`) still work.
   * @returns {string|null}
   */
  getStoredToken() {
    return this.hasAuthSession() ? '__httponly__' : null;
  }

  /** @deprecated Use clearAuthSession() */
  clearStoredToken() {
    return this.clearAuthSession();
  }

  /** @deprecated Use hasAuthSession() */
  hasStoredToken() {
    return this.hasAuthSession();
  }

  /** @deprecated Use getSessionAge() */
  getTokenAge() {
    return this.getSessionAge();
  }

  /** @deprecated Use isSessionExpired() */
  isTokenExpired(maxAge) {
    return this.isSessionExpired(maxAge);
  }
}

// Export singleton instance
export default new TokenManager();