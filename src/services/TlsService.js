import HttpRequestAgent from '../utils/HttpRequestAgent.js';
import { API_CONFIG } from '../config/apiConfig.js';

const agent = HttpRequestAgent;

/**
 * TlsService — wraps /api/system/tls* endpoints.
 *
 * GET  /api/system/tls           → { enabled, source, port, subject_cn,
 *                                    fingerprint_sha256, not_before, not_after,
 *                                    days_remaining, tamper_suspected }
 * POST /api/system/tls/regenerate → 202 { status, message }
 */
const TlsService = {
  getStatus: (signal) =>
    agent.get(API_CONFIG.ENDPOINTS.SYSTEM_TLS, signal),

  regenerate: (signal) =>
    agent.post(API_CONFIG.ENDPOINTS.SYSTEM_TLS_REGENERATE, {}, signal),
};

export default TlsService;
