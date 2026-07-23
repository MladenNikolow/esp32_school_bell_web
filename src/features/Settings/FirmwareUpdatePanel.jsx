import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useSelector } from 'react-redux';
import FirmwareService from '../../services/FirmwareService.js';
import HttpClient from '../../utils/HttpClient.js';
import useLocale from '../../hooks/useLocale.jsx';

/* ------------------------------------------------------------------------- */
/* Constants                                                                  */
/* ------------------------------------------------------------------------- */
const SBU_MAGIC          = 'SBU1';
const MIN_BUNDLE_BYTES   = 100 * 1024;      /* anything smaller is clearly bogus */
const MAX_BUNDLE_BYTES   = 8  * 1024 * 1024;/* app(4M)+fatfs(2M)+header < 8M    */
const MAX_HEADER_BYTES   = 4096;            /* matches FU_MAX_HEADER_LEN backend */

/* ------------------------------------------------------------------------- */
/* Small format helpers                                                       */
/* ------------------------------------------------------------------------- */
function formatBytes(n) {
  if (n == null) return '—';
  if (n >= 1024 * 1024) return `${(n / 1024 / 1024).toFixed(2)} MB`;
  if (n >= 1024)        return `${(n / 1024).toFixed(1)} KB`;
  return `${n} B`;
}

/**
 * Client-side preflight: read the first ~4 KB of the file and verify the
 * SBU1 magic + plausible header length + parseable JSON header. Catches
 * the most common operator mistakes (wrong file picked, random binary
 * renamed to .sbu, half-downloaded file) BEFORE we waste several minutes
 * streaming megabytes to the device.
 *
 * Returns { ok: true, fwVersion, deviceModel } on success, or
 *         { ok: false, errorKey } where errorKey is an i18n key.
 */
async function preflightBundle(file) {
  if (!file) return { ok: false, errorKey: 'settings.fwErrNoFile' };

  if (file.size < MIN_BUNDLE_BYTES) return { ok: false, errorKey: 'settings.fwErrTooSmall' };
  if (file.size > MAX_BUNDLE_BYTES) return { ok: false, errorKey: 'settings.fwErrTooLarge' };

  /* Peek at the first 8 bytes + up to MAX_HEADER_BYTES of header JSON */
  const peekLen = 8 + MAX_HEADER_BYTES;
  let buf;
  try {
    buf = new Uint8Array(await file.slice(0, peekLen).arrayBuffer());
  } catch (_) {
    return { ok: false, errorKey: 'settings.fwErrReadFile' };
  }

  if (buf.length < 8) return { ok: false, errorKey: 'settings.fwErrTooSmall' };

  /* Magic check -first 4 bytes must spell "SBU1" */
  const magic = String.fromCharCode(buf[0], buf[1], buf[2], buf[3]);
  if (magic !== SBU_MAGIC) return { ok: false, errorKey: 'settings.fwErrBadMagic' };

  /* Header length (little-endian u32) */
  const hdrLen = buf[4] | (buf[5] << 8) | (buf[6] << 16) | (buf[7] << 24);
  if (hdrLen <= 0 || hdrLen > MAX_HEADER_BYTES) {
    return { ok: false, errorKey: 'settings.fwErrBadHeader' };
  }
  if (buf.length < 8 + hdrLen) return { ok: false, errorKey: 'settings.fwErrBadHeader' };

  /* Try to parse the JSON header */
  let header;
  try {
    const jsonStr = new TextDecoder('utf-8', { fatal: true })
      .decode(buf.subarray(8, 8 + hdrLen));
    header = JSON.parse(jsonStr);
  } catch (_) {
    return { ok: false, errorKey: 'settings.fwErrBadHeader' };
  }

  if (header.bundle_version !== 1) return { ok: false, errorKey: 'settings.fwErrBadVersion' };
  if (!header.device_model)        return { ok: false, errorKey: 'settings.fwErrBadHeader' };

  /* Sanity: declared total payload + framing must equal the file size */
  let expected = 8 + hdrLen + 32; /* magic + hdrlen + header + trailer */
  if (Array.isArray(header.sections)) {
    for (const s of header.sections) {
      if (typeof s.size === 'number') expected += s.size;
    }
  }
  if (expected !== file.size) return { ok: false, errorKey: 'settings.fwErrSizeMismatch' };

  return { ok: true, fwVersion: header.fw_version, deviceModel: header.device_model };
}

