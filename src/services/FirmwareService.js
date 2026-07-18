// src/services/FirmwareService.js
//
// Client for the OTA firmware-update REST API. Uses raw fetch (not
// httpRequestAgent) for the binary upload so we can stream the bundle as
// application/octet-stream and report upload progress through XHR.
import httpRequestAgent from '../utils/HttpRequestAgent.js';
import HttpDiagnostics from '../utils/HttpDiagnostics.js';
import RequestScheduler from '../utils/RequestScheduler.js';
import { API_CONFIG } from '../config/apiConfig.js';

const FirmwareService = {
  /**
   * Fetch firmware/partition info (version, running slot, rollback flag, …).
   */
  async getFirmwareInfo() {
    return httpRequestAgent.get(API_CONFIG.ENDPOINTS.SYSTEM_FIRMWARE);
  },

  /**
   * Snapshot of the current update session (state/progress/last_error).
   */
  async getUpdateStatus() {
    return httpRequestAgent.get(API_CONFIG.ENDPOINTS.SYSTEM_UPDATE_STATUS);
  },

  /**
   * Abort an in-progress upload.
   */
  async abortUpdate() {
    return httpRequestAgent.post(API_CONFIG.ENDPOINTS.SYSTEM_UPDATE_ABORT, {});
  },

  /**
   * Manual A/B rollback to the previous slot. Triggers a reboot on success.
   */
  async rollback() {
    return httpRequestAgent.post(API_CONFIG.ENDPOINTS.SYSTEM_ROLLBACK, {});
  },

  /**
   * Stream an .sbu bundle to the device.
   *
   * @param {File|Blob|ArrayBuffer} file
   * @param {(progress: { loaded: number, total: number, percent: number }) => void} [onProgress]
   * @returns {Promise<{ success: boolean, reboot_in_ms: number }>}
   */
  uploadBundle(file, onProgress) {
    return RequestScheduler.schedule(() => new Promise((resolve, reject) => {
      const diagnostic = HttpDiagnostics.start(
        'POST',
        API_CONFIG.ENDPOINTS.SYSTEM_UPDATE,
      );
      let finished = false;
      const finish = () => {
        if (!finished) {
          finished = true;
          HttpDiagnostics.finish(diagnostic);
        }
      };
      const xhr = new XMLHttpRequest();
      xhr.open('POST', API_CONFIG.ENDPOINTS.SYSTEM_UPDATE, true);
      xhr.setRequestHeader('Content-Type', 'application/octet-stream');
      xhr.setRequestHeader('X-Requested-With', 'XMLHttpRequest');
      xhr.withCredentials = true; /* send the session cookie */
      xhr.timeout = 10 * 60 * 1000; /* 10 minutes — bundles are several MB */

      if (onProgress && xhr.upload) {
        xhr.upload.addEventListener('progress', (e) => {
          if (!e.lengthComputable) return;
          onProgress({
            loaded: e.loaded,
            total: e.total,
            percent: Math.floor((e.loaded * 100) / e.total),
          });
        });
      }

      xhr.onload = () => {
        HttpDiagnostics.response(diagnostic, {
          status: xhr.status,
          ok: xhr.status >= 200 && xhr.status < 300,
        });
        let body = null;
        try { body = JSON.parse(xhr.responseText); } catch (_) { /* ignore */ }
        if (xhr.status >= 200 && xhr.status < 300) {
          resolve(body || { success: true });
        } else {
          const error = new Error(
            (body && body.error) || `Upload failed (HTTP ${xhr.status})`,
          );
          HttpDiagnostics.error(diagnostic, error);
          reject(error);
        }
        finish();
      };
      xhr.onerror = () => {
        const error = new TypeError('Network error during upload');
        HttpDiagnostics.error(diagnostic, error);
        finish();
        reject(error);
      };
      xhr.ontimeout = () => {
        const error = new Error('Upload timed out');
        HttpDiagnostics.error(diagnostic, error);
        finish();
        reject(error);
      };
      xhr.onabort = () => {
        const error = new DOMException('Upload aborted', 'AbortError');
        HttpDiagnostics.error(diagnostic, error);
        finish();
        reject(error);
      };

      xhr.send(file);
    }), { priority: 'critical', exclusive: true });
  },
};

export default FirmwareService;
