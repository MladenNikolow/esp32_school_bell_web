// src/middleware/authMiddleware.js
import { clearAuthToken } from '../features/Auth/AuthSlice.js';
import TokenManager from '../utils/TokenManager.js';

/**
 * Redux middleware for handling authentication events
 */
export const authMiddleware = (store) => (next) => (action) => {
  const result = next(action);
  
  // Listen for auth error events from HTTP client
  if (typeof window !== 'undefined') {
    // Set up auth error listener if not already set
    if (!window.__authErrorListenerSet) {
      window.addEventListener('auth-error', (event) => {
        const { status } = event.detail;
        
        // Clear auth state on 401/403 errors
        if (status === 401 || status === 403) {
          store.dispatch(clearAuthToken());
        }
      });
      
      window.__authErrorListenerSet = true;
    }
  }
  
  return result;
};

/**
 * Token validation middleware - checks token expiration
 */
export const tokenValidationMiddleware = (store) => (next) => (action) => {
  const result = next(action);
  
  // Check token age on certain actions
  const actionsToCheck = [
    'auth/loginUser/fulfilled',
    'auth/initializeAuth/fulfilled'
  ];
  
  if (actionsToCheck.includes(action.type)) {
    // Check if token is too old (24 hours)
    const maxAge = 24 * 60 * 60 * 1000; // 24 hours in milliseconds
    
    if (TokenManager.isTokenExpired(maxAge)) {
      console.warn('Token is expired, clearing auth state');
      store.dispatch(clearAuthToken());
    }
  }
  
  return result;
};