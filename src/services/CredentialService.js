// src/services/CredentialService.js
import httpRequestAgent from '../utils/HttpRequestAgent.js';
import httpClient from '../utils/HttpClient.js';
import { API_CONFIG } from '../config/apiConfig.js';

const CredentialService = {
  /**
   * Get client account info (service role only).
   * @returns {{ clientExists: boolean, clientUsername: string }}
   */
  async getCredentials() {
    return httpRequestAgent.get(API_CONFIG.ENDPOINTS.SYSTEM_CREDENTIALS);
  },

  /**
   * Create or update the client account (service role only).
   * @param {string} username
   * @param {string} password
   */
  async saveCredentials(username, password) {
    return httpRequestAgent.post(API_CONFIG.ENDPOINTS.SYSTEM_CREDENTIALS, { username, password });
  },

  /**
   * Delete the client account (service role only).
   */
  async deleteCredentials() {
    const response = await httpClient.delete(API_CONFIG.ENDPOINTS.SYSTEM_CREDENTIALS);
    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      throw new Error(data.error || `Delete failed (${response.status})`);
    }
    return response.json();
  },
};

export default CredentialService;
