// src/features/Schedule/components/HolidaysEditor.jsx
import React, { useState, useEffect } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { saveHolidays } from '../ScheduleSlice.js';

function emptyHoliday() {
  const today = new Date().toISOString().slice(0, 10);
  return { startDate: today, endDate: today, label: '' };
}

export default function HolidaysEditor() {
  const dispatch = useDispatch();
  const { holidays } = useSelector((state) => state.schedule);
  const [items, setItems] = useState(holidays);
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    setItems(holidays);
    setDirty(false);
  }, [holidays]);

  const update = (idx, field, value) => {
    const next = items.map((h, i) => (i === idx ? { ...h, [field]: value } : h));
    setItems(next);
    setDirty(true);
  };

  const addHoliday = () => {
    setItems([...items, emptyHoliday()]);
    setDirty(true);
  };

  const removeHoliday = (idx) => {
    setItems(items.filter((_, i) => i !== idx));
    setDirty(true);
  };

  const handleSave = () => {
    dispatch(saveHolidays({ holidays: items }));
    setDirty(false);
  };

  return (
    <div className="schedule-section">
      <h3>Holiday Ranges</h3>
      <div className="holiday-list">
        {items.map((hol, idx) => (
          <div className="holiday-row" key={idx}>
            <input
              type="date"
              value={hol.startDate}
              onChange={(e) => update(idx, 'startDate', e.target.value)}
              title="Start date"
            />
            <span className="date-sep">to</span>
            <input
              type="date"
              value={hol.endDate}
              onChange={(e) => update(idx, 'endDate', e.target.value)}
              title="End date"
            />
            <input
              type="text"
              className="label-input"
              maxLength={31}
              value={hol.label}
              onChange={(e) => update(idx, 'label', e.target.value)}
              placeholder="Label"
            />
            <button className="remove-button" onClick={() => removeHoliday(idx)} title="Remove">
              &times;
            </button>
          </div>
        ))}
      </div>
      <div className="holiday-actions">
        <button className="add-button" onClick={addHoliday}>+ Add Holiday</button>
        {dirty && (
          <button className="save-button" onClick={handleSave}>Save Holidays</button>
        )}
      </div>
    </div>
  );
}
