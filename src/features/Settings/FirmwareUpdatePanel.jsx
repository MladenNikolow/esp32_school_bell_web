import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useSelector } from 'react-redux';
import FirmwareService from '../../services/FirmwareService.js';
import useLocale from '../../hooks/useLocale.jsx';

/* ------------------------------------------------------------------------- */
/* Small format helpers                                                       */
/* ------------------------------------------------------------------------- */
function formatBytes(n) {
  if (n == null) return '—';
  if (n >= 1024 * 1024) return `${(n / 1024 / 1024).toFixed(2)} MB`;
  if (n >= 1024)        return `${(n / 1024).toFixed(1)} KB`;
  return `${n} B`;
}

/* ------------------------------------------------------------------------- */
/* FirmwareUpdatePanel                                                       */
/*                                                                            */
/* Displays the running firmware info and lets a service-role operator        */
/* upload a new .sbu bundle. Steps:                                           */
/*   1. POST the binary body to /api/system/update with progress.            */
/*   2. Device responds 200 → it will reboot in ~1.5 s.                      */
/*   3. We poll /api/health until it comes back online, then reload.         */
/* Also surfaces the "pending_verify" state (the device is running new       */
/* firmware on probation) and the manual rollback button.                    */
/* ------------------------------------------------------------------------- */
export default function FirmwareUpdatePanel() {
  const { t } = useLocale();
  const user = useSelector((s) => s.auth.user);
  const isService = user?.role === 'service';

  const [info, setInfo]       = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState('');
  const [busy, setBusy]       = useState(false);
  const [progress, setProgress] = useState(0);
  const [phase, setPhase]     = useState('idle'); /* idle | uploading | rebooting | waiting | done */
  const [file, setFile]       = useState(null);
  const fileInputRef          = useRef(null);

  const refreshInfo = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      setInfo(await FirmwareService.getFirmwareInfo());
    } catch (e) {
      setError(e.message || String(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { refreshInfo(); }, [refreshInfo]);

  /* Watchdog for the post-reboot recovery phase. */
  const waitForReboot = useCallback(async () => {
    setPhase('waiting');
    const deadline = Date.now() + 90 * 1000; /* 90 s max */
    /* Brief delay so the response actually flushes before we hammer /health. */
    await new Promise((r) => setTimeout(r, 3000));
    while (Date.now() < deadline) {
      try {
        const r = await fetch('/api/health', { credentials: 'same-origin', cache: 'no-store' });
        if (r.ok) {
          setPhase('done');
          /* Force a hard reload so the new bundle is fetched and the session
           * (which was lost across the reboot) is re-acquired via login. */
          setTimeout(() => window.location.reload(), 1200);
          return;
        }
      } catch (_) { /* still down — keep polling */ }
      await new Promise((r) => setTimeout(r, 2000));
    }
    setError(t('settings.fwRebootTimeout') || 'Device did not come back online within 90 s');
    setPhase('idle');
  }, [t]);

  const handleUpload = async () => {
    if (!file) return;
    if (!window.confirm(
      (t('settings.fwUploadConfirm') || 'Upload firmware bundle "{name}" ({size}) and reboot?')
        .replace('{name}', file.name)
        .replace('{size}', formatBytes(file.size))
    )) return;

    setError('');
    setBusy(true);
    setProgress(0);
    setPhase('uploading');
    try {
      await FirmwareService.uploadBundle(file, (p) => setProgress(p.percent));
      setPhase('rebooting');
      await waitForReboot();
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
      await refreshInfo();
    } catch (e) { setError(e.message || String(e)); }
  };

  const handleRollback = async () => {
    if (!window.confirm(
      t('settings.fwRollbackConfirm') || 'Roll back to the previous firmware slot and reboot now?'
    )) return;
    setError('');
    setBusy(true);
    setPhase('rebooting');
    try {
      await FirmwareService.rollback();
      await waitForReboot();
    } catch (e) {
      setError(e.message || String(e));
      setPhase('idle');
    } finally {
      setBusy(false);
    }
  };

  /* Only the service role may upload or roll back firmware. */
  if (!isService) {
    return null;
  }

  return (
    <div className="sched-card">
      <h3>{t('settings.firmwareUpdate') || 'Firmware Update'}</h3>
      <p className="card-desc">
        {t('settings.firmwareUpdateDesc') ||
         'Upload a signed .sbu bundle produced by build_update_bundle.py. The device verifies the bundle, writes both the new firmware and assets, then reboots. If the new firmware fails to start, the bootloader will automatically roll back.'}
      </p>

      {error && (
        <div className="error-message">{error}</div>
      )}

      {/* Current firmware --------------------------------------------------- */}
      <div className="settings-section">
        <h4>{t('settings.currentFirmware') || 'Current Firmware'}</h4>
        {loading && <div>{t('common.loading') || 'Loading…'}</div>}
        {info && (
          <table className="kv-table">
            <tbody>
              <tr><th>{t('settings.fwVersion') || 'Version'}</th><td>{info.fw_version || '—'}</td></tr>
              <tr><th>{t('settings.fwRunningSlot') || 'Running slot'}</th><td>{info.running_partition}</td></tr>
              <tr><th>{t('settings.fwBootSlot') || 'Next boot slot'}</th><td>{info.boot_partition}</td></tr>
              <tr><th>{t('settings.fwFatfsSlot') || 'Asset slot'}</th><td>fatfs_react_{info.fatfs_slot}</td></tr>
              <tr>
                <th>{t('settings.fwPending') || 'Pending verify'}</th>
                <td>{info.pending_verify
                    ? <span className="badge badge-warn">{t('common.yes') || 'YES'}</span>
                    : (t('common.no') || 'no')}</td>
              </tr>
              <tr><th>{t('settings.fwRollback') || 'Rollback available'}</th>
                  <td>{info.rollback_possible ? (t('common.yes') || 'yes') : (t('common.no') || 'no')}</td></tr>
              <tr><th>{t('settings.fwFreeHeap') || 'Free heap'}</th><td>{formatBytes(info.free_heap)}</td></tr>
            </tbody>
          </table>
        )}
        <button className="btn" onClick={refreshInfo} disabled={loading || busy}>
          {t('common.refresh') || 'Refresh'}
        </button>
      </div>

      {/* Upload bundle ------------------------------------------------------ */}
      <div className="settings-section">
        <h4>{t('settings.fwUploadBundle') || 'Upload Bundle'}</h4>
        <input
          ref={fileInputRef}
          type="file"
          accept=".sbu,application/octet-stream"
          disabled={busy}
          onChange={(e) => setFile(e.target.files?.[0] || null)}
        />
        {file && (
          <div className="card-desc">
            {file.name} ({formatBytes(file.size)})
          </div>
        )}

        {phase === 'uploading' && (
          <div className="progress-bar">
            <div className="progress-fill" style={{ width: `${progress}%` }} />
            <span className="progress-label">{progress}%</span>
          </div>
        )}
        {phase === 'rebooting' && (
          <div className="info-message">{t('settings.fwRebooting') || 'Committing & rebooting…'}</div>
        )}
        {phase === 'waiting' && (
          <div className="info-message">
            {t('settings.fwWaitingOnline') || 'Waiting for the device to come back online…'}
          </div>
        )}
        {phase === 'done' && (
          <div className="success-message">
            {t('settings.fwDone') || 'Update complete. Reloading…'}
          </div>
        )}

        <div className="button-row">
          <button
            className="btn btn-primary"
            onClick={handleUpload}
            disabled={!file || busy}>
            {t('settings.fwUpload') || 'Upload & Install'}
          </button>
          {busy && phase === 'uploading' && (
            <button className="btn btn-secondary" onClick={handleAbort}>
              {t('common.cancel') || 'Cancel'}
            </button>
          )}
        </div>
      </div>

      {/* Manual rollback ---------------------------------------------------- */}
      {info && info.rollback_possible && (
        <div className="settings-section">
          <h4>{t('settings.fwRollbackTitle') || 'Manual Rollback'}</h4>
          <p className="card-desc">
            {t('settings.fwRollbackDesc') ||
             'Switch back to the previous firmware slot. Use this if the current firmware boots but misbehaves; the device will reboot immediately.'}
          </p>
          <button className="btn btn-warn" onClick={handleRollback} disabled={busy}>
            {t('settings.fwRollback') || 'Rollback to previous slot'}
          </button>
        </div>
      )}
    </div>
  );
}
