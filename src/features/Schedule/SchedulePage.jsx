import React, { useEffect, useState } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import {
  fetchSettings,
  fetchBells, saveBells, fetchDefaults,
  setFirstShift, setSecondShift,
  clearError, clearSaveSuccess,
} from './ScheduleSlice.js';

/* Shift time boundaries for validation */
const FIRST_SHIFT_MAX_HOUR = 14;   // bells should be before 14:00
const SECOND_SHIFT_MIN_HOUR = 12;  // bells should be 12:00 or later

function formatDuration(sec) {
  if (sec < 60) return `${sec}s`;
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return s > 0 ? `${m}m ${s}s` : `${m}m`;
}

function getShiftWarning(bells, isFirstShift) {
  if (!bells || bells.length === 0) return null;
  if (isFirstShift) {
    const late = bells.filter(b => b.hour >= FIRST_SHIFT_MAX_HOUR);
    if (late.length > 0) {
      return `${late.length} bell(s) scheduled at ${FIRST_SHIFT_MAX_HOUR}:00 or later. First shift bells should be before ${FIRST_SHIFT_MAX_HOUR}:00.`;
    }
  } else {
    const early = bells.filter(b => b.hour < SECOND_SHIFT_MIN_HOUR);
    if (early.length > 0) {
      return `${early.length} bell(s) scheduled before ${SECOND_SHIFT_MIN_HOUR}:00. Second shift bells should be ${SECOND_SHIFT_MIN_HOUR}:00 or later.`;
    }
  }
  return null;
}

