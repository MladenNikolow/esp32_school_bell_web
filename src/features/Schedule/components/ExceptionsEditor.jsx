// src/features/Schedule/components/ExceptionsEditor.jsx
import React, { useState, useEffect } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { saveExceptions } from '../ScheduleSlice.js';

function emptyExWorking() {
  const today = new Date().toISOString().slice(0, 10);
  return { date: today, label: '', hasCustomBells: false, customBells: [] };
}

function emptyExHoliday() {
  const today = new Date().toISOString().slice(0, 10);
  return { date: today, label: '' };
}

function emptyBell() {
  return { hour: 8, minute: 0, durationSec: 3, label: '' };
}

export default function ExceptionsEditor() {
  const dispatch = useDispatch();
  const { exceptionWorking, exceptionHolidays } = useSelector((state) => state.schedule);
  const [workItems, setWorkItems] = useState(exceptionWorking);
  const [holItems, setHolItems] = useState(exceptionHolidays);
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    setWorkItems(exceptionWorking);
    setHolItems(exceptionHolidays);
    setDirty(false);
  }, [exceptionWorking, exceptionHolidays]);

  // Exception Working helpers
  const updateWork = (idx, field, value) => {
    setWorkItems(workItems.map((w, i) => (i === idx ? { ...w, [field]: value } : w)));
    setDirty(true);
  };

  const addCustomBell = (idx) => {
    const next = [...workItems];
    next[idx] = { ...next[idx], hasCustomBells: true, customBells: [...(next[idx].customBells || []), emptyBell()] };
    setWorkItems(next);
    setDirty(true);
  };

  const updateCustomBell = (wIdx, bIdx, field, value) => {
    const next = [...workItems];
    const bells = [...(next[wIdx].customBells || [])];
    bells[bIdx] = { ...bells[bIdx], [field]: value };
    next[wIdx] = { ...next[wIdx], customBells: bells };
    setWorkItems(next);
    setDirty(true);
  };

  const removeCustomBell = (wIdx, bIdx) => {
    const next = [...workItems];
    const bells = (next[wIdx].customBells || []).filter((_, i) => i !== bIdx);
    next[wIdx] = { ...next[wIdx], customBells: bells, hasCustomBells: bells.length > 0 };
    setWorkItems(next);
    setDirty(true);
  };

  const addExWorking = () => {
    setWorkItems([...workItems, emptyExWorking()]);
    setDirty(true);
  };

  const removeExWorking = (idx) => {
    setWorkItems(workItems.filter((_, i) => i !== idx));
    setDirty(true);
  };

  // Exception Holiday helpers
  const updateHol = (idx, field, value) => {
    setHolItems(holItems.map((h, i) => (i === idx ? { ...h, [field]: value } : h)));
    setDirty(true);
  };

  const addExHoliday = () => {
    setHolItems([...holItems, emptyExHoliday()]);
    setDirty(true);
  };

  const removeExHoliday = (idx) => {
    setHolItems(holItems.filter((_, i) => i !== idx));
    setDirty(true);
  };

  const handleSave = () => {
    dispatch(saveExceptions({
      exceptionWorking: workItems,
      exceptionHolidays: holItems,
    }));
    setDirty(false);
  };

  return (
    <div className="schedule-section">
      <h3>Exception Working Days</h3>
      <div className="exception-list">
        {workItems.map((ex, idx) => (
          <div className="exception-card" key={idx}>
            <div className="exception-row">
              <input
                type="date"
                value={ex.date}
                onChange={(e) => updateWork(idx, 'date', e.target.value)}
              />
              <input
                type="text"
                className="label-input"
                maxLength={31}
                value={ex.label}
                onChange={(e) => updateWork(idx, 'label', e.target.value)}
                placeholder="Label"
              />
              <button className="remove-button" onClick={() => removeExWorking(idx)} title="Remove">
                &times;
              </button>
            </div>
            <div className="custom-bells-section">
              <span className="custom-bells-label">Custom bells:</span>
              {(ex.customBells || []).map((b, bIdx) => (
                <div className="bell-row mini" key={bIdx}>
                  <input type="number" className="time-input" min={0} max={23} value={b.hour}
                    onChange={(e) => updateCustomBell(idx, bIdx, 'hour', e.target.value)} title="Hour" />
                  <span className="time-sep">:</span>
                  <input type="number" className="time-input" min={0} max={59} value={b.minute}
                    onChange={(e) => updateCustomBell(idx, bIdx, 'minute', e.target.value)} title="Minute" />
                  <input type="number" className="duration-input" min={1} value={b.durationSec}
                    onChange={(e) => updateCustomBell(idx, bIdx, 'durationSec', e.target.value)} title="Duration (sec)" />
                  <input type="text" className="label-input" maxLength={31} value={b.label}
                    onChange={(e) => updateCustomBell(idx, bIdx, 'label', e.target.value)} placeholder="Label" />
                  <button className="remove-button" onClick={() => removeCustomBell(idx, bIdx)}>&times;</button>
                </div>
              ))}
              <button className="add-button small" onClick={() => addCustomBell(idx)}>+ Bell</button>
            </div>
          </div>
        ))}
      </div>
      <button className="add-button" onClick={addExWorking}>+ Exception Working Day</button>

      <h3 style={{ marginTop: '1.5rem' }}>Exception Holidays</h3>
      <div className="exception-list">
        {holItems.map((ex, idx) => (
          <div className="exception-row" key={idx}>
            <input
              type="date"
              value={ex.date}
              onChange={(e) => updateHol(idx, 'date', e.target.value)}
            />
            <input
              type="text"
              className="label-input"
              maxLength={31}
              value={ex.label}
              onChange={(e) => updateHol(idx, 'label', e.target.value)}
              placeholder="Label"
            />
            <button className="remove-button" onClick={() => removeExHoliday(idx)} title="Remove">
              &times;
            </button>
          </div>
        ))}
      </div>
      <button className="add-button" onClick={addExHoliday}>+ Exception Holiday</button>

      {dirty && (
        <div className="exception-actions">
          <button className="save-button" onClick={handleSave}>Save Exceptions</button>
        </div>
      )}
    </div>
  );
}
