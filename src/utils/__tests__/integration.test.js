// src/utils/__tests__/integration.test.js
// Basic integration test for session management and HTTP client

import TokenManager from '../TokenManager.js';
import HttpRequestAgent from '../HttpRequestAgent.js';

describe('Session Management Integration', () => {
  beforeEach(() => {
    // Clear sessionStorage before each test
    sessionStorage.clear();
  });

  test('TokenManager tracks auth session correctly', () => {
    // Mark authenticated
    const marked = TokenManager.markAuthenticated();
    expect(marked).toBe(true);
    
    // Check session exists
    expect(TokenManager.hasAuthSession()).toBe(true);
    
    // Legacy shim returns a truthy placeholder
    expect(TokenManager.getStoredToken()).toBe('__httponly__');
  });

  test('TokenManager handles invalid data gracefully', () => {
    // Store invalid data directly in sessionStorage
    sessionStorage.setItem('esp32_auth_meta', 'invalid-json');
    
    // Should return false and clear corrupted data
    expect(TokenManager.hasAuthSession()).toBe(false);
    expect(sessionStorage.getItem('esp32_auth_meta')).toBe(null);
  });

  test('TokenManager calculates session age correctly', () => {
    TokenManager.markAuthenticated();
    
    const age = TokenManager.getSessionAge();
    expect(age).toBeGreaterThanOrEqual(0);
    expect(age).toBeLessThan(1000); // Should be very recent
  });

  test('HttpRequestAgent integrates with TokenManager', () => {
    TokenManager.markAuthenticated();
    
    // Verify HttpRequestAgent can check auth state
    expect(HttpRequestAgent.isAuthenticated()).toBe(true);
    
    // Clear auth
    HttpRequestAgent.clearAuth();
    expect(HttpRequestAgent.isAuthenticated()).toBe(false);
  });

  test('Session expiration detection works', () => {
    // Manually create expired session metadata
    const expiredMeta = {
      authenticated: true,
      timestamp: Date.now() - (25 * 60 * 60 * 1000) // 25 hours ago
    };
    
    sessionStorage.setItem('esp32_auth_meta', JSON.stringify(expiredMeta));
    
    // Check if session is expired (24 hour limit)
    const maxAge = 24 * 60 * 60 * 1000;
    expect(TokenManager.isSessionExpired(maxAge)).toBe(true);
  });
});

describe('HTTP Client Integration', () => {
  beforeEach(() => {
    sessionStorage.clear();
  });

  test('HttpRequestAgent creates abort controllers', () => {
    const controller = HttpRequestAgent.createAbortController();
    expect(controller).toBeInstanceOf(AbortController);
    expect(controller.signal).toBeDefined();
  });

  test('Authentication state management', () => {
    // Initially not authenticated
    expect(HttpRequestAgent.isAuthenticated()).toBe(false);
    
    // Mark as authenticated
    TokenManager.markAuthenticated();
    expect(HttpRequestAgent.isAuthenticated()).toBe(true);
    
    // Clear authentication
    HttpRequestAgent.clearAuth();
    expect(HttpRequestAgent.isAuthenticated()).toBe(false);
  });
});