function ShiftTable({ title, shift, onChangeShift, saving, isFirstShift }) {
  const { enabled, bells } = shift;

  const toggleEnabled = () => {
    onChangeShift({ ...shift, enabled: !enabled });
  };

  const updateBell = (idx, field, value) => {
    const next = bells.map((b, i) => (i === idx ? { ...b, [field]: value } : b));
    onChangeShift({ ...shift, bells: next });
  };

  const removeBell = (idx) => {
    onChangeShift({ ...shift, bells: bells.filter((_, i) => i !== idx) });
  };

  const addBell = () => {
    const defaultHour = isFirstShift ? 8 : 13;
    onChangeShift({ ...shift, bells: [...bells, { hour: defaultHour, minute: 0, durationSec: 3, label: '' }] });
  };

  const warning = enabled ? getShiftWarning(bells, isFirstShift) : null;

  return (
    <div className={`shift-section ${!enabled ? 'shift-disabled' : ''}`}>
      <div className="shift-header">
        <h4>{title}</h4>
        <label className="shift-toggle">
          <input type="checkbox" checked={enabled} onChange={toggleEnabled} />
          <span>{enabled ? 'Enabled' : 'Disabled'}</span>
        </label>
      </div>

      {enabled && (
        <>
          {warning && (
            <div className="shift-warning">
              <span className="warning-icon">⚠</span> {warning}
            </div>
          )}

          {bells.length === 0 ? (
            <p className="empty-text">No bells configured. Add a bell to get started.</p>
          ) : (
            <div className="bell-table-wrap">
              <table className="bell-table">
                <thead>
                  <tr>
                    <th title="The time of day (HH:MM) when this bell will ring">Time</th>
                    <th title="How long the bell rings in seconds (1–300)">Duration (s)</th>
                    <th title="Optional name for this bell, e.g. 'First Period', 'Lunch Break'">Label</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {bells.map((b, i) => (
                        <tr key={i} className={
                          (isFirstShift && b.hour >= FIRST_SHIFT_MAX_HOUR) ||
                          (!isFirstShift && b.hour < SECOND_SHIFT_MIN_HOUR)
                            ? 'bell-row-warning' : ''
                        }>
                          <td>
                            <input
                              type="time"
                              className="time-input"
                              title="When this bell should ring (24-hour format)"
                              value={`${String(b.hour).padStart(2, '0')}:${String(b.minute).padStart(2, '0')}`}
                              onChange={(e) => {
                                const [h, m] = e.target.value.split(':').map(Number);
                                const next = bells.map((bell, idx) => (idx === i ? { ...bell, hour: h, minute: m } : bell));
                                onChangeShift({ ...shift, bells: next });
                              }}
                            />
                          </td>
                          <td>
                            <div className="duration-picker">
                              <input
                                type="range"
                                className="duration-slider"
                                min="1"
                                max="300"
                                value={b.durationSec}
                                onChange={(e) => updateBell(i, 'durationSec', parseInt(e.target.value) || 1)}
                              />
                              <div className="duration-value-row">
                                <input
                                  type="number"
                                  className="duration-input"
                                  title="Ring duration in seconds"
                                  min="1"
                                  max="300"
                                  value={b.durationSec}
                                  onChange={(e) => updateBell(i, 'durationSec', parseInt(e.target.value) || 1)}
                                />
                                <span className="duration-display">{formatDuration(b.durationSec)}</span>
                              </div>
                            </div>
                          </td>
                          <td>
                            <input
                              className="label-input"
                              value={b.label || ''}
                              onChange={(e) => updateBell(i, 'label', e.target.value)}
                              placeholder="e.g. First Period"
                              title="A descriptive name for this bell event"
                              maxLength={47}
                            />
                          </td>
                          <td>
                            <button className="delete-btn" onClick={() => removeBell(i)} title="Remove this bell">×</button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              <div className="bell-actions">
                <button className="add-btn" onClick={addBell}>+ Add Bell</button>
              </div>
        </>
      )}
    </div>
  );
}

export default function SchedulePage() {
  const dispatch = useDispatch();
  const { firstShift, secondShift, loading, saving, error, saveSuccess } =
    useSelector((s) => s.schedule);

  const [showAutoGen, setShowAutoGen] = useState(false);
  const [autoConfig, setAutoConfig] = useState({
    firstStartHour: 7, firstStartMinute: 30, firstClassCount: 6,
    secondStartHour: 13, secondStartMinute: 0, secondClassCount: 0,
    classDuration: 45,
    breakDuration: 5,
    bigBreakDuration: 15,
    bigBreakAfterClass: 3,
    bellDuration: 3,
  });

  useEffect(() => {
    dispatch(fetchSettings());
    dispatch(fetchBells());
  }, [dispatch]);

  useEffect(() => {
    if (saveSuccess) {
      const t = setTimeout(() => dispatch(clearSaveSuccess()), 3000);
      return () => clearTimeout(t);
    }
  }, [saveSuccess, dispatch]);

  const handleSaveBells = () => {
    dispatch(saveBells({ firstShift, secondShift }));
  };

  const handleResetDefaults = () => {
    if (!window.confirm('Load the factory default schedule? This will replace your current bell configuration (unsaved).')) return;
    dispatch(fetchDefaults());
  };

  const updateAutoField = (field, value) => {
    setAutoConfig(prev => ({ ...prev, [field]: value }));
  };

  const generateShiftBells = (startHour, startMinute, classCount) => {
    const bells = [];
    let totalMinutes = startHour * 60 + startMinute;
    for (let i = 0; i < classCount; i++) {
      const hour = Math.floor(totalMinutes / 60) % 24;
      const minute = totalMinutes % 60;
      bells.push({ hour, minute, durationSec: autoConfig.bellDuration, label: `Period ${i + 1}` });
      const brk = (i + 1 === autoConfig.bigBreakAfterClass)
        ? autoConfig.bigBreakDuration : autoConfig.breakDuration;
      totalMinutes += autoConfig.classDuration + brk;
    }
    return bells;
  };

  const handleAutoGenerate = () => {
    const firstBells = generateShiftBells(
      autoConfig.firstStartHour, autoConfig.firstStartMinute, autoConfig.firstClassCount
    );
    const secondBells = generateShiftBells(
      autoConfig.secondStartHour, autoConfig.secondStartMinute, autoConfig.secondClassCount
    );
    dispatch(setFirstShift({ enabled: autoConfig.firstClassCount > 0, bells: firstBells }));
    dispatch(setSecondShift({ enabled: autoConfig.secondClassCount > 0, bells: secondBells }));
    setShowAutoGen(false);
  };

  /* Compute preview times */
  const previewEndTime = (startH, startM, count) => {
    if (count <= 0) return null;
    let t = startH * 60 + startM;
    for (let i = 0; i < count - 1; i++) {
      const brk = (i + 1 === autoConfig.bigBreakAfterClass) ? autoConfig.bigBreakDuration : autoConfig.breakDuration;
      t += autoConfig.classDuration + brk;
    }
    t += autoConfig.classDuration; // last class end
    return `${String(Math.floor(t / 60) % 24).padStart(2, '0')}:${String(t % 60).padStart(2, '0')}`;
  };

  if (loading && firstShift.bells.length === 0 && secondShift.bells.length === 0) {
    return <div className="schedule-page"><div className="loading-text">Loading schedule...</div></div>;
  }

  return (
    <div className="schedule-page">
      {error && (
        <div className="error-message">
          {error}
          <button className="error-dismiss" onClick={() => dispatch(clearError())}>x</button>
        </div>
      )}
      {saveSuccess && <div className="success-message">Saved successfully</div>}

      {/* Bell Timetable */}
      <div className="sched-card">
        <h3>Bell Timetable</h3>
        <p className="card-desc">
          Configure bell schedules for morning (1st shift) and afternoon (2nd shift) classes.
          Each shift can be independently enabled or disabled.
          Working days and timezone can be configured in the <strong>Settings</strong> tab.
        </p>

        <div className="timetable-toolbar">
          <button
            className={`mode-tab ${showAutoGen ? 'active' : ''}`}
            onClick={() => setShowAutoGen(!showAutoGen)}
          >
            {showAutoGen ? 'Hide Auto Generate' : 'Auto Generate'}
          </button>
          <button className="mode-tab" onClick={handleResetDefaults}>
            Reset to Defaults
          </button>
        </div>

        {showAutoGen && (
          <div className="auto-generate-form auto-generate-unified">
            <p className="auto-hint">
              Generate a full day schedule across both shifts. Configure class counts for each shift
              (set to 0 to disable a shift).
            </p>

            <div className="auto-shift-columns">
              <div className="auto-shift-col">
                <h5>1st Shift</h5>
                <div className="auto-form-row">
                  <label>Start Time</label>
                  <input
                    type="time"
                    className="time-input"
                    value={`${String(autoConfig.firstStartHour).padStart(2, '0')}:${String(autoConfig.firstStartMinute).padStart(2, '0')}`}
                    onChange={(e) => {
                      const [h, m] = e.target.value.split(':').map(Number);
                      setAutoConfig(prev => ({ ...prev, firstStartHour: h, firstStartMinute: m }));
                    }}
                  />
                </div>
                <div className="auto-form-row">
                  <label>Number of Classes</label>
                  <input
                    type="number"
                    className="duration-input"
                    min="0"
                    max="20"
                    value={autoConfig.firstClassCount}
                    onChange={(e) => updateAutoField('firstClassCount', Math.min(20, Math.max(0, parseInt(e.target.value) || 0)))}
                  />
                </div>
                {autoConfig.firstClassCount > 0 && (
                  <div className="auto-generate-preview">
                    <span className="preview-label">Preview:</span>
                    <span>
                      {autoConfig.firstClassCount} classes,{' '}
                      {String(autoConfig.firstStartHour).padStart(2, '0')}:{String(autoConfig.firstStartMinute).padStart(2, '0')}{' '}
                      – {previewEndTime(autoConfig.firstStartHour, autoConfig.firstStartMinute, autoConfig.firstClassCount)}
                    </span>
                  </div>
                )}
              </div>

              <div className="auto-shift-col">
                <h5>2nd Shift</h5>
                <div className="auto-form-row">
                  <label>Start Time</label>
                  <input
                    type="time"
                    className="time-input"
                    value={`${String(autoConfig.secondStartHour).padStart(2, '0')}:${String(autoConfig.secondStartMinute).padStart(2, '0')}`}
                    onChange={(e) => {
                      const [h, m] = e.target.value.split(':').map(Number);
                      setAutoConfig(prev => ({ ...prev, secondStartHour: h, secondStartMinute: m }));
                    }}
                  />
                </div>
                <div className="auto-form-row">
                  <label>Number of Classes</label>
                  <input
                    type="number"
                    className="duration-input"
                    min="0"
                    max="20"
                    value={autoConfig.secondClassCount}
                    onChange={(e) => updateAutoField('secondClassCount', Math.min(20, Math.max(0, parseInt(e.target.value) || 0)))}
                  />
                </div>
                {autoConfig.secondClassCount > 0 && (
                  <div className="auto-generate-preview">
                    <span className="preview-label">Preview:</span>
                    <span>
                      {autoConfig.secondClassCount} classes,{' '}
                      {String(autoConfig.secondStartHour).padStart(2, '0')}:{String(autoConfig.secondStartMinute).padStart(2, '0')}{' '}
                      – {previewEndTime(autoConfig.secondStartHour, autoConfig.secondStartMinute, autoConfig.secondClassCount)}
                    </span>
                  </div>
                )}
              </div>
            </div>

            <h5>Shared Settings</h5>
            <div className="auto-form-row">
              <label>Class Duration (min)</label>
              <input
                type="number" className="duration-input" min="5" max="120"
                value={autoConfig.classDuration}
                onChange={(e) => updateAutoField('classDuration', Math.max(1, parseInt(e.target.value) || 5))}
              />
            </div>
            <div className="auto-form-row">
              <label>Break Duration (min)</label>
              <input
                type="number" className="duration-input" min="0" max="60"
                value={autoConfig.breakDuration}
                onChange={(e) => updateAutoField('breakDuration', Math.max(0, parseInt(e.target.value) || 0))}
              />
            </div>
            <div className="auto-form-row">
              <label>Big Break Duration (min)</label>
              <input
                type="number" className="duration-input" min="0" max="60"
                value={autoConfig.bigBreakDuration}
                onChange={(e) => updateAutoField('bigBreakDuration', Math.max(0, parseInt(e.target.value) || 0))}
              />
            </div>
            <div className="auto-form-row">
              <label>Big Break After Class</label>
              <input
                type="number" className="duration-input" min="1" max="19"
                value={autoConfig.bigBreakAfterClass}
                onChange={(e) => updateAutoField('bigBreakAfterClass', Math.max(1, parseInt(e.target.value) || 1))}
              />
            </div>
            <div className="auto-form-row">
              <label>Bell Ring Duration (sec)</label>
              <input
                type="number" className="duration-input" min="1" max="300"
                value={autoConfig.bellDuration}
                onChange={(e) => updateAutoField('bellDuration', Math.min(300, Math.max(1, parseInt(e.target.value) || 1)))}
              />
            </div>

            <button className="add-btn generate-btn" onClick={handleAutoGenerate}>
              Generate & Apply
            </button>
            <p className="auto-hint">This will replace all current bells in both shifts.</p>
          </div>
        )}

        <ShiftTable
          title="1st Shift — Morning Classes"
          shift={firstShift}
          onChangeShift={(s) => dispatch(setFirstShift(s))}
          saving={saving}
          isFirstShift={true}
        />

        <ShiftTable
          title="2nd Shift — Afternoon Classes"
          shift={secondShift}
          onChangeShift={(s) => dispatch(setSecondShift(s))}
          saving={saving}
          isFirstShift={false}
        />

        <div className="bell-info-box">
          <strong>How it works:</strong> Bells ring automatically at the configured times on every <em>working day</em>.
          Each shift can be enabled or disabled independently.
          Holidays and exception days override this schedule. Duration sets how many seconds the relay stays active.
        </div>

        <div className="bell-actions">
          <button className="save-button" onClick={handleSaveBells} disabled={saving}>
            {saving ? 'Saving...' : 'Save Bells'}
          </button>
        </div>
      </div>
    </div>
  );
}
