import React, { useCallback, useEffect, useState } from 'react';
import { useSelector } from 'react-redux';
import LogsService from '../../services/LogsService.js';
import useLocale from '../../hooks/useLocale.jsx';

function formatBytes(n) {
  if (n == null) return '—';
  if (n >= 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${n} B`;
}

export default function LogsPanel() {
  const { t } = useLocale();
  const user = useSelector((s) => s.auth.user);
  const isService = user?.role === 'service';

  const [info, setInfo] = useState(null);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const refresh = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      setInfo(await LogsService.getLogs());
    } catch (e) {
      setError(e.message || String(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (isService) refresh();
  }, [isService, refresh]);

  if (!isService) return null;

  const handleDownload = async () => {
    setBusy(true);
    setError('');
    setSuccess('');
    try {
      await LogsService.downloadLogs();
      setSuccess(t('settings.logsDownloadOk'));
    } catch (e) {
      setError(e.message || String(e));
    } finally {
      setBusy(false);
    }
  };

  const handleClear = async () => {
    if (!window.confirm(t('settings.logsClearConfirm'))) return;
    setBusy(true);
    setError('');
    setSuccess('');
    try {
      await LogsService.clearLogs();
      setSuccess(t('settings.logsCleared'));
      await refresh();
    } catch (e) {
      setError(e.message || String(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="sched-card">
      <h3>{t('settings.logsTitle')}</h3>
      <p className="card-desc">{t('settings.logsDesc')}</p>

      <div className="logs-stats" style={{ marginTop: 12 }}>
        <span className="logs-stat">
          {t('settings.logsSize')}:{' '}
          <strong>
            {formatBytes(info?.bytes)}
            {info?.max_bytes != null ? ` / ${formatBytes(info.max_bytes)}` : ''}
          </strong>
        </span>
        <span className="logs-stat-sep" aria-hidden="true">·</span>
        <span className="logs-stat">
          {t('settings.logsDropped')}: <strong>{info?.dropped ?? '—'}</strong>
        </span>
        <span className="logs-stat-sep" aria-hidden="true">·</span>
        <span className="logs-stat">
          {t('settings.logsSpiffsFree')}: <strong>{formatBytes(info?.spiffs_free)}</strong>
        </span>
      </div>

      {error && <div className="error-message" style={{ marginTop: 8 }}>{error}</div>}
      {success && <div className="success-message" style={{ marginTop: 8 }}>{success}</div>}

      <div style={{ display: 'flex', gap: 8, marginTop: 16, flexWrap: 'wrap' }}>
        <button
          className={`save-button action-btn${loading ? ' loading' : ''}`}
          onClick={refresh}
          disabled={loading || busy}
        >
          {loading ? t('settings.logsRefreshing') : t('settings.logsRefresh')}
        </button>
        <button
          className="save-button action-btn"
          onClick={handleDownload}
          disabled={loading || busy}
        >
          {t('settings.logsDownload')}
        </button>
        <button
          className="save-button action-btn danger-btn"
          onClick={handleClear}
          disabled={loading || busy}
        >
          {t('settings.logsClear')}
        </button>
      </div>

      {info?.tail ? (
        <pre
          className="card-desc"
          style={{
            marginTop: 16,
            maxHeight: 280,
            overflow: 'auto',
            whiteSpace: 'pre-wrap',
            wordBreak: 'break-word',
            fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace',
            fontSize: 12,
            background: 'rgba(0,0,0,0.04)',
            padding: 12,
            borderRadius: 6,
          }}
        >
          {info.tail}
        </pre>
      ) : (
        !loading && <p className="card-desc" style={{ marginTop: 12 }}>{t('settings.logsEmpty')}</p>
      )}
    </div>
  );
}
