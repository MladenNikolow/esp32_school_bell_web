// src/features/Schedule/components/BellTimesEditor.jsx
import React, { useState, useEffect } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { saveBells } from '../ScheduleSlice.js';

function emptyBell() {
  return { hour: 8, minute: 0, durationSec: 3, label: '' };
}

export default function BellTimesEditor() {
  const dispatch = useDispatch();
  const { bells } = useSelector((state) => state.schedule);
  const [items, setItems] = useState(bells);
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    setItems(bells);
    setDirty(false);
  }, [bells]);

  const update = (idx, field, value) => {
    const next = items.map((b, i) => (i === idx ? { ...b, [field]: value } : b));
    setItems(next);
    setDirty(true);
  };

  const addBell = () => {
    setItems([...items, emptyBell()]);
    setDirty(true);
  };

  const removeBell = (idx) => {
    setItems(items.filter((_, i) => i !== idx));
    setDirty(true);
  };

  const handleSave = () => {
    const cleaned = items.map((b) => ({
      hour: Math.min(23, Math.max(0, Number(b.hour) || 0)),
      minute: Math.min(59, Math.max(0, Number(b.minute) || 0)),
      durationSec: Math.max(1, Number(b.durationSec) || 3),
      label: (b.label || '').slice(0, 31),
    }));
    dispatch(saveBells({ bells: cleaned }));
    setDirty(false);
  };

  return (
    <div className="schedule-section">
      <h3>Bell Times</h3>
      <div className="bell-list">
        {items.map((bell, idx) => (
          <div className="bell-row" key={idx}>
            <input
              type="number"
              className="time-input"
              min={0}
              max={23}
              value={bell.hour}
              onChange={(e) => update(idx, 'hour', e.target.value)}
              title="Hour"
            />
            <span className="time-sep">:</span>
            <input
              type="number"
              className="time-input"
              min={0}
              max={59}
              value={bell.minute}
              onChange={(e) => update(idx, 'minute', e.target.value)}
              title="Minute"
            />
            <input
              type="number"
              className="duration-input"
              min={1}
              value={bell.durationSec}
              onChange={(e) => update(idx, 'durationSec', e.target.value)}
              title="Duration (sec)"
            />
            <input
              type="text"
              className="label-input"
              maxLength={31}
              value={bell.label}
              onChange={(e) => update(idx, 'label', e.target.value)}
              placeholder="Label"
            />
            <button className="remove-button" onClick={() => removeBell(idx)} title="Remove">
              &times;
            </button>
          </div>
        ))}
      </div>
      <div className="bell-actions">
        <button className="add-button" onClick={addBell}>+ Add Bell</button>
        {dirty && (
          <button className="save-button" onClick={handleSave}>Save Bells</button>
        )}
      </div>
    </div>
  );
}
