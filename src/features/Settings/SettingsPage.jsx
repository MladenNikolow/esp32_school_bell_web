import React, { useEffect, useState } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import {
  fetchSettings, saveSettings,
  setWorkingDays, setTimezone,
  clearError as clearScheduleError,
  clearSaveSuccess,
} from '../Schedule/ScheduleSlice.js';
import {
  fetchSystemInfo, testBell, rebootDevice, factoryReset,
  clearError, clearActionSuccess,
} from './SettingsSlice.js';
import TokenManager from '../../utils/TokenManager.js';
import TimezonePicker from '../Schedule/TimezonePicker.jsx';

const ORDERED_DAYS = [
  { idx: 1, name: 'Mon' },
  { idx: 2, name: 'Tue' },
  { idx: 3, name: 'Wed' },
  { idx: 4, name: 'Thu' },
  { idx: 5, name: 'Fri' },
  { idx: 6, name: 'Sat' },
  { idx: 0, name: 'Sun' },
];

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

  /* Schedule state (timezone + working days) */
  const { timezone, workingDays, saving: savingSchedule, saveSuccess } =
    useSelector((s) => s.schedule);
  const scheduleError = useSelector((s) => s.schedule.error);

  /* Settings state (system info, actions) */
  const { systemInfo, testingBell, rebooting, resetting, error, actionSuccess } =
    useSelector((s) => s.settings);

  const [testDuration, setTestDuration] = useState(3);

  useEffect(() => {
    dispatch(fetchSettings());
    dispatch(fetchSystemInfo());
  }, [dispatch]);

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

  const handleTestBell = () => {
    dispatch(testBell(testDuration));
  };

  const handleReboot = () => {
    if (!window.confirm('Reboot the device? The connection will be lost and you will need to log in again.')) return;
    dispatch(rebootDevice()).then((result) => {
      if (result.meta.requestStatus === 'fulfilled') {
        // Clear session so the user must log in again after reboot
        TokenManager.clearStoredToken();
        setTimeout(() => window.location.reload(), 3000);
      }
    });
  };

  const handleFactoryReset = () => {
    if (!window.confirm(
      'Reset ALL settings to factory defaults?\n\n' +
      'This will restore the default timezone, working days, bell schedules, ' +
      'holidays, and exceptions. This action cannot be undone.'
    )) return;
    dispatch(factoryReset()).then((result) => {
      if (result.meta.requestStatus === 'fulfilled') {
        // Reload fresh data from device after reset
        dispatch(fetchSettings());
        dispatch(fetchSystemInfo());
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
      {saveSuccess && <div className="success-message">Settings saved</div>}
      {actionSuccess && <div className="success-message">{actionSuccess}</div>}

      {/* General Settings */}
      <div className="sched-card">
        <h3>General Settings</h3>

        <div className="settings-section">
          <h4>Working Days</h4>
          <p className="card-desc">Select the days when bells should ring on a normal week.</p>

          <div className="day-picker">
            {ORDERED_DAYS.map(({ idx, name }) => (
              <button
                key={idx}
                className={`day-btn ${workingDays.includes(idx) ? 'active' : ''}`}
                onClick={() => toggleDay(idx)}
              >
                {name}
              </button>
            ))}
          </div>

          <div className="day-legend">
            <span className="legend-item"><span className="legend-swatch legend-active"></span> Working day — bells will ring</span>
            <span className="legend-item"><span className="legend-swatch legend-inactive"></span> Day off — no bells</span>
          </div>
        </div>

        <div className="settings-section">
          <h4>Timezone</h4>
          <div className="settings-row">
            <TimezonePicker
              value={timezone}
              onChange={(tz) => dispatch(setTimezone(tz))}
            />
            <span className="field-hint">Defines the local time used for bell scheduling and display.</span>
          </div>
        </div>

        <button className="save-button" onClick={handleSaveSettings} disabled={savingSchedule}>
          {savingSchedule ? 'Saving...' : 'Save Settings'}
        </button>
      </div>

      {/* Bell Test */}
      <div className="sched-card">
        <h3>Bell Test</h3>
        <p className="card-desc">Ring the bell to verify the relay connection works correctly.</p>

        <div className="settings-row">
          <label className="form-label">Test Duration</label>
          <div className="test-duration-control">
            <input
              type="range"
              className="duration-slider"
              min="1"
              max="30"
              value={testDuration}
              onChange={(e) => setTestDuration(parseInt(e.target.value))}
            />
            <span className="test-duration-value">{testDuration}s</span>
          </div>
        </div>

        <button
          className="save-button test-bell-btn"
          onClick={handleTestBell}
          disabled={testingBell || rebooting}
        >
          {testingBell ? 'Ringing...' : '🔔 Test Bell'}
        </button>
      </div>

      {/* System Information */}
      <div className="sched-card">
        <h3>System Information</h3>

        <div className="info-grid">
          <div className="info-item">
            <span className="info-label">Device Time</span>
            <span className="info-value">{systemInfo?.time || '—'}</span>
          </div>
          <div className="info-item">
            <span className="info-label">Date</span>
            <span className="info-value">{systemInfo?.date || '—'}</span>
          </div>
          <div className="info-item">
            <span className="info-label">SNTP Status</span>
            <span className={`info-value ${systemInfo && !systemInfo.timeSynced ? 'text-warn' : ''}`}>
              {systemInfo ? (systemInfo.timeSynced ? 'Synchronized' : 'Not Synchronized') : '—'}
            </span>
          </div>
          <div className="info-item">
            <span className="info-label">Active Timezone</span>
            <span className="info-value">{systemInfo?.timezone || '—'}</span>
          </div>
          <div className="info-item">
            <span className="info-label">Uptime</span>
            <span className="info-value">{formatUptime(systemInfo?.uptimeSec)}</span>
          </div>
          <div className="info-item">
            <span className="info-label">Free Heap</span>
            <span className="info-value">{formatBytes(systemInfo?.freeHeap)}</span>
          </div>
          <div className="info-item">
            <span className="info-label">Min Free Heap</span>
            <span className="info-value">{formatBytes(systemInfo?.minFreeHeap)}</span>
          </div>
          <div className="info-item">
            <span className="info-label">CPU Cores</span>
            <span className="info-value">{systemInfo?.chipCores ?? '—'}</span>
          </div>
          <div className="info-item">
            <span className="info-label">ESP-IDF Version</span>
            <span className="info-value">{systemInfo?.idfVersion || '—'}</span>
          </div>
        </div>

        <button
          className="refresh-btn"
          onClick={() => dispatch(fetchSystemInfo())}
          style={{ marginTop: 16 }}
        >
          ↻ Refresh
        </button>
      </div>

      {/* System Actions */}
      <div className="sched-card">
        <h3>System Actions</h3>

        <div className="system-actions">
          <div className="system-action-item">
            <div className="action-info">
              <strong>Reboot Device</strong>
              <p className="card-desc">Restart the ESP32. The connection will be lost briefly.</p>
            </div>
            <button
              className="save-button action-btn"
              onClick={handleReboot}
              disabled={rebooting || resetting}
            >
              {rebooting ? 'Rebooting...' : 'Reboot'}
            </button>
          </div>

          <div className="system-action-item system-action-danger">
            <div className="action-info">
              <strong>Factory Reset</strong>
              <p className="card-desc">
                Restore all schedule settings to factory defaults. This resets timezone, working days,
                bell schedules, holidays, and exceptions.
              </p>
            </div>
            <button
              className="save-button action-btn danger-btn"
              onClick={handleFactoryReset}
              disabled={rebooting || resetting}
            >
              {resetting ? 'Resetting...' : 'Factory Reset'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
