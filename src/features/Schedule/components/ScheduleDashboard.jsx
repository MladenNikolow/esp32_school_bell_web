// src/features/Schedule/components/ScheduleDashboard.jsx
import React, { useEffect, useRef } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import {
  fetchSettings,
  fetchBells,
  clearError,
} from '../ScheduleSlice.js';
import {
  fetchBellStatus,
  fetchSystemTime,
} from '../../Dashboard/DashboardSlice.js';
import BellStatusPanel from './BellStatusPanel.jsx';
import SettingsEditor from './SettingsEditor.jsx';
import BellTimesEditor from './BellTimesEditor.jsx';
import HolidaysEditor from './HolidaysEditor.jsx';

const STATUS_POLL_MS = 5000;

export default function ScheduleDashboard() {
  const dispatch = useDispatch();
  const { error, isLoading } = useSelector((state) => state.schedule);
  const intervalRef = useRef(null);

  // Initial data load
  useEffect(() => {
    dispatch(fetchSettings());
    dispatch(fetchBells());
    dispatch(fetchBellStatus());
    dispatch(fetchSystemTime());
  }, [dispatch]);

  // Poll bell status
  useEffect(() => {
    intervalRef.current = setInterval(() => {
      dispatch(fetchBellStatus());
      dispatch(fetchSystemTime());
    }, STATUS_POLL_MS);
    return () => clearInterval(intervalRef.current);
  }, [dispatch]);

  return (
    <div className="schedule-dashboard">
      {error && (
        <div className="schedule-error">
          <span>{error}</span>
          <button onClick={() => dispatch(clearError())}>Dismiss</button>
        </div>
      )}

      {isLoading && <div className="schedule-loading">Saving...</div>}

      <BellStatusPanel />

      <div className="schedule-sections">
        <SettingsEditor />
        <BellTimesEditor />
        <HolidaysEditor />
      </div>
    </div>
  );
}
