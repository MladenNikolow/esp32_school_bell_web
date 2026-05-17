import HttpRequestAgent from '../utils/HttpRequestAgent.js';
import { API_CONFIG } from '../config/apiConfig.js';

const agent = HttpRequestAgent;

/**
 * Service for the /api/diagnostics endpoints.
 * Response shape of GET /api/diagnostics:
 *   {
 *     health:    { critical, degraded, timeSyncFresh, timeReliable,
 *                  wifiConnected, bellHardwarePresent, panicMode,
 *                  uptimeSec, bootId, resetReason, eventCount,
 *                  lastBellAttemptTime, lastBellAttemptResult,
 *                  consecutiveBellFailures, lastSeenTime },
 *     events:    [ { boot, ts, up, code, sev, ctx, det?, codeName, sevName }, ... ],
 *     bootId:    number,
 *     uptimeSec: number,
 *   }
 *
 * POST /api/diagnostics/clear  → { ok: true } (service role only; 403 otherwise)
 */
const DiagnosticsService = {
  get: (signal) =>
    agent.get(API_CONFIG.ENDPOINTS.DIAGNOSTICS, signal),

  clear: (signal) =>
    agent.post(API_CONFIG.ENDPOINTS.DIAGNOSTICS_CLEAR, {}, signal),
};

export default DiagnosticsService;
