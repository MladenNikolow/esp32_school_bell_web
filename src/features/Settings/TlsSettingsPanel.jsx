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
  return `${fp.slice(0, 8)}...${fp.slice(-8)}`;
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

  const [selectedMode, setSelectedMode] = useState(null);
  const [savingMode, setSavingMode]     = useState(false);
  const [regenerating, setRegenerating] = useState(false);
  const [downloading, setDownloading] = useState(false);

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
      setSelectedMode(data.mode_setting || (data.enabled ? 'https' : 'http'));
    } catch (e) {
      if (e.name !== 'AbortError') setError(e.message || t('settings.tlsLoadFailed'));
    } finally {
      setLoading(false);
    }
  }, [loadStatusOverride, t]);

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

  const handleSaveMode = async () => {
    if (!selectedMode) return;

    if (selectedMode === 'https' && status && !status.cert_present) {
      setError(t('settings.tlsNoCertBeforeHttps'));
      return;
    }

    if (!window.confirm(t('settings.tlsModeConfirm').replace('{mode}', selectedMode.toUpperCase()))) {
      return;
    }

    setSavingMode(true);
    setError(null);
    try {
      await TlsService.setMode(selectedMode);
      showToast(t('settings.tlsModeSaved').replace('{mode}', selectedMode.toUpperCase()));
      setTimeout(() => {
        const proto = selectedMode === 'https' ? 'https:' : 'http:';
        window.location.assign(window.location.href.replace(/^https?:/, proto));
      }, 5000);
    } catch (e) {
      setError(e.message || t('settings.tlsModeFailed'));
      setSavingMode(false);
    }
  };

  const handleRegenerate = async () => {
    if (!window.confirm(t('settings.tlsRegenConfirm'))) return;

    setRegenerating(true);
    setError(null);
    try {
      const res = await TlsService.regenerate();
      const needRestart = res?.restart_required === true;

      if (needRestart) {
        showToast(t('settings.tlsRegenRestart'));
        setTimeout(() => {
          window.location.assign(window.location.href.replace(/^https?:/, 'https:'));
        }, 8000);
      } else {
        showToast(t('settings.tlsRegenStored'));
        await loadStatus();
        setRegenerating(false);
      }
    } catch (e) {
      setError(e.message || t('settings.tlsRegenFailed'));
      setRegenerating(false);
    }
  };

  const handleDownloadCert = async () => {
    setDownloading(true);
    setError(null);
    try {
      await TlsService.downloadCertificate();
    } catch (e) {
      setError(e.message || t('settings.tlsDownloadFailed'));
    } finally {
      setDownloading(false);
    }
  };

  const handleUploadSubmit = async () => {
    if (!certFile || !keyFile) {
      setUploadError(t('settings.tlsUploadNeedBoth'));
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
        showToast(t('settings.tlsUploadRestart'));
        setTimeout(() => {
          window.location.assign(window.location.href.replace(/^https?:/, 'https:'));
        }, 8000);
      } else {
        showToast(t('settings.tlsUploadStored'));
        await loadStatus();
        setUploading(false);
      }
    } catch (e) {
      setUploadError(e.message || t('settings.tlsUploadFailed'));
    } finally {
      setUploading(false);
    }
  };

  const modeChanged = selectedMode !== (status?.mode_setting ?? (status?.enabled ? 'https' : 'http'));
  const sourceLabel = status?.source === 'uploaded'
    ? t('settings.tlsSourceUploaded')
    : status?.source === 'generated'
      ? t('settings.tlsSourceGenerated')
      : (status?.source || '—');

  return (
    <div className="sched-card">
      <h3>{t('settings.tlsTitle')}</h3>
      <p className="card-desc">{t('settings.tlsDesc')}</p>

      {error && (
        <div className="error-message" style={{ marginBottom: 8 }}>
          {error}
          <button type="button" className="error-dismiss" onClick={() => setError(null)}>×</button>
        </div>
      )}

      {toast && (
        <div className="success-message" style={{ marginBottom: 8 }}>{toast}</div>
      )}

      {status?.tamper_suspected && (
        <div className="error-message" style={{ marginBottom: 12 }}>
          {t('settings.tlsTamper')}
        </div>
      )}

      {loading && !status && <p>{t('settings.tlsLoading')}</p>}

      {isService && status && (
        <div style={{ marginBottom: 20 }}>
          <div className="form-group">
            <label className="form-label">{t('settings.tlsWebMode')}</label>
            <p className="card-desc" style={{ marginTop: 4 }}>{t('settings.tlsWebModeDesc')}</p>
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
              {t('settings.tlsNoCertBeforeHttps')}
            </div>
          )}

          <div style={{ marginTop: 10 }}>
            <button
              type="button"
              className={`save-button${savingMode ? ' loading' : ''}`}
              onClick={handleSaveMode}
              disabled={!modeChanged || savingMode || loading
                || (selectedMode === 'https' && !status.cert_present)}
            >
              {savingMode ? t('settings.tlsSavingMode') : t('settings.tlsSaveMode')}
            </button>
            {modeChanged && !savingMode && (
              <span style={{ marginLeft: 10, fontSize: '0.85em', opacity: 0.7 }}>
                {t('settings.tlsUnsavedHint')}
              </span>
            )}
          </div>
        </div>
      )}

      {status && (
        <div className="info-grid">
          <div className="info-item">
            <span className="info-label">{t('settings.tlsActiveMode')}</span>
            <span className="info-value">
              <span className="badge" style={{ background: status.mode_active === 'https' ? '#3a8a3a' : '#888' }}>
                {(status.mode_active || (status.enabled ? 'https' : 'http')).toUpperCase()}
              </span>
            </span>
          </div>
          <div className="info-item">
            <span className="info-label">{t('settings.tlsCertPresent')}</span>
            <span className="info-value">
              {status.cert_present ? t('settings.tlsYes') : t('settings.tlsNo')}
            </span>
          </div>
          {status.cert_present && (
            <>
              <div className="info-item">
                <span className="info-label">{t('settings.tlsSource')}</span>
                <span className="info-value">{sourceLabel}</span>
              </div>
              <div className="info-item">
                <span className="info-label">{t('settings.tlsSubject')}</span>
                <span className="info-value" style={{ fontFamily: 'monospace', fontSize: '0.85em' }}>
                  {status.subject_cn || '—'}
                </span>
              </div>
              <div className="info-item">
                <span className="info-label">{t('settings.tlsFingerprint')}</span>
                <span
                  className="info-value"
                  style={{ fontFamily: 'monospace', fontSize: '0.8em' }}
                  title={status.fingerprint_sha256}
                >
                  {truncateFp(status.fingerprint_sha256)}
                </span>
              </div>
              <div className="info-item">
                <span className="info-label">{t('settings.tlsValidUntil')}</span>
                <span className={`info-value ${daysColor(status.days_remaining)}`}>
                  {formatDate(status.not_after)}
                  {status.days_remaining != null && (
                    <span style={{ marginLeft: 6, fontSize: '0.85em' }}>
                      ({t('settings.tlsDaysLeft').replace('{n}', String(status.days_remaining))})
                    </span>
                  )}
                </span>
              </div>
            </>
          )}
        </div>
      )}

      {status?.cert_present && (
        <div style={{ marginTop: 16 }}>
          <button
            type="button"
            className={`save-button${downloading ? ' loading' : ''}`}
            onClick={handleDownloadCert}
            disabled={downloading || loading}
            style={{ background: '#3a8a6a' }}
          >
            {downloading ? t('settings.tlsDownloading') : t('settings.tlsDownload')}
          </button>
          <p className="card-desc" style={{ marginTop: 6 }}>
            {t('settings.tlsDownloadHint')}
          </p>
        </div>
      )}

      {isService && (
        <div style={{ marginTop: 16, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <button
            type="button"
            className={`save-button${regenerating ? ' loading' : ''}`}
            onClick={handleRegenerate}
            disabled={regenerating || loading}
          >
            {regenerating ? t('settings.tlsRegenerating') : t('settings.tlsRegenerate')}
          </button>

          <button
            type="button"
            className="save-button"
            onClick={() => {
              setShowUpload(true);
              setUploadError(null);
              setCertFile(null);
              setKeyFile(null);
            }}
            disabled={regenerating || loading}
            style={{ background: '#4a7abf' }}
          >
            {t('settings.tlsUpload')}
          </button>
        </div>
      )}

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
          }}
          >
            <h4 style={{ marginTop: 0 }}>{t('settings.tlsUploadTitle')}</h4>
            <p style={{ fontSize: '0.85em', opacity: 0.7 }}>
              {t('settings.tlsUploadDesc')}
            </p>

            {uploadError && (
              <div className="error-message" style={{ marginBottom: 10 }}>{uploadError}</div>
            )}

            <div className="form-group">
              <label className="form-label">{t('settings.tlsCertFile')}</label>
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
              <label className="form-label">{t('settings.tlsKeyFile')}</label>
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
                type="button"
                className="save-button"
                style={{ background: '#555' }}
                onClick={() => setShowUpload(false)}
                disabled={uploading}
              >
                {t('settings.tlsCancel')}
              </button>
              <button
                type="button"
                className={`save-button${uploading ? ' loading' : ''}`}
                onClick={handleUploadSubmit}
                disabled={uploading || !certFile || !keyFile}
              >
                {uploading ? t('settings.tlsUploading') : t('settings.tlsInstall')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
