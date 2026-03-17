// src/features/Schedule/components/BellStatusPanel.jsx
import React from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { setPanic } from '../ScheduleSlice.js';

const STATE_LABELS = { idle: 'Idle', ringing: 'Ringing', panic: 'PANIC' };
const DAY_LABELS = {
  off: 'Day Off',
  working: 'Working Day',
  holiday: 'Holiday',
  exceptionWorking: 'Exception Working',
  exceptionHoliday: 'Exception Holiday',
};

export default function BellStatusPanel() {
  const dispatch = useDispatch();
  const { bellStatus, systemTime } = useSelector((state) => state.schedule);

  const stateClass =
    bellStatus.bellState === 'panic'
      ? 'status-panic'
      : bellStatus.bellState === 'ringing'
        ? 'status-ringing'
        : 'status-idle';

  const handlePanicToggle = () => {
    dispatch(setPanic(!bellStatus.panicMode));
  };

  return (
    <div className={`bell-status-panel ${stateClass}`}>
      <div className="status-row">
        <div className="status-item">
          <span className="status-label">Bell State</span>
          <span className="status-value">{STATE_LABELS[bellStatus.bellState] || bellStatus.bellState}</span>
        </div>
        <div className="status-item">
          <span className="status-label">Day Type</span>
          <span className="status-value">{DAY_LABELS[bellStatus.dayType] || bellStatus.dayType}</span>
        </div>
        <div className="status-item">
          <span className="status-label">Device Time</span>
          <span className="status-value">{systemTime?.time || '--:--:--'}</span>
        </div>
        {bellStatus.nextBell && (
          <div className="status-item">
            <span className="status-label">Next Bell</span>
            <span className="status-value">
              {bellStatus.nextBell.time}
              {bellStatus.nextBell.label ? ` (${bellStatus.nextBell.label})` : ''}
            </span>
          </div>
        )}
      </div>
      <div className="panic-control">
        <button
          className={`panic-button ${bellStatus.panicMode ? 'panic-active' : ''}`}
          onClick={handlePanicToggle}
        >
          {bellStatus.panicMode ? 'STOP PANIC' : 'PANIC'}
        </button>
      </div>
    </div>
  );
}
