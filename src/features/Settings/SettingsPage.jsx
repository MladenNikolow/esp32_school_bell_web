import React, { useEffect, useState } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import {
  fetchSettings, saveSettings,
  setWorkingDays, setTimezone,
  clearError as clearScheduleError,
  clearSaveSuccess,
} from '../Schedule/ScheduleSlice.js';
import {
  fetchSystemInfo, rebootDevice, factoryReset, syncTime,
  scanWifiNetworks, saveWifiCredentials,
  fetchPin, savePin,
  fetchCredentials, saveCredentials, deleteCredentials,
  clearError, clearActionSuccess,
} from './SettingsSlice.js';
import TokenManager from '../../utils/TokenManager.js';
import TimezonePicker from '../Schedule/TimezonePicker.jsx';
import useLocale from '../../hooks/useLocale.jsx';

const ORDERED_DAYS = [1, 2, 3, 4, 5, 6, 0];

function formatUptime(sec) {
  if (!sec && sec !== 0) return '—';
  const d = Math.floor(sec / 86400);
  const h = Math.floor((sec % 86400) / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = sec % 60;
  const parts = [];
  if (d > 0) parts.push(`${d}d`);
  if (h > 0) parts.push(`${h}h`);
  if (m > 0) parts.push(`${m}m`);
  parts.push(`${s}s`);
  return parts.join(' ');
}

function formatBytes(bytes) {
  if (!bytes && bytes !== 0) return '—';
  if (bytes >= 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${bytes} B`;
}

export default function SettingsPage() {
  const dispatch = useDispatch();
  const { t } = useLocale();

  /* Schedule state (timezone + working days) */
  const { timezone, workingDays, saving: savingSchedule, saveSuccess } =
    useSelector((s) => s.schedule);
  const scheduleError = useSelector((s) => s.schedule.error);

  /* Settings state (system info, actions) */
  const { systemInfo, rebooting, resetting, syncing, error, actionSuccess,
    wifiNetworks, wifiScanning, wifiSaving,
    currentPin, pinLoading, pinSaving,
    clientCredentials, credentialsLoading, credentialsSaving, credentialsDeleting } =
    useSelector((s) => s.settings);

  /* Auth state (role check) */
  const user = useSelector((s) => s.auth.user);
  const isService = user?.role === 'service';

  const [wifiSsid, setWifiSsid] = useState('');
  const [wifiPassword, setWifiPassword] = useState('');
  const [showWifiPassword, setShowWifiPassword] = useState(false);
  const [wifiExpanded, setWifiExpanded] = useState(null);
  const [newPin, setNewPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [pinError, setPinError] = useState('');

  const [clientUsername, setClientUsername] = useState('');
  const [clientPassword, setClientPassword] = useState('');
  const [clientConfirmPassword, setClientConfirmPassword] = useState('');
  const [credentialError, setCredentialError] = useState('');

  useEffect(() => {
    dispatch(fetchSettings());
    dispatch(fetchSystemInfo());
    dispatch(fetchPin());
    if (isService) {
      dispatch(fetchCredentials());
    }
  }, [dispatch, isService]);

  useEffect(() => {
    if (saveSuccess) {
      const t = setTimeout(() => dispatch(clearSaveSuccess()), 3000);
      return () => clearTimeout(t);
    }
  }, [saveSuccess, dispatch]);

  useEffect(() => {
    if (actionSuccess) {
      const t = setTimeout(() => dispatch(clearActionSuccess()), 4000);
      return () => clearTimeout(t);
    }
  }, [actionSuccess, dispatch]);

  const toggleDay = (d) => {
    const next = workingDays.includes(d)
      ? workingDays.filter((x) => x !== d)
      : [...workingDays, d].sort();
    dispatch(setWorkingDays(next));
  };

  const handleSaveSettings = () => {
    dispatch(saveSettings({ timezone, workingDays }));
  };

  const handleScanWifi = () => {
    dispatch(scanWifiNetworks());
  };

  const handleSelectNetwork = (network) => {
    const id = network.bssid || network.ssid;
    if (wifiExpanded === id) {
      setWifiExpanded(null);
      setWifiPassword('');
      setShowWifiPassword(false);
    } else {
      setWifiExpanded(id);
      setWifiSsid(network.ssid);
      setWifiPassword('');
      setShowWifiPassword(false);
    }
  };

  const handleSaveWifi = () => {
    if (!wifiSsid.trim()) return;
    if (!window.confirm(t('settings.wifiConfirm', { ssid: wifiSsid.trim() }))) return;
    dispatch(saveWifiCredentials({ ssid: wifiSsid.trim(), password: wifiPassword })).then((result) => {
      if (result.meta.requestStatus === 'fulfilled') {
        TokenManager.clearStoredToken();
        setTimeout(() => window.location.reload(), 5000);
      }
    });
  };

  const handleReboot = () => {
    if (!window.confirm(t('settings.rebootConfirm'))) return;
    dispatch(rebootDevice()).then((result) => {
      if (result.meta.requestStatus === 'fulfilled') {
        // Clear session so the user must log in again after reboot
        TokenManager.clearStoredToken();
        setTimeout(() => window.location.reload(), 3000);
      }
    });
  };

  const handleFactoryReset = () => {
    if (!window.confirm(t('settings.factoryResetConfirm'))) return;
    dispatch(factoryReset()).then((result) => {
      if (result.meta.requestStatus === 'fulfilled') {
        // Reload fresh data from device after reset
        dispatch(fetchSettings());
        dispatch(fetchSystemInfo());
      }
    });
  };

  const handleSavePin = () => {
    setPinError('');
    if (!/^\d{4,6}$/.test(newPin)) {
      setPinError(t('settings.pinInvalidFormat'));
      return;
    }
    if (newPin !== confirmPin) {
      setPinError(t('settings.pinMismatch'));
      return;
    }
    dispatch(savePin(newPin)).then((result) => {
      if (result.meta.requestStatus === 'fulfilled') {
        setNewPin('');
        setConfirmPin('');
        dispatch(fetchPin());
      }
    });
  };

  const handleSaveCredentials = () => {
    setCredentialError('');
    if (!clientUsername.trim() || clientUsername.trim().length > 31) {
      setCredentialError(t('settings.credUsernameInvalid'));
      return;
    }
    if (clientPassword.length < 8) {
      setCredentialError(t('settings.credPasswordMin'));
      return;
    }
    if (clientPassword !== clientConfirmPassword) {
      setCredentialError(t('settings.credPasswordMismatch'));
      return;
    }
    dispatch(saveCredentials({ username: clientUsername.trim(), password: clientPassword })).then((result) => {
      if (result.meta.requestStatus === 'fulfilled') {
        setClientUsername('');
        setClientPassword('');
        setClientConfirmPassword('');
        dispatch(fetchCredentials());
      }
    });
  };

  const handleDeleteCredentials = () => {
    if (!window.confirm(t('settings.credDeleteConfirm'))) return;
    dispatch(deleteCredentials()).then((result) => {
      if (result.meta.requestStatus === 'fulfilled') {
        setClientUsername('');
        setClientPassword('');
        setClientConfirmPassword('');
      }
    });
  };

  const combinedError = error || scheduleError;

  return (
    <div className="settings-page">
      {combinedError && (
        <div className="error-message">
          {combinedError}
          <button className="error-dismiss" onClick={() => { dispatch(clearError()); dispatch(clearScheduleError()); }}>×</button>
        </div>
      )}
      {saveSuccess && <div className="success-message">{t('settings.settingsSaved')}</div>}
      {actionSuccess && <div className="success-message">{actionSuccess}</div>}

      {/* General Settings */}
      <div className="sched-card">
        <h3>{t('settings.generalSettings')}</h3>

        <div className="settings-section">
          <h4>{t('settings.workingDays')}</h4>
          <p className="card-desc">{t('settings.workingDaysDesc')}</p>

          <div className="day-picker">
            {ORDERED_DAYS.map((idx) => (
              <button
                key={idx}
                className={`day-btn ${workingDays.includes(idx) ? 'active' : ''}`}
                onClick={() => toggleDay(idx)}
              >
                {t(`settings.days.${idx}`)}
              </button>
            ))}
          </div>

          <div className="day-legend">
            <span className="legend-item"><span className="legend-swatch legend-active"></span> {t('settings.legendWorking')}</span>
            <span className="legend-item"><span className="legend-swatch legend-inactive"></span> {t('settings.legendOff')}</span>
          </div>
        </div>

        <div className="settings-section">
          <h4>{t('settings.timezone')}</h4>
          <div className="settings-row">
            <TimezonePicker
              value={timezone}
              onChange={(tz) => dispatch(setTimezone(tz))}
            />
            <span className="field-hint">{t('settings.timezoneHint')}</span>
          </div>
        </div>

        <button className={`save-button${savingSchedule ? ' loading' : ''}`} onClick={handleSaveSettings} disabled={savingSchedule}>
          {savingSchedule ? t('settings.saving') : t('settings.saveSettings')}
        </button>
      </div>

      {/* Touchscreen PIN */}
      <div className="sched-card">
        <h3>{t('settings.pinTitle')}</h3>
        <p className="card-desc">{t('settings.pinDesc')}</p>

        <div className="settings-section">
          <div className="settings-row">
            <label className="form-label">{t('settings.pinCurrent')}</label>
            <span className="info-value">
              {pinLoading ? '...' : (currentPin || '—')}
            </span>
          </div>
        </div>

        <div className="settings-section" style={{ borderBottom: 'none', marginBottom: 0 }}>
          <h4>{t('settings.pinChange')}</h4>
          {pinError && <div className="error-message" style={{ marginBottom: 8 }}>{pinError}</div>}
          <div className="settings-row">
            <label className="form-label">{t('settings.pinNew')}</label>
            <input
              type="text"
              className="form-input"
              inputMode="numeric"
              pattern="\d{4,6}"
              maxLength={6}
              value={newPin}
              onChange={(e) => { setNewPin(e.target.value.replace(/\D/g, '').slice(0, 6)); setPinError(''); }}
              placeholder={t('settings.pinPlaceholder')}
              disabled={pinSaving}
            />
          </div>
          <div className="settings-row">
            <label className="form-label">{t('settings.pinConfirm')}</label>
            <input
              type="text"
              className="form-input"
              inputMode="numeric"
              pattern="\d{4,6}"
              maxLength={6}
              value={confirmPin}
              onChange={(e) => { setConfirmPin(e.target.value.replace(/\D/g, '').slice(0, 6)); setPinError(''); }}
              placeholder={t('settings.pinPlaceholder')}
              disabled={pinSaving}
              onKeyDown={(e) => { if (e.key === 'Enter') handleSavePin(); }}
            />
          </div>
          <button
            className={`save-button${pinSaving ? ' loading' : ''}`}
            onClick={handleSavePin}
            disabled={pinSaving || newPin.length < 4 || confirmPin.length < 4}
          >
            {pinSaving ? t('settings.saving') : t('settings.pinSave')}
          </button>
        </div>
      </div>

      {/* User Management (service role only) */}
      {isService && (
        <div className="sched-card">
          <h3>{t('settings.credTitle')}</h3>
          <p className="card-desc">{t('settings.credDesc')}</p>

          <div className="settings-section">
            <div className="settings-row">
              <label className="form-label">{t('settings.credCurrentClient')}</label>
              <span className="info-value">
                {credentialsLoading ? '...' : (clientCredentials?.clientExists ? clientCredentials.clientUsername : t('settings.credNoAccount'))}
              </span>
            </div>
          </div>

          <div className="settings-section" style={{ borderBottom: 'none', marginBottom: 0 }}>
            <h4>{clientCredentials?.clientExists ? t('settings.credUpdate') : t('settings.credCreate')}</h4>
            {credentialError && <div className="error-message" style={{ marginBottom: 8 }}>{credentialError}</div>}
            <div className="settings-row">
              <label className="form-label">{t('settings.credUsername')}</label>
              <input
                type="text"
                className="form-input"
                maxLength={31}
                value={clientUsername}
                onChange={(e) => { setClientUsername(e.target.value); setCredentialError(''); }}
                placeholder={t('settings.credUsernamePlaceholder')}
                disabled={credentialsSaving}
              />
            </div>
            <div className="settings-row">
              <label className="form-label">{t('settings.credPassword')}</label>
              <input
                type="password"
                className="form-input"
                value={clientPassword}
                onChange={(e) => { setClientPassword(e.target.value); setCredentialError(''); }}
                placeholder={t('settings.credPasswordPlaceholder')}
                disabled={credentialsSaving}
              />
            </div>
            <div className="settings-row">
              <label className="form-label">{t('settings.credConfirmPassword')}</label>
              <input
                type="password"
                className="form-input"
                value={clientConfirmPassword}
                onChange={(e) => { setClientConfirmPassword(e.target.value); setCredentialError(''); }}
                placeholder={t('settings.credPasswordPlaceholder')}
                disabled={credentialsSaving}
                onKeyDown={(e) => { if (e.key === 'Enter') handleSaveCredentials(); }}
              />
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button
                className={`save-button${credentialsSaving ? ' loading' : ''}`}
                onClick={handleSaveCredentials}
                disabled={credentialsSaving}
              >
                {credentialsSaving ? t('settings.credSaving') : t('settings.credSave')}
              </button>
              {clientCredentials?.clientExists && (
                <button
                  className={`save-button danger${credentialsDeleting ? ' loading' : ''}`}
                  onClick={handleDeleteCredentials}
                  disabled={credentialsDeleting}
                >
                  {credentialsDeleting ? t('settings.credDeleting') : t('settings.credDelete')}
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* WiFi Credentials */}
      <div className="sched-card">
        <h3>{t('settings.wifiCredentials')}</h3>
        <p className="card-desc">{t('settings.wifiCredentialsDesc')}</p>

        <div className="settings-section">
          <button
            className={`save-button${wifiScanning ? ' loading' : ''}`}
            onClick={handleScanWifi}
            disabled={wifiScanning}
            style={{ marginBottom: 12 }}
          >
            {wifiScanning ? t('settings.wifiScanning') : t('settings.wifiScan')}
          </button>

          {wifiNetworks.length > 0 && (
            <div className="network-list">
              {[...wifiNetworks].sort((a, b) => b.rssi - a.rssi).map((network, idx) => {
                const networkId = network.bssid || `${network.ssid}-${idx}`;
                const isExpanded = wifiExpanded === networkId;
                return (
                  <div key={networkId} className={`network-item${isExpanded ? ' expanded' : ''}`}>
                    <div
                      className="network-item-header"
                      onClick={() => handleSelectNetwork({ ...network, bssid: networkId })}
                    >
                      <span className="network-ssid">
                        {network.ssid || t('settings.wifiHidden')}
                      </span>
                      <span className="network-info">
                        {network.secured && <span className="lock-icon">🔒</span>}
                        <span className="wifi-rssi">{network.rssi} dBm</span>
                        <span className="expand-arrow">{isExpanded ? '▲' : '▼'}</span>
                      </span>
                    </div>
                    {isExpanded && (
                      <div className="network-item-body">
                        {network.secured && (
                          <div className="password-input-container" style={{ marginBottom: 8 }}>
                            <input
                              type={showWifiPassword ? 'text' : 'password'}
                              className="form-input"
                              value={wifiPassword}
                              onChange={(e) => setWifiPassword(e.target.value)}
                              placeholder={t('settings.wifiEnterPassword')}
                              disabled={wifiSaving}
                              onKeyDown={(e) => { if (e.key === 'Enter') handleSaveWifi(); }}
                            />
                            <button
                              type="button"
                              className="password-toggle"
                              onClick={() => setShowWifiPassword(!showWifiPassword)}
                              disabled={wifiSaving}
                            >
                              {showWifiPassword ? '👁️' : '👁️‍🗨️'}
                            </button>
                          </div>
                        )}
                        <button
                          className={`save-button${wifiSaving ? ' loading' : ''}`}
                          onClick={handleSaveWifi}
                          disabled={wifiSaving || (network.secured && !wifiPassword)}
                        >
                          {wifiSaving ? t('settings.wifiSaving') : t('settings.wifiSave')}
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div className="settings-section" style={{ borderBottom: 'none', marginBottom: 0 }}>
          <h4>{t('settings.wifiManual')}</h4>
          <div className="settings-row">
            <label className="form-label">{t('settings.wifiSsidLabel')}</label>
            <input
              type="text"
              className="form-input"
              value={wifiSsid}
              onChange={(e) => { setWifiSsid(e.target.value); setWifiExpanded(null); }}
              placeholder={t('settings.wifiSsidPlaceholder')}
              disabled={wifiSaving}
            />
          </div>
          <div className="settings-row">
            <label className="form-label">{t('settings.wifiPasswordLabel')}</label>
            <div className="password-input-container">
              <input
                type={showWifiPassword ? 'text' : 'password'}
                className="form-input"
                value={wifiPassword}
                onChange={(e) => setWifiPassword(e.target.value)}
                placeholder={t('settings.wifiEnterPassword')}
                disabled={wifiSaving}
                onKeyDown={(e) => { if (e.key === 'Enter') handleSaveWifi(); }}
              />
              <button
                type="button"
                className="password-toggle"
                onClick={() => setShowWifiPassword(!showWifiPassword)}
                disabled={wifiSaving}
              >
                {showWifiPassword ? '👁️' : '👁️‍🗨️'}
              </button>
            </div>
          </div>
          <button
            className={`save-button${wifiSaving ? ' loading' : ''}`}
            onClick={handleSaveWifi}
            disabled={wifiSaving || !wifiSsid.trim()}
          >
            {wifiSaving ? t('settings.wifiSaving') : t('settings.wifiSave')}
          </button>
        </div>
      </div>

      {/* Time Synchronization */}
      <div className="sched-card">
        <h3>{t('settings.timeSection')}</h3>
        <p className="card-desc">{t('settings.timeSectionDesc')}</p>

        <div className="info-grid">
          <div className="info-item">
            <span className="info-label">{t('settings.sntpStatus')}</span>
            <span className={`info-value ${systemInfo && !systemInfo.timeSynced ? 'text-warn' : ''}`}>
              {systemInfo ? (systemInfo.timeSynced ? t('settings.synchronized') : t('settings.notSynchronized')) : '—'}
              {systemInfo?.lastSyncAgeSec != null && systemInfo.lastSyncAgeSec < 4294967295
                ? ` (${Math.floor(systemInfo.lastSyncAgeSec / 60)}m ago)`
                : ''}
            </span>
          </div>
          <div className="info-item">
            <span className="info-label">{t('settings.deviceTime')}</span>
            <span className="info-value">{systemInfo?.time || '—'}</span>
          </div>
          <div className="info-item">
            <span className="info-label">{t('settings.date')}</span>
            <span className="info-value">{systemInfo?.date || '—'}</span>
          </div>
        </div>

        <div style={{ display: 'flex', gap: 12, marginTop: 16 }}>
          <button
            className={`save-button${syncing ? ' loading' : ''}`}
            onClick={() => { dispatch(syncTime()).then(() => dispatch(fetchSystemInfo())); }}
            disabled={syncing}
          >
            {syncing ? t('settings.syncing') : t('settings.syncNow')}
          </button>
        </div>
      </div>

      {/* System Actions */}
      <div className="sched-card">
        <h3>{t('settings.systemActions')}</h3>

        <div className="system-actions">
          <div className="system-action-item">
            <div className="action-info">
              <strong>{t('settings.reboot')}</strong>
              <p className="card-desc">{t('settings.rebootDesc')}</p>
            </div>
            <button
              className={`save-button action-btn${rebooting ? ' loading' : ''}`}
              onClick={handleReboot}
              disabled={rebooting || resetting}
            >
              {rebooting ? t('settings.rebooting') : t('settings.rebootBtn')}
            </button>
          </div>

          <div className="system-action-item system-action-danger">
            <div className="action-info">
              <strong>{t('settings.factoryReset')}</strong>
              <p className="card-desc">{t('settings.factoryResetDesc')}</p>
            </div>
            <button
              className={`save-button action-btn danger-btn${resetting ? ' loading' : ''}`}
              onClick={handleFactoryReset}
              disabled={rebooting || resetting}
            >
              {resetting ? t('settings.resetting') : t('settings.factoryResetBtn')}
            </button>
          </div>
        </div>
      </div>

      {/* System Information */}
      <div className="sched-card">
        <h3>{t('settings.systemInfo')}</h3>

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
            <span className="info-label">{t('settings.sntpStatus')}</span>
            <span className={`info-value ${systemInfo && !systemInfo.timeSynced ? 'text-warn' : ''}`}>
              {systemInfo ? (systemInfo.timeSynced ? t('settings.synchronized') : t('settings.notSynchronized')) : '—'}
              {systemInfo?.lastSyncAgeSec != null && systemInfo.lastSyncAgeSec < 4294967295
                ? ` (${Math.floor(systemInfo.lastSyncAgeSec / 60)}m ago)`
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
            <span className="info-label">{t('settings.freeHeap')}</span>
            <span className="info-value">{formatBytes(systemInfo?.freeHeap)}</span>
          </div>
          <div className="info-item">
            <span className="info-label">{t('settings.minFreeHeap')}</span>
            <span className="info-value">{formatBytes(systemInfo?.minFreeHeap)}</span>
          </div>
          <div className="info-item">
            <span className="info-label">{t('settings.cpuCores')}</span>
            <span className="info-value">{systemInfo?.chipCores ?? '—'}</span>
          </div>
          <div className="info-item">
            <span className="info-label">{t('settings.idfVersion')}</span>
            <span className="info-value">{systemInfo?.idfVersion || '—'}</span>
          </div>
        </div>

        <div style={{ display: 'flex', gap: 12, marginTop: 16 }}>
          <button
            className="refresh-btn"
            onClick={() => dispatch(fetchSystemInfo())}
          >
            {t('settings.refresh')}
          </button>
        </div>
      </div>
    </div>
  );
}
