import React from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { syncTime, fetchSettingsCore } from '../SettingsSlice.js';
import { hydrateSettings } from '../../Schedule/ScheduleSlice.js';
import useLocale from '../../../hooks/useLocale.jsx';
import LogsPanel from '../LogsPanel.jsx';

function formatUptime(sec) {
  if (sec == null || Number.isNaN(sec)) return '—';
  const s = Math.max(0, Math.floor(sec));
  const days = Math.floor(s / 86400);
  const hours = Math.floor((s % 86400) / 3600);
  const mins = Math.floor((s % 3600) / 60);
  if (days > 0) return `${days}d ${hours}h ${mins}m`;
  if (hours > 0) return `${hours}h ${mins}m`;
  return `${mins}m`;
}

function formatSyncAge(sec, t) {
  if (sec == null || sec >= 4294967295) return '';
  const mins = Math.floor(sec / 60);
  if (mins < 1) return ` (${t('settings.syncJustNow')})`;
  if (mins < 60) return ` (${mins}${t('settings.syncMinutesAgo')})`;
  const hours = Math.floor(mins / 60);
  return ` (${hours}${t('settings.syncHoursAgo')})`;
}

export default function SystemTab() {
  const dispatch = useDispatch();
  const { t } = useLocale();
  const { systemInfo, syncing } = useSelector((s) => s.settings);
  const user = useSelector((s) => s.auth.user);
  const isService = user?.role === 'service';

  const handleSync = () => {
    dispatch(syncTime()).then(() =>
      dispatch(fetchSettingsCore({ force: true })).then((refresh) => {
        if (refresh.meta.requestStatus === 'fulfilled') {
          dispatch(hydrateSettings(refresh.payload.scheduleSettings));
        }
      }));
  };

  return (
    <>
      <div className="sched-card">
        <h3>{t('settings.systemInfo')}</h3>
        <p className="card-desc">{t('settings.systemInfoDesc')}</p>

        <div className="info-grid">
          <div className="info-item">
            <span className="info-label">{t('settings.deviceTime')}</span>
            <span className="info-value">{systemInfo?.time || '—'}</span>
          </div>
          <div className="info-item">
            <span className="info-label">{t('settings.date')}</span>
            <span className="info-value">{systemInfo?.date || '—'}</span>
          </div>
          <div className="info-item">
            <span className="info-label">{t('settings.timeSyncStatus')}</span>
            <span className={`info-value ${systemInfo && !systemInfo.timeSynced ? 'text-warn' : ''}`}>
              {systemInfo
                ? (systemInfo.timeSynced
                  ? t('settings.synchronized')
                  : t('settings.notSynchronized'))
                : '—'}
              {systemInfo?.timeSynced
                ? formatSyncAge(systemInfo.lastSyncAgeSec, t)
                : ''}
            </span>
          </div>
          <div className="info-item">
            <span className="info-label">{t('settings.activeTimezone')}</span>
            <span className="info-value">{systemInfo?.timezone || '—'}</span>
          </div>
          <div className="info-item">
            <span className="info-label">{t('settings.uptime')}</span>
            <span className="info-value">{formatUptime(systemInfo?.uptimeSec)}</span>
          </div>
          <div className="info-item">
            <span className="info-label">{t('settings.macAddress')}</span>
            <span className="info-value">{systemInfo?.mac || '—'}</span>
          </div>
        </div>

        <div style={{ display: 'flex', gap: 12, marginTop: 16 }}>
          <button
            type="button"
            className={`save-button${syncing ? ' loading' : ''}`}
            onClick={handleSync}
            disabled={syncing}
          >
            {syncing ? t('settings.syncing') : t('settings.syncNow')}
          </button>
        </div>
        <p className="card-desc" style={{ marginTop: 8 }}>{t('settings.syncNowHint')}</p>
      </div>

      {isService && <LogsPanel />}
    </>
  );
}
