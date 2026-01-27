// src/utils/__tests__/integration.test.js
// Basic integration test for token management and HTTP client

import TokenManager from '../TokenManager.js';
import HttpRequestAgent from '../HttpRequestAgent.js';

describe('Token Management Integration', () => {
  beforeEach(() => {
    // Clear localStorage before each test
    localStorage.clear();
  });

  test('TokenManager stores and retrieves tokens correctly', () => {
    const testToken = 'test-jwt-token-123';
    
    // Store token
    const stored = TokenManager.storeToken(testToken);
    expect(stored).toBe(true);
    
    // Retrieve token
    const retrieved = TokenManager.getStoredToken();
    expect(retrieved).toBe(testToken);
    
    // Check if token exists
    expect(TokenManager.hasStoredToken()).toBe(true);
  });

  test('TokenManager handles invalid data gracefully', () => {
    // Store invalid data directly in localStorage
    localStorage.setItem('esp32_auth_token', 'invalid-json');
    
    // Should return null and clear corrupted data
    const token = TokenManager.getStoredToken();
    expect(token).toBe(null);
    expect(localStorage.getItem('esp32_auth_token')).toBe(null);
  });

  test('TokenManager calculates token age correctly', () => {
    const testToken = 'test-token';
    TokenManager.storeToken(testToken);
    
    const age = TokenManager.getTokenAge();
    expect(age).toBeGreaterThanOrEqual(0);
    expect(age).toBeLessThan(1000); // Should be very recent
  });

  test('HttpRequestAgent integrates with TokenManager', () => {
    const testToken = 'test-integration-token';
    TokenManager.storeToken(testToken);
    
    // Verify HttpRequestAgent can access the token
    expect(HttpRequestAgent.isAuthenticated()).toBe(true);
    expect(HttpRequestAgent.getToken()).toBe(testToken);
    
    // Clear auth
    HttpRequestAgent.clearAuth();
    expect(HttpRequestAgent.isAuthenticated()).toBe(false);
    expect(HttpRequestAgent.getToken()).toBe(null);
  });

  test('Token expiration detection works', () => {
    const testToken = 'expired-token';
    
    // Manually create expired token data
    const expiredData = {
      token: testToken,
      timestamp: Date.now() - (25 * 60 * 60 * 1000) // 25 hours ago
    };
    
    localStorage.setItem('esp32_auth_token', JSON.stringify(expiredData));
    
    // Check if token is expired (24 hour limit)
    const maxAge = 24 * 60 * 60 * 1000;
    expect(TokenManager.isTokenExpired(maxAge)).toBe(true);
  });
});

describe('HTTP Client Integration', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  test('HttpRequestAgent creates abort controllers', () => {
    const controller = HttpRequestAgent.createAbortController();
    expect(controller).toBeInstanceOf(AbortController);
    expect(controller.signal).toBeDefined();
  });

  test('Authentication state management', () => {
    // Initially not authenticated
    expect(HttpRequestAgent.isAuthenticated()).toBe(false);
    
    // Store a token
    TokenManager.storeToken('test-token');
    expect(HttpRequestAgent.isAuthenticated()).toBe(true);
    
    // Clear authentication
    HttpRequestAgent.clearAuth();
    expect(HttpRequestAgent.isAuthenticated()).toBe(false);
  });
});