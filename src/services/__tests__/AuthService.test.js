// src/services/__tests__/AuthService.test.js
// Integration tests for AuthService with HttpOnly cookie-based auth

import AuthService from '../AuthService.js';
import TokenManager from '../../utils/TokenManager.js';
import { API_CONFIG } from '../../config/apiConfig.js';

// Mock fetch for testing
global.fetch = jest.fn();

describe('AuthService Integration', () => {
  beforeEach(() => {
    // Clear sessionStorage and reset mocks
    sessionStorage.clear();
    fetch.mockClear();
    TokenManager.clearAuthSession();
  });

  describe('login', () => {
    test('successful login marks session and returns user data', async () => {
      const mockCredentials = { username: 'testuser', password: 'testpass' };
      const mockResponse = {
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
          credentials: 'same-origin',
        })
      );

      // Verify session is marked as authenticated
      expect(TokenManager.hasAuthSession()).toBe(true);
      
      // Verify return data
      expect(result.user).toEqual(mockResponse.user);
      expect(result.message).toBe(mockResponse.message);
    });

    test('login failure clears any auth session', async () => {
      // Pre-mark as authenticated
      TokenManager.markAuthenticated();
      
      const mockCredentials = { username: 'baduser', password: 'badpass' };

      fetch.mockResolvedValueOnce({
        ok: false,
        status: 401,
        json: async () => ({ message: 'Invalid credentials' }),
      });

      await expect(AuthService.login(mockCredentials)).rejects.toThrow();
      
      // Verify session was cleared
      expect(TokenManager.hasAuthSession()).toBe(false);
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
    test('logout clears session and notifies server', async () => {
      // Setup: mark as authenticated
      TokenManager.markAuthenticated();

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
          credentials: 'same-origin',
        })
      );

      // Verify session cleared
      expect(TokenManager.hasAuthSession()).toBe(false);
    });

    test('logout clears session even if server call fails', async () => {
      // Setup: mark as authenticated
      TokenManager.markAuthenticated();

      fetch.mockRejectedValueOnce(new Error('Network error'));

      await AuthService.logout();

      // Verify session still cleared despite server error
      expect(TokenManager.hasAuthSession()).toBe(false);
    });
  });

  describe('validateStoredToken', () => {
    test('validates session with server successfully', async () => {
      const mockUser = { username: 'testuser', role: 'user' };
      
      TokenManager.markAuthenticated();

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
          credentials: 'same-origin',
        })
      );
    });

    test('handles invalid session by clearing metadata', async () => {
      TokenManager.markAuthenticated();

      fetch.mockResolvedValueOnce({
        ok: false,
        status: 401,
      });

      const result = await AuthService.validateStoredToken();

      expect(result).toEqual({ valid: false });
      expect(TokenManager.hasAuthSession()).toBe(false);
    });

    test('returns invalid when no session exists', async () => {
      const result = await AuthService.validateStoredToken();

      expect(result).toEqual({ valid: false });
      expect(fetch).not.toHaveBeenCalled();
    });
  });

  describe('authentication state management', () => {
    test('isAuthenticated reflects session presence', () => {
      expect(AuthService.isAuthenticated()).toBe(false);

      TokenManager.markAuthenticated();
      expect(AuthService.isAuthenticated()).toBe(true);

      AuthService.clearAuthSession();
      expect(AuthService.isAuthenticated()).toBe(false);
    });

    test('session expiration detection works', () => {
      // Create expired session metadata manually
      const expiredMeta = {
        authenticated: true,
        timestamp: Date.now() - (25 * 60 * 60 * 1000) // 25 hours ago
      };
      
      sessionStorage.setItem('esp32_auth_meta', JSON.stringify(expiredMeta));

      const maxAge = 24 * 60 * 60 * 1000; // 24 hours
      expect(AuthService.isSessionExpired(maxAge)).toBe(true);
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