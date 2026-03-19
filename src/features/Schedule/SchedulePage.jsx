import React, { useEffect, useState } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import {
  fetchSettings,
  fetchBells, saveBells, fetchDefaults,
  setFirstShift, setSecondShift,
  clearError, clearSaveSuccess,
} from './ScheduleSlice.js';
import useLocale from '../../hooks/useLocale.jsx';

/* Shift time boundaries for validation */
const FIRST_SHIFT_MAX_HOUR = 14;   // bells should be before 14:00
const SECOND_SHIFT_MIN_HOUR = 12;  // bells should be 12:00 or later

function formatDuration(sec) {
  if (sec < 60) return `${sec}s`;
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return s > 0 ? `${m}m ${s}s` : `${m}m`;
}

function getShiftWarning(bells, isFirstShift, t) {
  if (!bells || bells.length === 0) return null;
  if (isFirstShift) {
    const late = bells.filter(b => b.hour >= FIRST_SHIFT_MAX_HOUR);
    if (late.length > 0) {
      return t('schedule.warningFirstShift', { count: late.length, hour: FIRST_SHIFT_MAX_HOUR });
    }
  } else {
    const early = bells.filter(b => b.hour < SECOND_SHIFT_MIN_HOUR);
    if (early.length > 0) {
      return t('schedule.warningSecondShift', { count: early.length, hour: SECOND_SHIFT_MIN_HOUR });
    }
  }
  return null;
}

