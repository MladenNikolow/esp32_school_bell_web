import React, { useEffect, useRef, useCallback, useState } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { fetchBellStatus, togglePanic, clearError } from './DashboardSlice.js';
import DeviceClock from './DeviceClock.jsx';

const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

const DAY_TYPE_LABELS = {
  off: 'Weekend',
  working: 'Working Day',
  holiday: 'Holiday',
  exceptionWorking: 'Exception Working',
  exceptionHoliday: 'Exception Holiday',
};

const BELL_STATE_CONFIG = {
  idle: { label: 'Idle', className: 'status-idle' },
  ringing: { label: 'Ringing', className: 'status-ringing' },
  panic: { label: 'PANIC', className: 'status-panic' },
};

export default function DashboardPage() {
  const dispatch = useDispatch();
  const { bellState, panicMode, dayType, timeSynced, currentTime, currentDate, nextBell, error } =
    useSelector((s) => s.dashboard);
  const [confirmPanic, setConfirmPanic] = useState(false);
  const intervalRef = useRef(null);

  const refresh = useCallback(() => {
    dispatch(fetchBellStatus());
  }, [dispatch]);

  useEffect(() => {
    refresh();
    intervalRef.current = setInterval(refresh, 1000);
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

  const stateConfig = BELL_STATE_CONFIG[bellState] || BELL_STATE_CONFIG.idle;

  /* Derive day-of-week from currentDate (YYYY-MM-DD) */
  let dayOfWeek = '';
  if (currentDate && /^\d{4}-\d{2}-\d{2}$/.test(currentDate)) {
    const d = new Date(currentDate + 'T00:00:00');
    dayOfWeek = DAY_NAMES[d.getDay()] || '';
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
          dayOfWeek={dayOfWeek}
          dayType={dayType}
          dayTypeLabel={DAY_TYPE_LABELS[dayType] || dayType}
        />

        {/* Row 2: Bell Status */}
        <div className="dash-card">
          <h3>Bell Status</h3>
          <div className={`bell-status-indicator ${stateConfig.className}`}>
            <span className="bell-status-dot"></span>
            <span className="bell-status-label">{stateConfig.label}</span>
          </div>
        </div>

        {/* Row 2: Next Bell */}
        <div className="dash-card">
          <h3>Next Bell</h3>
          {nextBell ? (
            <div className="next-bell-info">
              <div className="next-bell-time">{nextBell.time}</div>
              <div className="next-bell-duration">Ring duration: {nextBell.durationSec}s</div>
            </div>
          ) : (
            <div className="next-bell-none">No upcoming bells</div>
          )}
        </div>
      </div>

      {/* Panic Control */}
      <div className="dash-card panic-card">
        <h3>Panic Mode</h3>
        <p className="panic-desc">
          {panicMode
            ? 'Bell is ringing continuously. Press to stop.'
            : 'Activate to ring the bell continuously.'}
        </p>
        <button
          className={`panic-btn ${panicMode ? 'panic-active' : ''}`}
          onClick={handlePanicToggle}
        >
          {panicMode ? 'Stop Panic' : 'Activate Panic'}
        </button>
      </div>

      {/* Confirmation Dialog */}
      {confirmPanic && (
        <div className="modal-overlay" onClick={() => setConfirmPanic(false)}>
          <div className="modal-dialog" onClick={(e) => e.stopPropagation()}>
            <h3>Confirm Panic Mode</h3>
            <p>This will ring the bell continuously until manually stopped. Continue?</p>
            <div className="modal-actions">
              <button className="modal-cancel" onClick={() => setConfirmPanic(false)}>Cancel</button>
              <button className="panic-btn" onClick={confirmPanicEnable}>Activate</button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
