import HttpRequestAgent from '../utils/HttpRequestAgent.js';
import { API_CONFIG } from '../config/apiConfig.js';

const agent = HttpRequestAgent;

/**
 * TlsService — wraps /api/system/tls* endpoints.
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
};

export default TlsService;
