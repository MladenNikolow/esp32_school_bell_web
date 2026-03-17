import React, { useEffect, useState } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import {
  fetchHolidays, saveHolidays,
  fetchExceptions, saveExceptions,
  setHolidays, setExceptionWorking, setExceptionHoliday,
  clearError, clearSaveSuccess,
} from './CalendarSlice.js';
import { fetchBells } from '../Schedule/ScheduleSlice.js';
import BellScheduleEditor from '../Schedule/BellScheduleEditor.jsx';

const SUB_TABS = ['holidays', 'exceptionWorking', 'exceptionHoliday'];
const SUB_TAB_LABELS = { holidays: 'Holidays', exceptionWorking: 'Exception Working', exceptionHoliday: 'Exception Holidays' };

const SCHEDULE_TYPES = [
  { value: 'default', label: 'Use Default Schedule', desc: 'Uses the normal bell timetable for this day.' },
  { value: 'reduced', label: 'Reduced Classes', desc: 'Uses the default schedule but with fewer classes.' },
  { value: 'custom', label: 'Custom Schedule', desc: 'Define a completely custom bell schedule for this day.' },
];

export default function CalendarPage() {
  const dispatch = useDispatch();
  const { holidays, exceptionWorking, exceptionHoliday, loading, saving, error, saveSuccess } =
    useSelector((s) => s.calendar);
  const { firstShift, secondShift } = useSelector((s) => s.schedule);
  const [subTab, setSubTab] = useState('holidays');

  // Merge default bells from both shifts, sorted by time
  const defaultBells = [
    ...(firstShift.enabled ? firstShift.bells : []),
    ...(secondShift.enabled ? secondShift.bells : []),
  ].sort((a, b) => (a.hour * 60 + a.minute) - (b.hour * 60 + b.minute));

  useEffect(() => {
    dispatch(fetchHolidays());
    dispatch(fetchExceptions());
    dispatch(fetchBells());
  }, [dispatch]);

  useEffect(() => {
    if (saveSuccess) {
      const t = setTimeout(() => dispatch(clearSaveSuccess()), 3000);
      return () => clearTimeout(t);
    }
  }, [saveSuccess, dispatch]);

  // Holiday handlers
  const addHoliday = () => {
    const today = new Date().toISOString().slice(0, 10);
    dispatch(setHolidays([...holidays, { startDate: today, endDate: today, label: '' }]));
  };
  const updateHoliday = (idx, field, value) => {
    dispatch(setHolidays(holidays.map((h, i) => (i === idx ? { ...h, [field]: value } : h))));
  };
  const removeHoliday = (idx) => {
    dispatch(setHolidays(holidays.filter((_, i) => i !== idx)));
  };
  const handleSaveHolidays = () => dispatch(saveHolidays(holidays));

  // Exception working handlers
  const addExWorking = () => {
    const today = new Date().toISOString().slice(0, 10);
    dispatch(setExceptionWorking([...exceptionWorking, { date: today, label: '', scheduleType: 'default' }]));
  };
  const updateExWorking = (idx, field, value) => {
    dispatch(setExceptionWorking(exceptionWorking.map((e, i) => {
      if (i !== idx) return e;
      const updated = { ...e, [field]: value };
      if (field === 'scheduleType') {
        if (value === 'default') {
          delete updated.customBells;
        } else if (value === 'reduced') {
          const cfg = reducedConfig[i] || getReducedDefaults();
          const count = Math.min(4, defaultBells.length || 4);
          if (!reducedConfig[i]) {
            setReducedConfig(prev => ({ ...prev, [i]: { ...cfg, classCount: count } }));
          }
          updated.customBells = generateReducedBells(cfg, count);
        }
      }
      return updated;
    })));
  };
  const updateReducedClassCount = (idx, count) => {
    const maxCount = defaultBells.length || 20;
    const clamped = Math.max(1, Math.min(count, maxCount));
    const cfg = reducedConfig[idx] || getReducedDefaults();
    const newCfg = { ...cfg, classCount: clamped };
    setReducedConfig(prev => ({ ...prev, [idx]: newCfg }));
    dispatch(setExceptionWorking(exceptionWorking.map((e, i) =>
      i === idx ? { ...e, customBells: generateReducedBells(newCfg, clamped) } : e
    )));
  };
  const updateReducedDuration = (idx, field, value) => {
    const cfg = reducedConfig[idx] || getReducedDefaults();
    const newCfg = { ...cfg, [field]: value };
    const count = newCfg.classCount || (exceptionWorking[idx]?.customBells || []).length || 4;
    newCfg.classCount = count;
    setReducedConfig(prev => ({ ...prev, [idx]: newCfg }));
    dispatch(setExceptionWorking(exceptionWorking.map((e, i) =>
      i === idx ? { ...e, customBells: generateReducedBells(newCfg, count) } : e
    )));
  };
  const updateExWorkingBells = (idx, bells) => {
    dispatch(setExceptionWorking(exceptionWorking.map((e, i) =>
      i === idx ? { ...e, customBells: bells } : e
    )));
  };
  const removeExWorking = (idx) => {
    dispatch(setExceptionWorking(exceptionWorking.filter((_, i) => i !== idx)));
  };
  const [expandedExWork, setExpandedExWork] = useState({});
  const [reducedConfig, setReducedConfig] = useState({});

  const getReducedDefaults = () => ({
    classDuration: 30,
    breakDuration: 5,
    bigBreakDuration: 10,
    bigBreakAfterClass: 3,
    bellDuration: defaultBells.length > 0 ? defaultBells[0].durationSec : 3,
  });

  const generateReducedBells = (config, classCount) => {
    const startTime = defaultBells.length > 0
      ? defaultBells[0].hour * 60 + defaultBells[0].minute
      : 8 * 60;
    const generated = [];
    let totalMinutes = startTime;
    for (let i = 0; i < classCount; i++) {
      generated.push({
        hour: Math.floor(totalMinutes / 60) % 24,
        minute: totalMinutes % 60,
        durationSec: config.bellDuration,
        label: `Period ${i + 1}`,
      });
      const breakAfter = (i + 1 === config.bigBreakAfterClass)
        ? config.bigBreakDuration
        : config.breakDuration;
      totalMinutes += config.classDuration + breakAfter;
    }
    return generated;
  };

  // Exception holiday handlers
  const addExHoliday = () => {
    const today = new Date().toISOString().slice(0, 10);
    dispatch(setExceptionHoliday([...exceptionHoliday, { date: today, label: '' }]));
  };
  const updateExHoliday = (idx, field, value) => {
    dispatch(setExceptionHoliday(exceptionHoliday.map((e, i) => (i === idx ? { ...e, [field]: value } : e))));
  };
  const removeExHoliday = (idx) => {
    dispatch(setExceptionHoliday(exceptionHoliday.filter((_, i) => i !== idx)));
  };

  const handleSaveExceptions = () =>
    dispatch(saveExceptions({ exceptionWorking, exceptionHoliday }));

  if (loading && holidays.length === 0 && exceptionWorking.length === 0) {
    return <div className="calendar-page"><div className="loading-text">Loading calendar...</div></div>;
  }

  return (
    <div className="calendar-page">
      {error && (
        <div className="error-message">
          {error}
          <button className="error-dismiss" onClick={() => dispatch(clearError())}>x</button>
        </div>
      )}
      {saveSuccess && <div className="success-message">Saved successfully</div>}

      {/* Sub-tab nav */}
      <div className="sub-tab-nav">
        {SUB_TABS.map((t) => (
          <button
            key={t}
            className={`sub-tab-btn ${subTab === t ? 'active' : ''}`}
            onClick={() => setSubTab(t)}
          >
            {SUB_TAB_LABELS[t]}
          </button>
        ))}
      </div>

      {/* Holidays Tab */}
      {subTab === 'holidays' && (
        <div className="sched-card">
          <h3>Holiday Ranges</h3>
          <p className="card-desc">Define date ranges when no bells should ring (vacations, breaks, etc.).</p>
          {holidays.length === 0 ? (
            <p className="empty-text">No holidays configured. Add a holiday range to get started.</p>
          ) : (
            holidays.map((h, i) => (
              <div key={i} className="cal-entry cal-entry-holiday">
                <div className="cal-entry-number">{i + 1}</div>
                <div className="cal-entry-body">
                  <div className="cal-entry-fields">
                    <div className="date-field-group">
                      <label className="date-field-label">Start Date</label>
                      <input type="date" className="date-picker" value={h.startDate} onChange={(e) => updateHoliday(i, 'startDate', e.target.value)} />
                    </div>
                    <span className="date-range-sep">→</span>
                    <div className="date-field-group">
                      <label className="date-field-label">End Date</label>
                      <input type="date" className="date-picker" value={h.endDate} onChange={(e) => updateHoliday(i, 'endDate', e.target.value)} />
                    </div>
                    <div className="date-field-group date-field-label-group">
                      <label className="date-field-label">Label</label>
                      <input className="date-label-input" value={h.label || ''} onChange={(e) => updateHoliday(i, 'label', e.target.value)} placeholder="e.g. Summer Break" maxLength={47} />
                    </div>
                  </div>
                </div>
                <button className="delete-btn" onClick={() => removeHoliday(i)} title="Remove holiday">×</button>
              </div>
            ))
          )}
          <div className="cal-actions">
            <button className="add-btn" onClick={addHoliday}>+ Add Holiday</button>
            <button className="save-button" onClick={handleSaveHolidays} disabled={saving}>
              {saving ? 'Saving...' : 'Save Holidays'}
            </button>
          </div>
        </div>
      )}

      {/* Exception Working Tab */}
      {subTab === 'exceptionWorking' && (
        <div className="sched-card">
          <h3>Exception Working Days</h3>
          <p className="card-desc">Mark specific non-working days (weekends or holidays) as working — bells will ring on these dates. Choose schedule type: default (normal timetable), reduced classes, or custom (unique bells).</p>
          <p className="card-desc card-desc-note">Expired exceptions are automatically removed after the day passes.</p>
          {exceptionWorking.length === 0 ? (
            <p className="empty-text">No exception working days configured.</p>
          ) : (
            exceptionWorking.map((e, i) => (
              <div key={i} className="cal-entry cal-entry-exwork cal-entry-expandable">
                <div className="cal-entry-number">{i + 1}</div>
                <div className="cal-entry-body">
                  <div className="cal-entry-fields">
                    <div className="date-field-group">
                      <label className="date-field-label">Date</label>
                      <input type="date" className="date-picker" value={e.date} onChange={(ev) => updateExWorking(i, 'date', ev.target.value)} />
                    </div>
                    <div className="date-field-group date-field-label-group">
                      <label className="date-field-label">Label</label>
                      <input className="date-label-input" value={e.label || ''} onChange={(ev) => updateExWorking(i, 'label', ev.target.value)} placeholder="e.g. Make-up day" maxLength={47} />
                    </div>
                    <div className="date-field-group">
                      <label className="date-field-label">Schedule</label>
                      <select
                        className="schedule-type-select"
                        value={e.scheduleType || 'default'}
                        onChange={(ev) => updateExWorking(i, 'scheduleType', ev.target.value)}
                      >
                        {SCHEDULE_TYPES.map((st) => (
                          <option key={st.value} value={st.value}>{st.label}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                  <div className="schedule-type-desc">
                    {SCHEDULE_TYPES.find(st => st.value === (e.scheduleType || 'default'))?.desc}
                  </div>
                  {/* Default schedule: show read-only preview of bells that will ring */}
                  {(e.scheduleType === 'default' || !e.scheduleType) && defaultBells.length > 0 && (
                    <div className="default-bells-preview">
                      <span className="preview-summary">{defaultBells.length} bells from normal schedule</span>
                      <span className="preview-times">
                        {defaultBells.map((b, j) => (
                          <span key={j} className="preview-bell-chip">
                            {String(b.hour).padStart(2, '0')}:{String(b.minute).padStart(2, '0')}
                          </span>
                        ))}
                      </span>
                    </div>
                  )}
                  {/* Reduced classes: class count picker + preview */}
                  {e.scheduleType === 'reduced' && (() => {
                    const cfg = reducedConfig[i] || getReducedDefaults();
                    const classCount = (e.customBells || []).length || Math.min(4, defaultBells.length || 4);
                    return (
                    <div className="reduced-classes-section">
                        <>
                          <div className="reduced-count-row">
                            <label>Number of classes:</label>
                            <input
                              type="number"
                              className="reduced-count-input"
                              min="1"
                              max={defaultBells.length || 20}
                              value={classCount}
                              onChange={(ev) => updateReducedClassCount(i, parseInt(ev.target.value) || 1)}
                            />
                            {defaultBells.length > 0 && <span className="reduced-count-hint">of {defaultBells.length} total</span>}
                          </div>
                          <div className="reduced-duration-row">
                            <div className="reduced-duration-field">
                              <label>Class duration</label>
                              <div className="reduced-duration-input-wrap">
                                <input
                                  type="number"
                                  className="reduced-duration-input"
                                  min="5"
                                  max="90"
                                  value={cfg.classDuration}
                                  onChange={(ev) => updateReducedDuration(i, 'classDuration', parseInt(ev.target.value) || 30)}
                                />
                                <span className="reduced-duration-unit">min</span>
                              </div>
                            </div>
                            <div className="reduced-duration-field">
                              <label>Break</label>
                              <div className="reduced-duration-input-wrap">
                                <input
                                  type="number"
                                  className="reduced-duration-input"
                                  min="0"
                                  max="30"
                                  value={cfg.breakDuration}
                                  onChange={(ev) => updateReducedDuration(i, 'breakDuration', parseInt(ev.target.value) || 0)}
                                />
                                <span className="reduced-duration-unit">min</span>
                              </div>
                            </div>
                            <div className="reduced-duration-field">
                              <label>Big break</label>
                              <div className="reduced-duration-input-wrap">
                                <input
                                  type="number"
                                  className="reduced-duration-input"
                                  min="0"
                                  max="45"
                                  value={cfg.bigBreakDuration}
                                  onChange={(ev) => updateReducedDuration(i, 'bigBreakDuration', parseInt(ev.target.value) || 0)}
                                />
                                <span className="reduced-duration-unit">min</span>
                              </div>
                            </div>
                            <div className="reduced-duration-field">
                              <label>Big break after</label>
                              <div className="reduced-duration-input-wrap">
                                <input
                                  type="number"
                                  className="reduced-duration-input"
                                  min="1"
                                  max={classCount}
                                  value={Math.min(cfg.bigBreakAfterClass, classCount)}
                                  onChange={(ev) => updateReducedDuration(i, 'bigBreakAfterClass', parseInt(ev.target.value) || 1)}
                                />
                                <span className="reduced-duration-unit">class</span>
                              </div>
                            </div>
                          </div>
                          <div className="reduced-bells-preview">
                            {(e.customBells || []).map((b, j) => (
                              <span key={j} className="preview-bell-chip">
                                {String(b.hour).padStart(2, '0')}:{String(b.minute).padStart(2, '0')}
                                {b.label ? ` ${b.label}` : ''}
                              </span>
                            ))}
                          </div>
                        </>
                    </div>
                    );
                  })()}
                  {/* Custom schedule: full bell editor */}
                  {e.scheduleType === 'custom' && (
                    <div className="exception-schedule-section">
                      <button
                        className="expand-schedule-btn"
                        onClick={() => setExpandedExWork(prev => ({ ...prev, [i]: !prev[i] }))}
                      >
                        {expandedExWork[i] ? '▼' : '▶'} Custom Bells ({(e.customBells || []).length} bells)
                      </button>
                      {expandedExWork[i] && (
                        <BellScheduleEditor
                          bells={e.customBells || []}
                          onChangeBells={(bells) => updateExWorkingBells(i, bells)}
                          compact
                        />
                      )}
                    </div>
                  )}
                </div>
                <button className="delete-btn" onClick={() => removeExWorking(i)} title="Remove exception">×</button>
              </div>
            ))
          )}
          <div className="cal-actions">
            <button className="add-btn" onClick={addExWorking}>+ Add Exception Working</button>
            <button className="save-button" onClick={handleSaveExceptions} disabled={saving}>
              {saving ? 'Saving...' : 'Save Exceptions'}
            </button>
          </div>
        </div>
      )}

      {/* Exception Holiday Tab */}
      {subTab === 'exceptionHoliday' && (
        <div className="sched-card">
          <h3>Exception Holidays</h3>
          <p className="card-desc">Mark specific working days as holidays — no bells will ring on these dates.</p>
          <p className="card-desc card-desc-note">Expired exceptions are automatically removed after the day passes.</p>
          {exceptionHoliday.length === 0 ? (
            <p className="empty-text">No exception holidays configured.</p>
          ) : (
            exceptionHoliday.map((e, i) => (
              <div key={i} className="cal-entry cal-entry-exhol">
                <div className="cal-entry-number">{i + 1}</div>
                <div className="cal-entry-body">
                  <div className="cal-entry-fields">
                    <div className="date-field-group">
                      <label className="date-field-label">Date</label>
                      <input type="date" className="date-picker" value={e.date} onChange={(ev) => updateExHoliday(i, 'date', ev.target.value)} />
                    </div>
                    <div className="date-field-group date-field-label-group">
                      <label className="date-field-label">Label</label>
                      <input className="date-label-input" value={e.label || ''} onChange={(ev) => updateExHoliday(i, 'label', ev.target.value)} placeholder="e.g. National holiday" maxLength={47} />
                    </div>
                  </div>
                </div>
                <button className="delete-btn" onClick={() => removeExHoliday(i)} title="Remove exception">×</button>
              </div>
            ))
          )}
          <div className="cal-actions">
            <button className="add-btn" onClick={addExHoliday}>+ Add Exception Holiday</button>
            <button className="save-button" onClick={handleSaveExceptions} disabled={saving}>
              {saving ? 'Saving...' : 'Save Exceptions'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