function ShiftTable({ title, shift, onChangeShift, saving, isFirstShift, t }) {
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

  const warning = enabled ? getShiftWarning(bells, isFirstShift, t) : null;

  return (
    <div className={`shift-section ${!enabled ? 'shift-disabled' : ''}`}>
      <div className="shift-header">
        <h4>{title}</h4>
        <label className="shift-toggle">
          <input type="checkbox" checked={enabled} onChange={toggleEnabled} />
          <span>{enabled ? t('schedule.enabled') : t('schedule.disabled')}</span>
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
            <p className="empty-text">{t('schedule.noBells')}</p>
          ) : (
            <div className="bell-table-wrap">
              <table className="bell-table">
                <thead>
                  <tr>
                    <th title={t('schedule.timeTooltip')}>{t('schedule.time')}</th>
                    <th title={t('schedule.durationTooltip')}>{t('schedule.durationSec')}</th>
                    <th title={t('schedule.labelTooltip')}>{t('schedule.label')}</th>
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
                              placeholder={t('schedule.labelPlaceholder')}
                              title={t('schedule.labelTooltip')}
                              maxLength={47}
                            />
                          </td>
                          <td>
                            <button className="delete-btn" onClick={() => removeBell(i)} title={t('schedule.removeBell')}>×</button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              <div className="bell-actions">
                <button className="add-btn" onClick={addBell}>{t('schedule.addBell')}</button>
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
  const { t, locale } = useLocale();

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

  /* Translate known default bell labels (English or Bulgarian patterns) to current locale */
  const translateDefaultLabels = (bells) => (bells || []).map((b) => {
    if (!b.label) return b;
    const mEn = b.label.match(/^Class (\d+) (start|end)$/);
    if (mEn) {
      const key = mEn[2] === 'start' ? 'schedule.classStart' : 'schedule.classEnd';
      return { ...b, label: t(key, { n: parseInt(mEn[1], 10) }) };
    }
    const mBg = b.label.match(/^Час (\d+) (начало|край)$/);
    if (mBg) {
      const key = mBg[2] === 'начало' ? 'schedule.classStart' : 'schedule.classEnd';
      return { ...b, label: t(key, { n: parseInt(mBg[1], 10) }) };
    }
    return b;
  });

  useEffect(() => {
    dispatch(fetchSettings());
    dispatch(fetchBells()).then((result) => {
      if (result.meta.requestStatus === 'fulfilled') {
        const fs = result.payload.firstShift;
        const ss = result.payload.secondShift;
        if (fs) dispatch(setFirstShift({ enabled: fs.enabled !== false, bells: translateDefaultLabels(fs.bells) }));
        if (ss) dispatch(setSecondShift({ enabled: ss.enabled === true, bells: translateDefaultLabels(ss.bells) }));
      }
    });
  }, [dispatch]);

  /* Re-translate default labels when the user switches language */
  useEffect(() => {
    if (firstShift.bells.length > 0) {
      dispatch(setFirstShift({ ...firstShift, bells: translateDefaultLabels(firstShift.bells) }));
    }
    if (secondShift.bells.length > 0) {
      dispatch(setSecondShift({ ...secondShift, bells: translateDefaultLabels(secondShift.bells) }));
    }
  }, [locale]);

  useEffect(() => {
    if (saveSuccess) {
      const timer = setTimeout(() => dispatch(clearSaveSuccess()), 3000);
      return () => clearTimeout(timer);
    }
  }, [saveSuccess, dispatch]);

  const handleSaveBells = () => {
    dispatch(saveBells({ firstShift, secondShift }));
  };

  const handleResetDefaults = () => {
    if (!window.confirm(t('schedule.resetConfirm'))) return;
    dispatch(fetchDefaults()).then((result) => {
      if (result.meta.requestStatus === 'fulfilled') {
        const fs = result.payload.firstShift;
        const ss = result.payload.secondShift;
        dispatch(setFirstShift({ enabled: fs?.enabled !== false, bells: translateDefaultLabels(fs?.bells) }));
        dispatch(setSecondShift({ enabled: ss?.enabled === true, bells: translateDefaultLabels(ss?.bells) }));
      }
    });
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
      bells.push({ hour, minute, durationSec: autoConfig.bellDuration, label: t('auto.period', { n: i + 1 }) });
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
    let mins = startH * 60 + startM;
    for (let i = 0; i < count - 1; i++) {
      const brk = (i + 1 === autoConfig.bigBreakAfterClass) ? autoConfig.bigBreakDuration : autoConfig.breakDuration;
      mins += autoConfig.classDuration + brk;
    }
    mins += autoConfig.classDuration; // last class end
    return `${String(Math.floor(mins / 60) % 24).padStart(2, '0')}:${String(mins % 60).padStart(2, '0')}`;
  };

  if (loading && firstShift.bells.length === 0 && secondShift.bells.length === 0) {
    return <div className="schedule-page"><div className="loading-text">{t('schedule.loading')}</div></div>;
  }

  return (
    <div className="schedule-page">
      {error && (
        <div className="error-message">
          {error}
          <button className="error-dismiss" onClick={() => dispatch(clearError())}>x</button>
        </div>
      )}
      {saveSuccess && <div className="success-message">{t('schedule.savedSuccess')}</div>}

      {/* Bell Timetable */}
      <div className="sched-card">
        <h3>{t('schedule.bellTimetable')}</h3>
        <p className="card-desc" dangerouslySetInnerHTML={{ __html: t('schedule.bellTimetableDesc') }} />

        <div className="timetable-toolbar">
          <button
            className={`mode-tab ${showAutoGen ? 'active' : ''}`}
            onClick={() => setShowAutoGen(!showAutoGen)}
          >
            {showAutoGen ? t('schedule.hideAutoGen') : t('schedule.autoGenerate')}
          </button>
          <button className="mode-tab" onClick={handleResetDefaults}>
            {t('schedule.resetDefaults')}
          </button>
        </div>

        {showAutoGen && (
          <div className="auto-generate-form auto-generate-unified">
            <p className="auto-hint">{t('auto.hint')}</p>

            <h5>{t('auto.sharedSettings')}</h5>
            <div className="auto-settings-grid">
              <div className="auto-setting-card">
                <label>{t('auto.classDuration')}</label>
                <div className="auto-setting-value">
                  <span className="auto-val">{autoConfig.classDuration}</span>
                  <span className="auto-unit">min</span>
                </div>
                <input
                  type="range" className="auto-slider" min="5" max="120"
                  value={autoConfig.classDuration}
                  onChange={(e) => updateAutoField('classDuration', parseInt(e.target.value))}
                />
              </div>
              <div className="auto-setting-card">
                <label>{t('auto.breakDuration')}</label>
                <div className="auto-setting-value">
                  <span className="auto-val">{autoConfig.breakDuration}</span>
                  <span className="auto-unit">min</span>
                </div>
                <input
                  type="range" className="auto-slider" min="0" max="60"
                  value={autoConfig.breakDuration}
                  onChange={(e) => updateAutoField('breakDuration', parseInt(e.target.value))}
                />
              </div>
              <div className="auto-setting-card">
                <label>{t('auto.bigBreakDuration')}</label>
                <div className="auto-setting-value">
                  <span className="auto-val">{autoConfig.bigBreakDuration}</span>
                  <span className="auto-unit">min</span>
                </div>
                <input
                  type="range" className="auto-slider" min="0" max="60"
                  value={autoConfig.bigBreakDuration}
                  onChange={(e) => updateAutoField('bigBreakDuration', parseInt(e.target.value))}
                />
              </div>
              <div className="auto-setting-card">
                <label>{t('auto.bigBreakAfterClass')}</label>
                <div className="auto-setting-value">
                  <span className="auto-val">{autoConfig.bigBreakAfterClass}</span>
                </div>
                <input
                  type="range" className="auto-slider" min="1" max="19"
                  value={autoConfig.bigBreakAfterClass}
                  onChange={(e) => updateAutoField('bigBreakAfterClass', parseInt(e.target.value))}
                />
              </div>
              <div className="auto-setting-card">
                <label>{t('auto.bellRingDuration')}</label>
                <div className="auto-setting-value">
                  <span className="auto-val">{autoConfig.bellDuration}</span>
                  <span className="auto-unit">sec</span>
                </div>
                <input
                  type="range" className="auto-slider" min="1" max="300"
                  value={autoConfig.bellDuration}
                  onChange={(e) => updateAutoField('bellDuration', parseInt(e.target.value))}
                />
              </div>
            </div>

            <h5>{t('auto.shifts')}</h5>
            <div className="auto-shift-columns">
              <div className="auto-shift-card">
                <div className="auto-shift-header">{t('auto.firstShift')}</div>
                <div className="auto-shift-fields">
                  <div className="auto-shift-field">
                    <label>{t('auto.startTime')}</label>
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
                  <div className="auto-shift-field">
                    <label>{t('auto.numClasses')}</label>
                    <input
                      type="number"
                      className="duration-input"
                      min="0"
                      max="20"
                      value={autoConfig.firstClassCount}
                      onChange={(e) => updateAutoField('firstClassCount', Math.min(20, Math.max(0, parseInt(e.target.value) || 0)))}
                    />
                  </div>
                </div>
                {autoConfig.firstClassCount > 0 && (
                  <div className="auto-generate-preview">
                    <span className="preview-label">{t('auto.preview')}</span>
                    {autoConfig.firstClassCount} {t('auto.classes')},{' '}
                    {String(autoConfig.firstStartHour).padStart(2, '0')}:{String(autoConfig.firstStartMinute).padStart(2, '0')}{' '}
                    – {previewEndTime(autoConfig.firstStartHour, autoConfig.firstStartMinute, autoConfig.firstClassCount)}
                  </div>
                )}
              </div>

              <div className="auto-shift-card">
                <div className="auto-shift-header">{t('auto.secondShift')}</div>
                <div className="auto-shift-fields">
                  <div className="auto-shift-field">
                    <label>{t('auto.startTime')}</label>
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
                  <div className="auto-shift-field">
                    <label>{t('auto.numClasses')}</label>
                    <input
                      type="number"
                      className="duration-input"
                      min="0"
                      max="20"
                      value={autoConfig.secondClassCount}
                      onChange={(e) => updateAutoField('secondClassCount', Math.min(20, Math.max(0, parseInt(e.target.value) || 0)))}
                    />
                  </div>
                </div>
                {autoConfig.secondClassCount > 0 && (
                  <div className="auto-generate-preview">
                    <span className="preview-label">{t('auto.preview')}</span>
                    {autoConfig.secondClassCount} {t('auto.classes')},{' '}
                    {String(autoConfig.secondStartHour).padStart(2, '0')}:{String(autoConfig.secondStartMinute).padStart(2, '0')}{' '}
                    – {previewEndTime(autoConfig.secondStartHour, autoConfig.secondStartMinute, autoConfig.secondClassCount)}
                  </div>
                )}
              </div>
            </div>

            <div className="auto-generate-footer">
              <p className="auto-warning">{t('auto.replaceWarning')}</p>
              <button className="add-btn generate-btn" onClick={handleAutoGenerate}>
                {t('auto.generateApply')}
              </button>
            </div>
          </div>
        )}

        <ShiftTable
          title={t('schedule.firstShift')}
          shift={firstShift}
          onChangeShift={(s) => dispatch(setFirstShift(s))}
          saving={saving}
          isFirstShift={true}
          t={t}
        />

        <ShiftTable
          title={t('schedule.secondShift')}
          shift={secondShift}
          onChangeShift={(s) => dispatch(setSecondShift(s))}
          saving={saving}
          isFirstShift={false}
          t={t}
        />

        <div className="bell-info-box" dangerouslySetInnerHTML={{ __html: t('schedule.howItWorks') }} />

        <div className="bell-actions">
          <button className="save-button" onClick={handleSaveBells} disabled={saving}>
            {saving ? t('schedule.saving') : t('schedule.saveBells')}
          </button>
        </div>
      </div>
    </div>
  );
}
