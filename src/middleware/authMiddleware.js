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
 * Session validation middleware - checks client-side session age.
 * The actual token lifetime is managed by the server via the HttpOnly cookie,
 * but this provides an additional client-side safety net.
 */
export const tokenValidationMiddleware = (store) => (next) => (action) => {
  const result = next(action);
  
  // Check session age on certain actions
  const actionsToCheck = [
    'auth/loginUser/fulfilled',
    'auth/initializeAuth/fulfilled'
  ];
  
  if (actionsToCheck.includes(action.type)) {
    // Check if client-side session metadata is too old (1 hour)
    const maxAge = 1 * 60 * 60 * 1000; // 1 hour in milliseconds
    
    if (TokenManager.isSessionExpired(maxAge)) {
      console.warn('Session metadata is expired, clearing auth state');
      store.dispatch(clearAuthToken());
    }
  }
  
  return result;
};