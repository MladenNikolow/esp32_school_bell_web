// src/services/LogsService.js
import httpRequestAgent from '../utils/HttpRequestAgent.js';
import { API_CONFIG, getApiUrl } from '../config/apiConfig.js';

const LogsService = {
  async getLogs() {
    return httpRequestAgent.get(API_CONFIG.ENDPOINTS.SYSTEM_LOGS);
  },

  async clearLogs() {
    return httpRequestAgent.delete(API_CONFIG.ENDPOINTS.SYSTEM_LOGS);
  },

  /**
   * Download the full log file as an attachment (service session cookie).
   */
  async downloadLogs() {
    const response = await fetch(getApiUrl(API_CONFIG.ENDPOINTS.SYSTEM_LOGS_DOWNLOAD), {
      method: 'GET',
      credentials: 'same-origin',
      cache: 'no-cache',
      headers: {
        Accept: 'text/plain',
        'X-Requested-With': 'XMLHttpRequest',
      },
    });
    if (!response.ok) {
      let message = `Download failed (${response.status})`;
      try {
        const data = await response.json();
        if (data?.error) message = data.error;
      } catch (_) {
        /* ignore non-JSON error bodies */
      }
      throw new Error(message);
    }
    const blob = await response.blob();
    const url = URL.createObjectURL(blob);
    try {
      const a = document.createElement('a');
      a.href = url;
      a.download = 'ringy-logs.txt';
      document.body.appendChild(a);
      a.click();
      a.remove();
    } finally {
      URL.revokeObjectURL(url);
    }
  },
};

export default LogsService;
