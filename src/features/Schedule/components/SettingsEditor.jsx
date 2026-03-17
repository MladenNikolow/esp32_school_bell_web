// src/features/Schedule/components/SettingsEditor.jsx
import React, { useState, useEffect } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { saveSettings } from '../ScheduleSlice.js';

const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export default function SettingsEditor() {
  const dispatch = useDispatch();
  const { settings } = useSelector((state) => state.schedule);
  const [timezone, setTimezone] = useState(settings.timezone);
  const [workingDays, setWorkingDays] = useState(settings.workingDays);
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    setTimezone(settings.timezone);
    setWorkingDays(settings.workingDays);
    setDirty(false);
  }, [settings]);

  const toggleDay = (idx) => {
    const next = [...workingDays];
    next[idx] = !next[idx];
    setWorkingDays(next);
    setDirty(true);
  };

  const handleSave = () => {
    dispatch(saveSettings({ timezone, workingDays }));
    setDirty(false);
  };

  return (
    <div className="schedule-section">
      <h3>Settings</h3>
      <div className="settings-form">
        <label className="settings-field">
          <span>Timezone</span>
          <input
            type="text"
            value={timezone}
            onChange={(e) => { setTimezone(e.target.value); setDirty(true); }}
            placeholder="e.g. CET-1CEST,M3.5.0,M10.5.0/3"
          />
        </label>
        <div className="working-days">
          <span>Working Days</span>
          <div className="day-toggles">
            {DAY_NAMES.map((name, i) => (
              <button
                key={name}
                className={`day-toggle ${workingDays[i] ? 'day-active' : ''}`}
                onClick={() => toggleDay(i)}
              >
                {name}
              </button>
            ))}
          </div>
        </div>
        {dirty && (
          <button className="save-button" onClick={handleSave}>
            Save Settings
          </button>
        )}
      </div>
    </div>
  );
}
