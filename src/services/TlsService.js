import HttpRequestAgent from '../utils/HttpRequestAgent.js';
import HttpClient from '../utils/HttpClient.js';
import { API_CONFIG, getApiUrl } from '../config/apiConfig.js';

const agent = HttpRequestAgent;

/**
 * TlsService -wraps /api/system/tls* endpoints.
 *
 * GET  /api/system/tls              → { enabled, source, port, subject_cn,
 *                                       fingerprint_sha256, not_before, not_after,
 *                                       days_remaining, tamper_suspected,
 *                                       mode_active, mode_setting, cert_present }
 * POST /api/system/tls/regenerate  → 202 { status, message }
 * PUT  /api/system/tls/mode        → 202 { status, mode, message }
 * POST /api/system/tls/certificate → 200 { status, message }
 */
const TlsService = {
  getStatus: (signal) =>
    agent.get(API_CONFIG.ENDPOINTS.SYSTEM_TLS, signal),

  regenerate: (signal) =>
    agent.post(API_CONFIG.ENDPOINTS.SYSTEM_TLS_REGENERATE, {}, signal),

  setMode: (mode, signal) =>
    agent.put(API_CONFIG.ENDPOINTS.SYSTEM_TLS_MODE, { mode }, signal),

  uploadCertificate: (certPem, keyPem, signal) =>
    agent.post(API_CONFIG.ENDPOINTS.SYSTEM_TLS_CERTIFICATE, { cert_pem: certPem, key_pem: keyPem }, signal),

  /**
   * Download the PUBLIC server certificate (.crt) and trigger a browser
   * download. Uses the HttpOnly session cookie for auth (credentials:include).
   */
  downloadCertificate: async () => {
    const endpoint = getApiUrl(API_CONFIG.ENDPOINTS.SYSTEM_TLS_DOWNLOAD);
    try {
      const res = await HttpClient.get(endpoint, {
        headers: { 'X-Requested-With': 'XMLHttpRequest' },
        priority: 'critical',
      });
      if (!res.ok) throw new Error('Failed to download certificate');
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'ringy-cert.crt';
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (error) { throw error; }
  },
};

export default TlsService;
