import React, { useEffect, useRef, useCallback, useState } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { fetchBellStatus, togglePanic, clearError } from './DashboardSlice.js';
import { testBell } from '../Settings/SettingsSlice.js';
import DeviceClock from './DeviceClock.jsx';
import useLocale from '../../hooks/useLocale.jsx';

const BELL_STATE_CLASS = {
  idle: 'status-idle',
  ringing: 'status-ringing',
  panic: 'status-panic',
};

export default function DashboardPage() {
  const dispatch = useDispatch();
  const { bellState, panicMode, dayType, timeSynced, lastSyncAgeSec, currentTime, currentDate, nextBell, error } =
    useSelector((s) => s.dashboard);
  const { t } = useLocale();
  const [confirmPanic, setConfirmPanic] = useState(false);
  const [testDuration, setTestDuration] = useState(3);
  const [bellFeedback, setBellFeedback] = useState(null);
  const { testingBell } = useSelector((s) => s.settings);
  const intervalRef = useRef(null);

  const refresh = useCallback(() => {
    dispatch(fetchBellStatus());
  }, [dispatch]);

  useEffect(() => {
    refresh();
    intervalRef.current = setInterval(refresh, 5000);
    return () => clearInterval(intervalRef.current);
  }, [refresh]);

  const handlePanicToggle = () => {
    if (!panicMode) {
      setConfirmPanic(true);
    } else {
      dispatch(togglePanic(false));
    }
  };

  const confirmPanicEnable = () => {
    dispatch(togglePanic(true));
    setConfirmPanic(false);
  };

  const stateClassName = BELL_STATE_CLASS[bellState] || BELL_STATE_CLASS.idle;
  const stateLabel = t(`bellState.${bellState || 'idle'}`);

  /* Derive day-of-week from currentDate (YYYY-MM-DD) */
  let dayOfWeek = '';
  if (currentDate && /^\d{4}-\d{2}-\d{2}$/.test(currentDate)) {
    const d = new Date(currentDate + 'T00:00:00');
    dayOfWeek = t(`clock.days.${d.getDay()}`);
  }

  return (
    <div className="dashboard-page">
      {error && (
        <div className="error-message">
          {error}
          <button className="error-dismiss" onClick={() => dispatch(clearError())}>x</button>
        </div>
      )}

      <div className="dash-grid">
        {/* Row 1: Today + Date & Time (combined, full width) */}
        <DeviceClock
          serverTime={currentTime}
          serverDate={currentDate}
          timeSynced={timeSynced}
          lastSyncAgeSec={lastSyncAgeSec}
          dayOfWeek={dayOfWeek}
          dayType={dayType}
          dayTypeLabel={t(`dayType.${dayType}`) || dayType}
        />

        {/* Row 2: Bell Status */}
        <div className="dash-card">
          <h3>{t('dashboard.bellStatus')}</h3>
          <div className={`bell-status-indicator ${stateClassName}`}>
            <span className="bell-status-dot"></span>
            <span className="bell-status-label">{stateLabel}</span>
          </div>
        </div>

        {/* Row 2: Next Bell */}
        <div className="dash-card">
          <h3>{t('dashboard.nextBell')}</h3>
          {nextBell ? (
            <div className="next-bell-info">
              <div className="next-bell-time">{nextBell.time}</div>
              <div className="next-bell-duration">{t('dashboard.ringDuration', { duration: nextBell.durationSec })}</div>
            </div>
          ) : (
            <div className="next-bell-none">{t('dashboard.noUpcoming')}</div>
          )}
        </div>
      </div>

      {/* Activate Bell */}
      <div className="dash-card activate-bell-card">
        <h3>{t('dashboard.activateBell')}</h3>
        <p className="panic-desc">{t('dashboard.activateBellDesc')}</p>
        <div className="test-duration-control" style={{ marginBottom: 12 }}>
          <label className="form-label" style={{ margin: 0, fontSize: 13 }}>{t('dashboard.testDuration')}</label>
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
        <button
          className={`save-button test-bell-btn${testingBell ? ' loading' : ''}`}
          onClick={() => {
            setBellFeedback(null);
            dispatch(testBell(testDuration)).then((result) => {
              if (result.meta.requestStatus === 'fulfilled') {
                setTimeout(() => dispatch(fetchBellStatus()), (testDuration * 1000) + 500);
              } else {
                setBellFeedback('error');
                setTimeout(() => setBellFeedback(null), 4000);
              }
            });
          }}
          disabled={testingBell}
        >
          {testingBell ? t('dashboard.bellRinging') : `🔔 ${t('dashboard.activateBell')}`}
        </button>
        {bellFeedback === 'error' && <div className="error-message" style={{ marginTop: 10 }}>{t('dashboard.bellError')}</div>}
      </div>

      {/* Panic Control */}
      <div className="dash-card panic-card">
        <h3>{t('dashboard.panicMode')}</h3>
        <p className="panic-desc">
          {panicMode
            ? t('dashboard.panicActive')
            : t('dashboard.panicIdle')}
        </p>
        <button
          className={`panic-btn ${panicMode ? 'panic-active' : ''}`}
          onClick={handlePanicToggle}
        >
          {panicMode ? t('dashboard.stopPanic') : t('dashboard.activatePanic')}
        </button>
      </div>

      {/* Confirmation Dialog */}
      {confirmPanic && (
        <div className="modal-overlay" onClick={() => setConfirmPanic(false)}>
          <div className="modal-dialog" onClick={(e) => e.stopPropagation()}>
            <h3>{t('dashboard.confirmPanicTitle')}</h3>
            <p>{t('dashboard.confirmPanicMsg')}</p>
            <div className="modal-actions">
              <button className="modal-cancel" onClick={() => setConfirmPanic(false)}>{t('dashboard.cancel')}</button>
              <button className="panic-btn" onClick={confirmPanicEnable}>{t('dashboard.activate')}</button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
