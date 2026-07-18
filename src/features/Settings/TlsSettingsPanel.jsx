/**
 * TlsSettingsPanel.jsx
 *
 * Displays TLS certificate status and allows service-role admins to:
 *  • Switch web server mode (HTTP / HTTPS) and save → auto-restart
 *  • Regenerate the self-signed certificate
 *  • Upload a custom PEM certificate + private key
 */
import React, { useEffect, useState, useCallback, useRef } from 'react';
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

function readFileAsText(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => resolve(e.target.result);
    reader.onerror = () => reject(new Error('Failed to read file'));
    reader.readAsText(file);
  });
}

/* ------------------------------------------------------------------ */
export default function TlsSettingsPanel({
  initialStatus = null,
  autoLoad = true,
  loadStatusOverride = null,
  enableFocusRefresh = true,
}) {
  const { t } = useLocale();
  const user = useSelector((s) => s.auth.user);
  const isService = user?.role === 'service';

  const [status, setStatus]           = useState(null);
  const [loading, setLoading]         = useState(false);
  const [error, setError]             = useState(null);
  const [toast, setToast]             = useState(null);

  /* Mode toggle state */
  const [selectedMode, setSelectedMode] = useState(null); // 'http' | 'https'
  const [savingMode, setSavingMode]     = useState(false);

  /* Regenerate */
  const [regenerating, setRegenerating] = useState(false);

  /* Download certificate */
  const [downloading, setDownloading] = useState(false);

  /* Upload modal */
  const [showUpload, setShowUpload]       = useState(false);
  const [certFile, setCertFile]           = useState(null);
  const [keyFile, setKeyFile]             = useState(null);
  const [uploading, setUploading]         = useState(false);
  const [uploadError, setUploadError]     = useState(null);
  const certInputRef = useRef(null);
  const keyInputRef  = useRef(null);

  const showToast = useCallback((msg) => {
    setToast(msg);
    setTimeout(() => setToast(null), 6000);
  }, []);

  const loadStatus = useCallback(async (signal) => {
    setLoading(true);
    setError(null);
    try {
      const data = loadStatusOverride
        ? await loadStatusOverride(signal)
        : await TlsService.getStatus(signal);
      setStatus(data);
      /* Seed mode selector from persisted setting */
      setSelectedMode(data.mode_setting || (data.enabled ? 'https' : 'http'));
    } catch (e) {
      if (e.name !== 'AbortError') setError(e.message || 'Failed to load TLS status');
    } finally {
      setLoading(false);
    }
  }, [loadStatusOverride]);

  useEffect(() => {
    if (!autoLoad || initialStatus) return undefined;
    const ctrl = new AbortController();
    loadStatus(ctrl.signal);
    return () => ctrl.abort();
  }, [autoLoad, initialStatus, loadStatus]);

  useEffect(() => {
    if (!initialStatus) return;
    setStatus(initialStatus);
    setSelectedMode(initialStatus.mode_setting || (initialStatus.enabled ? 'https' : 'http'));
  }, [initialStatus]);

  useEffect(() => {
    if (!enableFocusRefresh) return undefined;
    const onFocus = () => { const c = new AbortController(); loadStatus(c.signal); };
    window.addEventListener('focus', onFocus);
    return () => window.removeEventListener('focus', onFocus);
  }, [enableFocusRefresh, loadStatus]);

  /* ---- Mode save ---- */
  const handleSaveMode = async () => {
    if (!selectedMode) return;

    /* Switching to HTTPS but no cert → require cert first */
    if (selectedMode === 'https' && status && !status.cert_present) {
      setError('No certificate found. Generate or upload a certificate before enabling HTTPS.');
      return;
    }

    if (!window.confirm(
      `Switch server mode to ${selectedMode.toUpperCase()}? The device will restart.`
    )) return;

    setSavingMode(true);
    setError(null);
    try {
      await TlsService.setMode(selectedMode);
      showToast(`Mode set to ${selectedMode.toUpperCase()}. Device is restarting — reconnecting in 5 s…`);
      setTimeout(() => {
        const proto = selectedMode === 'https' ? 'https:' : 'http:';
        window.location.assign(window.location.href.replace(/^https?:/, proto));
      }, 5000);
    } catch (e) {
      setError(e.message || 'Failed to set mode');
      setSavingMode(false);
    }
  };

  /* ---- Regenerate ---- */
  const handleRegenerate = async () => {
    if (!window.confirm(
      'Regenerate the TLS certificate? A new self-signed certificate will be created.'
    )) return;

    setRegenerating(true);
    setError(null);
    try {
      const res = await TlsService.regenerate();
      const needRestart = res?.restart_required === true;

      if (needRestart) {
        showToast('Certificate regenerated. Device is restarting — reconnecting in 8 s…');
        setTimeout(() => {
          window.location.assign(window.location.href.replace(/^https?:/, 'https:'));
        }, 8000);
      } else {
        showToast('Certificate regenerated and stored. Switch to HTTPS mode to apply it.');
        /* No restart in HTTP mode — just refresh the cert metadata in place. */
        await loadStatus();
        setRegenerating(false);
      }
    } catch (e) {
      setError(e.message || 'Regeneration failed');
      setRegenerating(false);
    }
  };

  /* ---- Download certificate ---- */
  const handleDownloadCert = async () => {
    setDownloading(true);
    setError(null);
    try {
      await TlsService.downloadCertificate();
    } catch (e) {
      setError(e.message || 'Failed to download certificate');
    } finally {
      setDownloading(false);
    }
  };

  /* ---- Upload ---- */
  const handleUploadSubmit = async () => {
    if (!certFile || !keyFile) {
      setUploadError('Please select both the certificate file and the private key file.');
      return;
    }
    setUploadError(null);
    setUploading(true);
    try {
      const certPem = await readFileAsText(certFile);
      const keyPem  = await readFileAsText(keyFile);
      const res = await TlsService.uploadCertificate(certPem, keyPem);
      const needRestart = res?.restart_required === true;

      setShowUpload(false);
      setCertFile(null); setKeyFile(null);

      if (needRestart) {
        showToast('Certificate installed. Device is restarting — reconnecting in 8 s…');
        setTimeout(() => {
          window.location.assign(window.location.href.replace(/^https?:/, 'https:'));
        }, 8000);
      } else {
        showToast('Certificate installed and stored. Switch to HTTPS mode to apply it.');
        /* No restart in HTTP mode — refresh the cert metadata in place. */
        await loadStatus();
        setUploading(false);
      }
    } catch (e) {
      setUploadError(e.message || 'Upload failed');
    } finally {
      setUploading(false);
    }
  };

  const modeChanged = selectedMode !== (status?.mode_setting ?? (status?.enabled ? 'https' : 'http'));

  return (
    <div className="sched-card">
      <h3>Security — TLS / HTTPS</h3>
      <p className="card-desc">
        The device can serve its web interface over HTTPS (port 443) with a TLS certificate,
        or over plain HTTP (port 80). HTTPS requires a valid certificate to be present.
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

      {status?.tamper_suspected && (
        <div className="error-message" style={{ marginBottom: 12 }}>
          ⚠ Certificate changed unexpectedly — verify device physical security and regenerate.
        </div>
      )}

      {loading && !status && <p>Loading…</p>}

      {/* ---- Mode selector (service only) ---- */}
      {isService && status && (
        <div style={{ marginBottom: 20 }}>
          <div className="form-group">
            <label className="form-label">Web Server Mode</label>
            <div style={{ display: 'flex', gap: 16, alignItems: 'center', marginTop: 6 }}>
              {['http', 'https'].map((m) => (
                <label key={m} style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer' }}>
                  <input
                    type="radio"
                    name="web_mode"
                    value={m}
                    checked={selectedMode === m}
                    onChange={() => setSelectedMode(m)}
                    disabled={savingMode}
                  />
                  <span style={{ textTransform: 'uppercase', fontWeight: 600 }}>{m}</span>
                </label>
              ))}
            </div>
          </div>

          {selectedMode === 'https' && !status.cert_present && (
            <div className="error-message" style={{ margin: '6px 0 8px' }}>
              No certificate present. Generate or upload one below before saving HTTPS mode.
            </div>
          )}

          <div style={{ marginTop: 10 }}>
            <button
              className={`save-button${savingMode ? ' loading' : ''}`}
              onClick={handleSaveMode}
              disabled={!modeChanged || savingMode || loading ||
                        (selectedMode === 'https' && !status.cert_present)}
            >
              {savingMode ? 'Saving…' : 'Save Mode'}
            </button>
            {modeChanged && !savingMode && (
              <span style={{ marginLeft: 10, fontSize: '0.85em', opacity: 0.7 }}>
                (unsaved — device will restart on save)
              </span>
            )}
          </div>
        </div>
      )}

      {/* ---- Cert status grid ---- */}
      {status && (
        <div className="info-grid">
          <div className="info-item">
            <span className="info-label">Active Mode</span>
            <span className="info-value">
              <span className="badge" style={{ background: status.mode_active === 'https' ? '#3a8a3a' : '#888' }}>
                {(status.mode_active || (status.enabled ? 'https' : 'http')).toUpperCase()}
              </span>
            </span>
          </div>
          <div className="info-item">
            <span className="info-label">Certificate Present</span>
            <span className="info-value">{status.cert_present ? 'Yes' : 'No'}</span>
          </div>
          {status.cert_present && (
            <>
              <div className="info-item">
                <span className="info-label">Source</span>
                <span className="info-value" style={{ textTransform: 'capitalize' }}>{status.source || '—'}</span>
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
            </>
          )}
        </div>
      )}

      {/* ---- Download certificate (any authenticated user) ---- */}
      {status?.cert_present && (
        <div style={{ marginTop: 16 }}>
          <button
            className={`save-button${downloading ? ' loading' : ''}`}
            onClick={handleDownloadCert}
            disabled={downloading || loading}
            style={{ background: '#3a8a6a' }}
          >
            {downloading ? 'Downloading…' : 'Download Certificate'}
          </button>
          <p className="card-desc" style={{ marginTop: 6 }}>
            Download the device certificate (.crt) and install it as a trusted
            certificate on your computer or phone to remove browser security
            warnings. See the TLS Certificate Guide for per-device steps.
          </p>
        </div>
      )}

      {/* ---- Cert actions (service only) ---- */}
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
            onClick={() => { setShowUpload(true); setUploadError(null); setCertFile(null); setKeyFile(null); }}
            disabled={regenerating || loading}
            style={{ background: '#4a7abf' }}
          >
            Upload Custom Certificate
          </button>
        </div>
      )}

      {/* ---- Upload modal ---- */}
      {showUpload && (
        <div
          style={{
            position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000,
          }}
          onClick={(e) => { if (e.target === e.currentTarget && !uploading) setShowUpload(false); }}
        >
          <div style={{
            background: 'var(--card-bg, #1e1e1e)', borderRadius: 8,
            padding: 24, maxWidth: 460, width: '90%', boxShadow: '0 8px 32px rgba(0,0,0,0.6)',
          }}>
            <h4 style={{ marginTop: 0 }}>Upload Custom Certificate</h4>
            <p style={{ fontSize: '0.85em', opacity: 0.7 }}>
              Upload a PEM-encoded certificate and matching private key (each ≤ 6 KB).
              The existing certificate will be <strong>permanently replaced</strong>.
            </p>

            {uploadError && (
              <div className="error-message" style={{ marginBottom: 10 }}>{uploadError}</div>
            )}

            <div className="form-group">
              <label className="form-label">Certificate (cert.pem)</label>
              <input
                type="file"
                ref={certInputRef}
                accept=".pem,.crt,.cer"
                onChange={(e) => setCertFile(e.target.files[0] || null)}
                disabled={uploading}
                style={{ display: 'block', marginTop: 4 }}
              />
            </div>
            <div className="form-group" style={{ marginTop: 12 }}>
              <label className="form-label">Private Key (key.pem)</label>
              <input
                type="file"
                ref={keyInputRef}
                accept=".pem,.key"
                onChange={(e) => setKeyFile(e.target.files[0] || null)}
                disabled={uploading}
                style={{ display: 'block', marginTop: 4 }}
              />
            </div>

            <div style={{ marginTop: 18, display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button
                className="save-button"
                style={{ background: '#555' }}
                onClick={() => setShowUpload(false)}
                disabled={uploading}
              >
                Cancel
              </button>
              <button
                className={`save-button${uploading ? ' loading' : ''}`}
                onClick={handleUploadSubmit}
                disabled={uploading || !certFile || !keyFile}
              >
                {uploading ? 'Uploading…' : 'Install Certificate'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
