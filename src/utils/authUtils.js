// src/utils/authUtils.js
import TokenManager from './TokenManager.js';

/**
 * Authentication utilities for handling auth state and navigation
 */
export class AuthUtils {
  /**
   * Check if current route requires authentication
   * @param {string} pathname - Current pathname
   * @returns {boolean} True if auth required
   */
  static requiresAuth(pathname) {
    const publicRoutes = ['/login', '/'];
    return !publicRoutes.includes(pathname);
  }

  /**
   * Get redirect path based on authentication state
   * @param {boolean} isAuthenticated - Current auth state
   * @param {string} currentPath - Current pathname
   * @returns {string|null} Redirect path or null if no redirect needed
   */
  static getRedirectPath(isAuthenticated, currentPath) {
    if (isAuthenticated && currentPath === '/login') {
      return '/home';
    }
    
    if (!isAuthenticated && this.requiresAuth(currentPath)) {
      return '/login';
    }
    
    return null;
  }

  /**
   * Handle authentication state change
   * @param {boolean} isAuthenticated - New auth state
   * @param {Function} navigate - Navigation function
   * @param {string} currentPath - Current pathname
   */
  static handleAuthStateChange(isAuthenticated, navigate, currentPath) {
    const redirectPath = this.getRedirectPath(isAuthenticated, currentPath);
    
    if (redirectPath) {
      navigate(redirectPath);
    }
  }

  /**
   * Initialize authentication on app startup
   * @param {Function} dispatch - Redux dispatch function
   * @param {Function} initializeAuth - Auth initialization action
   * @returns {Promise<void>}
   */
  static async initializeAppAuth(dispatch, initializeAuth) {
    try {
      await dispatch(initializeAuth()).unwrap();
    } catch (error) {
      console.warn('Auth initialization failed:', error);
      // Clear any corrupted auth state
      TokenManager.clearStoredToken();
    }
  }

  /**
   * Handle logout with cleanup
   * @param {Function} dispatch - Redux dispatch function
   * @param {Function} logoutUser - Logout action
   * @param {Function} navigate - Navigation function
   * @returns {Promise<void>}
   */
  static async handleLogout(dispatch, logoutUser, navigate) {
    try {
      await dispatch(logoutUser()).unwrap();
    } catch (error) {
      console.warn('Logout failed:', error);
      // Force clear local state even if server logout fails
      TokenManager.clearStoredToken();
    } finally {
      navigate('/login');
    }
  }

  /**
   * Handle login success
   * @param {Function} navigate - Navigation function
   * @param {string} [redirectTo] - Optional redirect path
   */
  static handleLoginSuccess(navigate, redirectTo = '/home') {
    navigate(redirectTo);
  }

  /**
   * Create auth error handler
   * @param {Function} dispatch - Redux dispatch function
   * @param {Function} clearAuthToken - Clear auth action
   * @param {Function} navigate - Navigation function
   * @returns {Function} Error handler function
   */
  static createAuthErrorHandler(dispatch, clearAuthToken, navigate) {
    return (error) => {
      if (error.message.includes('Authentication failed') || 
          error.message.includes('401') || 
          error.message.includes('403')) {
        dispatch(clearAuthToken());
        navigate('/login');
      }
    };
  }

  /**
   * Validate token format (basic validation)
   * @param {string} token - Token to validate
   * @returns {boolean} True if token format is valid
   */
  static isValidTokenFormat(token) {
    if (!token || typeof token !== 'string') {
      return false;
    }
    
    // Basic JWT format check (3 parts separated by dots)
    const parts = token.split('.');
    return parts.length === 3;
  }

  /**
   * Get user-friendly error message
   * @param {Error} error - Error object
   * @returns {string} User-friendly error message
   */
  static getAuthErrorMessage(error) {
    const message = error.message || 'An error occurred';
    
    if (message.includes('401') || message.includes('Authentication failed')) {
      return 'Invalid username or password';
    }
    
    if (message.includes('403')) {
      return 'Access denied';
    }
    
    if (message.includes('Network') || message.includes('fetch')) {
      return 'Unable to connect to server';
    }
    
    return 'Login failed. Please try again.';
  }
}

export default AuthUtils;