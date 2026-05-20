/**
 * TlsSettingsPanel.jsx
 *
 * Displays TLS certificate status and allows service-role admins to
 * regenerate the self-signed certificate.
 */
import React, { useEffect, useState, useCallback } from 'react';
import { useSelector } from 'react-redux';
import TlsService from '../../services/TlsService.js';
import useLocale from '../../hooks/useLocale.jsx';

/** Format a fingerprint string: keep first 8 chars + "..." + last 8 chars */
function truncateFp(fp) {
  if (!fp || fp.length <= 20) return fp || '—';
  return fp.slice(0, 8) + '...' + fp.slice(-8);
}

/** Color class for days remaining */
function daysColor(days) {
  if (days == null) return '';
  if (days < 30) return 'text-danger';
  if (days < 90) return 'text-warn';
  return 'text-ok';
}

export default function TlsSettingsPanel() {
  const { t } = useLocale();
  const user = useSelector((s) => s.auth.user);
  const isService = user?.role === 'service';

  const [status, setStatus] = useState(null);
  const [loading, setLoading] = useState(false);
  const [regenerating, setRegenerating] = useState(false);
  const [error, setError] = useState(null);
  const [toast, setToast] = useState(null);

  const loadStatus = useCallback(async (signal) => {
    setLoading(true);
    setError(null);
    try {
      const data = await TlsService.getStatus(signal);
      setStatus(data);
    } catch (e) {
      if (e.name !== 'AbortError') setError(e.message || 'Failed to load TLS status');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const ctrl = new AbortController();
    loadStatus(ctrl.signal);
    return () => ctrl.abort();
  }, [loadStatus]);

  /* Reload on window focus so status stays fresh after a tab switch */
  useEffect(() => {
    const onFocus = () => {
      const ctrl = new AbortController();
      loadStatus(ctrl.signal);
      return () => ctrl.abort();
    };
    window.addEventListener('focus', onFocus);
    return () => window.removeEventListener('focus', onFocus);
  }, [loadStatus]);

  const handleRegenerate = async () => {
    if (!window.confirm(
      'Regenerate the TLS certificate? The server will restart and you will need to accept the new certificate in your browser.'
    )) return;

    setRegenerating(true);
    setError(null);
    try {
      await TlsService.regenerate();
      setToast('Certificate regenerated. Reconnecting in 3 seconds…');
      setTimeout(() => {
        window.location.href = window.location.href.replace(/^https?:/, 'https:');
      }, 3000);
    } catch (e) {
      setError(e.message || 'Regeneration failed');
    } finally {
      setRegenerating(false);
    }
  };

  /* Formatted date for not_after */
  function formatDate(iso) {
    if (!iso) return '—';
    try {
      return new Date(iso).toLocaleDateString(undefined, {
        year: 'numeric', month: 'long', day: 'numeric',
      });
    } catch {
      return iso;
    }
  }

  return (
    <div className="sched-card">
      <h3>Security — TLS Certificate</h3>
      <p className="card-desc">
        The device uses a self-signed ECDSA P-256 certificate for HTTPS.
        Physical access to the device gives access to the TLS private key;
        treat the physical security of the enclosure as part of the security model.
      </p>

      {error && (
        <div className="error-message" style={{ marginBottom: 8 }}>
          {error}
          <button className="error-dismiss" onClick={() => setError(null)}>×</button>
        </div>
      )}

      {toast && (
        <div className="success-message" style={{ marginBottom: 8 }}>{toast}</div>
      )}

      {/* Tamper warning */}
      {status?.tamper_suspected && (
        <div className="error-message" style={{ marginBottom: 12 }}>
          ⚠ Certificate changed unexpectedly — verify device physical security and regenerate.
        </div>
      )}

      {loading && !status && <p>Loading…</p>}

      {status && (
        <div className="info-grid">
          <div className="info-item">
            <span className="info-label">Status</span>
            <span className="info-value">
              <span className="badge" style={{ background: status.enabled ? '#3a8a3a' : '#888' }}>
                {status.enabled ? 'HTTPS Active' : 'Disabled'}
              </span>
            </span>
          </div>
          <div className="info-item">
            <span className="info-label">Source</span>
            <span className="info-value" style={{ textTransform: 'capitalize' }}>{status.source || '—'}</span>
          </div>
          <div className="info-item">
            <span className="info-label">Port</span>
            <span className="info-value">{status.port || '—'}</span>
          </div>
          <div className="info-item">
            <span className="info-label">Subject CN</span>
            <span className="info-value" style={{ fontFamily: 'monospace', fontSize: '0.85em' }}>
              {status.subject_cn || '—'}
            </span>
          </div>
          <div className="info-item">
            <span className="info-label">Fingerprint (SHA-256)</span>
            <span className="info-value" style={{ fontFamily: 'monospace', fontSize: '0.8em' }}
                  title={status.fingerprint_sha256}>
              {truncateFp(status.fingerprint_sha256)}
            </span>
          </div>
          <div className="info-item">
            <span className="info-label">Valid Until</span>
            <span className={`info-value ${daysColor(status.days_remaining)}`}>
              {formatDate(status.not_after)}
              {status.days_remaining != null && (
                <span style={{ marginLeft: 6, fontSize: '0.85em' }}>
                  ({status.days_remaining} days remaining)
                </span>
              )}
            </span>
          </div>
        </div>
      )}

      {isService && (
        <div style={{ marginTop: 16, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <button
            className={`save-button${regenerating ? ' loading' : ''}`}
            onClick={handleRegenerate}
            disabled={regenerating || loading}
          >
            {regenerating ? 'Regenerating…' : 'Regenerate Certificate'}
          </button>

          <button
            className="save-button"
            disabled
            title="Custom certificate upload — coming in Phase 2"
            style={{ opacity: 0.5, cursor: 'not-allowed' }}
          >
            Upload Custom Certificate
          </button>
        </div>
      )}
    </div>
  );
}