/* ------------------------------------------------------------------------- */
/* FirmwareUpdatePanel                                                       */
/*                                                                            */
/* Service-only panel for uploading an .sbu firmware bundle. Behaviour:       */
/*   1. Display current firmware/partition info.                              */
/*   2. Validate the file CLIENT-SIDE before upload (magic, header, size).    */
/*   3. Show a prominent danger warning explaining what will happen.          */
/*   4. POST the binary body to /api/system/update with progress.             */
/*   5. Poll /api/health until the device returns, then reload.               */
/* The rollback action is intentionally NOT exposed in the UI -the           */
/* bootloader handles automatic rollback when a new firmware fails to start.  */
/* ------------------------------------------------------------------------- */
export default function FirmwareUpdatePanel({ initialInfo = null, autoLoad = true, loadInfo = null }) {
  const { t } = useLocale();
  const user = useSelector((s) => s.auth.user);
  const isService = user?.role === 'service';

  const [info, setInfo]                 = useState(null);
  const [loading, setLoading]           = useState(true);
  const [error, setError]               = useState('');
  const [busy, setBusy]                 = useState(false);
  const [progress, setProgress]         = useState(0);
  const [phase, setPhase]               = useState('idle'); /* idle | uploading | rebooting | waiting | done */
  const [file, setFile]                 = useState(null);
  const [preflight, setPreflight]       = useState(null);   /* { ok, fwVersion, ... } | { ok:false, errorKey } */
  const fileInputRef                    = useRef(null);

  const refreshInfo = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      setInfo(loadInfo ? await loadInfo() : await FirmwareService.getFirmwareInfo());
    } catch (e) {
      setError(e.message || String(e));
    } finally {
      setLoading(false);
    }
  }, [loadInfo]);

  useEffect(() => {
    if (initialInfo) {
      setInfo(initialInfo);
      setLoading(false);
    }
  }, [initialInfo]);

  useEffect(() => {
    if (autoLoad && !initialInfo) refreshInfo();
  }, [autoLoad, initialInfo, refreshInfo]);

  /* Warn the user if they try to navigate away mid-upload -a refresh would
   * not actually cancel the upload on the server, but would lose the UI
   * progress and make recovery confusing. */
  useEffect(() => {
    if (phase !== 'uploading' && phase !== 'rebooting' && phase !== 'waiting') return;
    const handler = (e) => { e.preventDefault(); e.returnValue = ''; };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [phase]);

  const handleFileChange = async (e) => {
    setError('');
    setPreflight(null);
    const f = e.target.files?.[0] || null;
    setFile(f);
    if (!f) return;
    const res = await preflightBundle(f);
    setPreflight(res);
  };

  /* Watchdog for the post-reboot recovery phase.
   * Require the device to actually go offline once before treating a
   * successful /api/health as "back after reboot". Otherwise a missed
   * backend reboot (commit without restart) looks like success. */
  const waitForReboot = useCallback(async (rebootInMs = 1500) => {
    setPhase('rebooting');
    const settleMs = Math.max(500, Number(rebootInMs) || 1500) + 500;
    await new Promise((r) => setTimeout(r, settleMs));
    setPhase('waiting');

    const deadline = Date.now() + 90 * 1000;
    let sawDown = false;
    let consecutiveOk = 0;

    while (Date.now() < deadline) {
      try {
        const r = await HttpClient.get('/api/health', {
          cache: 'no-store',
          skipAuth: true,
          priority: 'critical',
          deduplicate: false,
        });
        if (r.ok) {
          if (sawDown) {
            consecutiveOk += 1;
            if (consecutiveOk >= 2) {
              setPhase('done');
              /* Force a hard reload so the new bundle is fetched and the session
               * (which was lost across the reboot) is re-acquired via login. */
              setTimeout(() => window.location.reload(), 1200);
              return;
            }
          } else {
            consecutiveOk = 0;
          }
        } else {
          sawDown = true;
          consecutiveOk = 0;
        }
      } catch (_) {
        sawDown = true;
        consecutiveOk = 0;
      }
      await new Promise((r) => setTimeout(r, 2000));
    }

    setError(sawDown
      ? t('settings.fwRebootTimeout')
      : t('settings.fwRebootDidNotStart'));
    setPhase('idle');
  }, [t]);

  const handleUpload = async () => {
    if (!file || !preflight?.ok) return;
    if (!window.confirm(
      t('settings.fwUploadConfirm')
        .replace('{name}', file.name)
        .replace('{size}', formatBytes(file.size))
        .replace('{version}', preflight.fwVersion || '?')
    )) return;

    setError('');
    setBusy(true);
    setProgress(0);
    setPhase('uploading');
    try {
      const result = await FirmwareService.uploadBundle(file, (p) => setProgress(p.percent));
      await waitForReboot(result?.reboot_in_ms || 1500);
    } catch (e) {
      setError(e.message || String(e));
      setPhase('idle');
    } finally {
      setBusy(false);
    }
  };

  const handleAbort = async () => {
    try {
      await FirmwareService.abortUpdate();
      setPhase('idle');
      setBusy(false);
      await refreshInfo();
    } catch (e) { setError(e.message || String(e)); }
  };

  /* Only the service role may upload firmware. */
  if (!isService) return null;

  const isPending           = !!info?.pending_verify;
  const preflightOK         = preflight?.ok === true;
  const preflightErrorKey   = preflight && preflight.ok === false ? preflight.errorKey : '';
  const modelMismatch       = preflightOK && info?.device_model
                              && preflight.deviceModel !== info.device_model;
  const uploadDisabled      = !file || busy || !preflightOK || isPending || modelMismatch;

  return (
    <div className="sched-card">
      <h3>{t('settings.firmwareUpdate')}</h3>
      <p className="card-desc">{t('settings.firmwareUpdateDesc')}</p>

      {error && <div className="error-message">{error}</div>}

      {/* Pending-verify notice ---------------------------------------------- */}
      {isPending && (
        <div className="system-action-item system-action-danger" style={{ marginBottom: 16 }}>
          <div className="action-info">
            <strong>⚠ {t('settings.fwPendingTitle')}</strong>
            <p className="card-desc">{t('settings.fwPendingNotice')}</p>
          </div>
        </div>
      )}

      {/* Current software version ------------------------------------------- */}
      <div className="settings-section">
        <h4>{t('settings.currentFirmware')}</h4>
        {loading && <p className="card-desc">…</p>}
        {info && (
          <div className="info-grid">
            <div className="info-item">
              <span className="info-label">{t('settings.fwVersion')}</span>
              <span className="info-value">{info.fw_version || '—'}</span>
            </div>
            <div className="info-item">
              <span className="info-label">{t('settings.fwPending')}</span>
              <span className={`info-value${isPending ? ' text-warn' : ''}`}>
                {isPending ? t('settings.fwPendingYes') : t('settings.fwPendingNo')}
              </span>
            </div>
          </div>
        )}
        <div style={{ marginTop: 12 }}>
          <button type="button" className="refresh-btn" onClick={refreshInfo} disabled={loading || busy}>
            {t('settings.refresh')}
          </button>
        </div>
      </div>

      {/* Upload section ----------------------------------------------------- */}
      <div className="settings-section" style={{ borderBottom: 'none', marginBottom: 0 }}>
        <h4>{t('settings.fwUploadBundle')}</h4>

        {/* Danger warning */}
        <div className="system-action-item system-action-danger" style={{ marginBottom: 16 }}>
          <div className="action-info">
            <strong>⚠ {t('settings.fwWarningTitle')}</strong>
            <p className="card-desc">{t('settings.fwWarningText')}</p>
          </div>
        </div>

        {!isPending && (
          <>
            <p className="card-desc">{t('settings.fwUploadDesc')}</p>

            <div className="settings-row" style={{ marginTop: 8 }}>
              <input
                ref={fileInputRef}
                type="file"
                accept=".sbu,application/octet-stream"
                disabled={busy}
                style={{ flex: 1 }}
                onChange={handleFileChange}
              />
            </div>

            {file && (
              <p className="card-desc" style={{ marginTop: 4 }}>
                <strong>{file.name}</strong> -{formatBytes(file.size)}
                {preflightOK && preflight.fwVersion && (
                  <> · v{preflight.fwVersion}</>
                )}
              </p>
            )}

            {/* Preflight error */}
            {preflightErrorKey && (
              <div className="error-message" style={{ marginTop: 8 }}>
                {t(preflightErrorKey)}
              </div>
            )}

            {/* Device-model mismatch (only checkable if backend reports model) */}
            {modelMismatch && (
              <div className="error-message" style={{ marginTop: 8 }}>
                {t('settings.fwErrModelMismatch')
                  .replace('{bundle}', preflight.deviceModel)
                  .replace('{device}', info.device_model || '?')}
              </div>
            )}
          </>
        )}

        {phase === 'uploading' && (
          <div className="fw-progress" style={{ marginTop: 12 }}>
            <div className="fw-progress-bar">
              <div className="fw-progress-fill" style={{ width: `${progress}%` }} />
            </div>
            <span className="fw-progress-label">{progress}%</span>
          </div>
        )}

        {(phase === 'rebooting' || phase === 'waiting') && (
          <div className="system-action-item" style={{ marginTop: 12 }}>
            <p className="card-desc" style={{ margin: 0 }}>
              {phase === 'rebooting' ? t('settings.fwRebooting') : t('settings.fwWaitingOnline')}
            </p>
          </div>
        )}

        {phase === 'done' && (
          <div className="success-message" style={{ marginTop: 12 }}>
            {t('settings.fwDone')}
          </div>
        )}

        {!isPending && (
          <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
            <button
              className={`save-button danger-btn action-btn${busy && phase === 'uploading' ? ' loading' : ''}`}
              onClick={handleUpload}
              disabled={uploadDisabled}
            >
              {busy && phase === 'uploading' ? t('settings.fwUploading') : t('settings.fwUpload')}
            </button>
            {busy && phase === 'uploading' && (
              <button className="refresh-btn" onClick={handleAbort}>
                {t('settings.fwAbort')}
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
