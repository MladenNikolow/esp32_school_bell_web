// src/services/__tests__/AuthService.test.js
// Integration tests for AuthService and API integration

import AuthService from '../AuthService.js';
import TokenManager from '../../utils/TokenManager.js';
import { API_CONFIG } from '../../config/apiConfig.js';

// Mock fetch for testing
global.fetch = jest.fn();

describe('AuthService Integration', () => {
  beforeEach(() => {
    // Clear localStorage and reset mocks
    localStorage.clear();
    fetch.mockClear();
    TokenManager.clearStoredToken();
  });

  describe('login', () => {
    test('successful login stores token and returns user data', async () => {
      const mockCredentials = { username: 'testuser', password: 'testpass' };
      const mockResponse = {
        token: 'mock-jwt-token',
        user: { username: 'testuser', role: 'user' },
        message: 'Login successful'
      };

      fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      });

      const result = await AuthService.login(mockCredentials);

      // Verify API call
      expect(fetch).toHaveBeenCalledWith(
        API_CONFIG.ENDPOINTS.LOGIN,
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify(mockCredentials),
        })
      );

      // Verify token storage
      expect(TokenManager.getStoredToken()).toBe(mockResponse.token);
      
      // Verify return data
      expect(result).toEqual(mockResponse);
    });

    test('login failure clears any stored tokens', async () => {
      // Pre-store a token
      TokenManager.storeToken('old-token');
      
      const mockCredentials = { username: 'baduser', password: 'badpass' };

      fetch.mockResolvedValueOnce({
        ok: false,
        status: 401,
        json: async () => ({ message: 'Invalid credentials' }),
      });

      await expect(AuthService.login(mockCredentials)).rejects.toThrow();
      
      // Verify token was cleared
      expect(TokenManager.getStoredToken()).toBe(null);
    });

    test('validates credentials before sending request', async () => {
      const invalidCredentials = [
        null,
        {},
        { username: '', password: 'test' },
        { username: 'test', password: '' },
        { username: 'test' }, // missing password
        { password: 'test' }, // missing username
      ];

      for (const creds of invalidCredentials) {
        await expect(AuthService.login(creds)).rejects.toThrow(/Invalid credentials/);
      }

      // Verify no API calls were made
      expect(fetch).not.toHaveBeenCalled();
    });
  });

  describe('logout', () => {
    test('logout clears token and notifies server', async () => {
      // Setup: store a token
      const testToken = 'test-logout-token';
      TokenManager.storeToken(testToken);

      fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true }),
      });

      await AuthService.logout();

      // Verify server notification
      expect(fetch).toHaveBeenCalledWith(
        API_CONFIG.ENDPOINTS.LOGOUT,
        expect.objectContaining({
          method: 'POST',
        })
      );

      // Verify token cleared
      expect(TokenManager.getStoredToken()).toBe(null);
    });

    test('logout clears token even if server call fails', async () => {
      // Setup: store a token
      TokenManager.storeToken('test-token');

      fetch.mockRejectedValueOnce(new Error('Network error'));

      await AuthService.logout();

      // Verify token still cleared despite server error
      expect(TokenManager.getStoredToken()).toBe(null);
    });
  });

  describe('validateStoredToken', () => {
    test('validates token with server successfully', async () => {
      const testToken = 'valid-token';
      const mockUser = { username: 'testuser', role: 'user' };
      
      TokenManager.storeToken(testToken);

      fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ user: mockUser }),
      });

      const result = await AuthService.validateStoredToken();

      expect(result).toEqual({ valid: true, user: mockUser });
      expect(fetch).toHaveBeenCalledWith(
        API_CONFIG.ENDPOINTS.VALIDATE_TOKEN,
        expect.objectContaining({
          method: 'GET',
        })
      );
    });

    test('handles invalid token by clearing storage', async () => {
      TokenManager.storeToken('invalid-token');

      fetch.mockResolvedValueOnce({
        ok: false,
        status: 401,
      });

      const result = await AuthService.validateStoredToken();

      expect(result).toEqual({ valid: false });
      expect(TokenManager.getStoredToken()).toBe(null);
    });

    test('returns invalid when no token stored', async () => {
      const result = await AuthService.validateStoredToken();

      expect(result).toEqual({ valid: false });
      expect(fetch).not.toHaveBeenCalled();
    });
  });

  describe('authentication state management', () => {
    test('isAuthenticated reflects token presence', () => {
      expect(AuthService.isAuthenticated()).toBe(false);

      TokenManager.storeToken('test-token');
      expect(AuthService.isAuthenticated()).toBe(true);

      AuthService.clearStoredToken();
      expect(AuthService.isAuthenticated()).toBe(false);
    });

    test('token expiration detection works', () => {
      // Create expired token data manually
      const expiredData = {
        token: 'expired-token',
        timestamp: Date.now() - (25 * 60 * 60 * 1000) // 25 hours ago
      };
      
      localStorage.setItem('esp32_auth_token', JSON.stringify(expiredData));

      const maxAge = 24 * 60 * 60 * 1000; // 24 hours
      expect(AuthService.isTokenExpired(maxAge)).toBe(true);
    });

    test('getAuthHeaders returns correct format', () => {
      // No token
      expect(AuthService.getAuthHeaders()).toEqual({});

      // With token
      const testToken = 'test-auth-header-token';
      TokenManager.storeToken(testToken);
      
      expect(AuthService.getAuthHeaders()).toEqual({
        Authorization: `Bearer ${testToken}`
      });
    });
  });

  describe('error handling integration', () => {
    test('network errors are handled gracefully', async () => {
      const mockCredentials = { username: 'test', password: 'test' };

      fetch.mockRejectedValueOnce(new TypeError('Failed to fetch'));

      await expect(AuthService.login(mockCredentials)).rejects.toThrow(/Unable to connect/);
    });

    test('server errors provide user-friendly messages', async () => {
      const mockCredentials = { username: 'test', password: 'test' };

      fetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
        json: async () => ({ message: 'Internal server error' }),
      });

      await expect(AuthService.login(mockCredentials)).rejects.toThrow();
    });
  });
});