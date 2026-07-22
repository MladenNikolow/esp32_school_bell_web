import React, { useEffect, useMemo, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import useLocale from '../../../hooks/useLocale.jsx';
import TimePicker24 from './TimePicker24.jsx';
import { fetchDefault } from '../ScheduleSlice.js';

const MAX_BELLS = 60;

function sortBells(bells) {
  return [...bells].sort((a, b) => a.hour * 60 + a.minute - (b.hour * 60 + b.minute));
}

let _bellIdCounter = 0;
const newBellId = () => `b-${++_bellIdCounter}`;

const DEFAULT_SHIFT_CONFIG = {
  startHour: 7,
  startMinute: 30,
  classDuration: 45,
  breakDuration: 5,
  bigBreakDuration: 15,
  bigBreakAfterClass: 3,
  classCount: 6,
};

/** Normalize a signed minute-of-day offset into 0..1439. */
function normMinutes(m) {
  return ((m % 1440) + 1440) % 1440;
}

function fmtMinutes(m) {
  const n = normMinutes(m);
  return `${String(Math.floor(n / 60)).padStart(2, '0')}:${String(n % 60).padStart(2, '0')}`;
}

/** Compute preview stats { count, classCount, from, to } for a shift config. */
function shiftPreview(cfg) {
  const start = cfg.startHour * 60 + cfg.startMinute;
  let cursor = start;
  let last = start;
  for (let i = 0; i < cfg.classCount; i++) {
    cursor += cfg.classDuration;
    last = cursor;
    if (i < cfg.classCount - 1) {
      cursor += (i + 1 === cfg.bigBreakAfterClass) ? cfg.bigBreakDuration : cfg.breakDuration;
    }
  }
  return {
    count: cfg.classCount * 2,
    classCount: cfg.classCount,
    fromMin: start,
    toMin: last,
    from: fmtMinutes(start),
    to: fmtMinutes(last),
  };
}

/**
 * Reusable bell-set editor.
 *
 * Props:
 *   value            -{ bells: [...] } BellSet shape
 *   onChange         -(newBellSet) => void
 *   allowApplyTemplate -show "Apply Template" toolbar option (default false)
 *   templates        -array of custom template slots (may be null)
 *   builtins         -array of built-in templates [{id, name, bells}]
 *   readOnly         -boolean; show table without edit controls
 *   onGenerated      -optional callback after auto-generate fills local bells
 *   saveHint         -optional text shown after generate (e.g. "Save to store…")
 */
export default function BellSetEditor({
  value,
  onChange,
  allowApplyTemplate = false,
  templates = [],
  builtins = [],
  readOnly = false,
  onGenerated = null,
  saveHint = null,
}) {
  const { t } = useLocale();
  const dispatch = useDispatch();
  const defaultBells = useSelector((s) => s.schedule?.default?.bells ?? []);
  const bells = value?.bells || [];

  // Built-in "Day On" template resolves to the current default schedule at
  // apply-time. Make sure the default schedule is loaded so applying it does
  // not silently produce an empty bell list.
  useEffect(() => {
    if (allowApplyTemplate && (!defaultBells || defaultBells.length === 0)) {
      dispatch(fetchDefault());
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [allowApplyTemplate]);

  const [mode, setMode] = useState('manual');
  const [applyTplIdx, setApplyTplIdx] = useState('');
  const [showSaveHint, setShowSaveHint] = useState(false);

  const [twoShifts, setTwoShifts] = useState(false);
  const [shift1, setShift1] = useState({ ...DEFAULT_SHIFT_CONFIG });
  const [shift2, setShift2] = useState({ ...DEFAULT_SHIFT_CONFIG, startHour: 13, startMinute: 30 });

  // ── helpers ──────────────────────────────────────────────────────────────

  const emit = (newBells) => onChange({ ...(value || {}), bells: newBells });

  const updateBell = (idx, patch) => {
    setShowSaveHint(false);
    emit(bells.map((b, i) => (i === idx ? { ...b, ...patch } : b)));
  };

  const removeBell = (idx) => {
    setShowSaveHint(false);
    emit(bells.filter((_, i) => i !== idx));
  };

  const addBell = () => {
    setShowSaveHint(false);
    emit([...bells, { hour: 8, minute: 0, label: '', _id: newBellId() }]);
  };

  const setShiftField = (setter, field, v) => setter((p) => ({ ...p, [field]: v }));

  // ── auto-generate ────────────────────────────────────────────────────────

  const buildShiftBells = (cfg, shiftLabel) => {
    const out = [];
    let mins = cfg.startHour * 60 + cfg.startMinute;
    for (let i = 0; i < cfg.classCount; i++) {
      out.push({
        hour: Math.floor(mins / 60) % 24,
        minute: mins % 60,
        label: shiftLabel
          ? t('auto.shiftClassStart', { shift: shiftLabel, n: i + 1 })
          : t('schedule.classStart', { n: i + 1 }),
      });
      mins += cfg.classDuration;
      out.push({
        hour: Math.floor(mins / 60) % 24,
        minute: mins % 60,
        label: shiftLabel
          ? t('auto.shiftClassEnd', { shift: shiftLabel, n: i + 1 })
          : t('schedule.classEnd', { n: i + 1 }),
      });
      if (i < cfg.classCount - 1) {
        mins += (i + 1 === cfg.bigBreakAfterClass) ? cfg.bigBreakDuration : cfg.breakDuration;
      }
    }
    return out;
  };

  const generateBells = () => {
    let generated = buildShiftBells(shift1, twoShifts ? t('auto.firstShift') : null);
    if (twoShifts) {
      generated = generated.concat(buildShiftBells(shift2, t('auto.secondShift')));
    }
    generated = sortBells(generated).slice(0, MAX_BELLS);
    emit(generated);
    setMode('manual');
    setShowSaveHint(true);
    if (typeof onGenerated === 'function') onGenerated();
  };

  // ── apply template ────────────────────────────────────────────────────────

  // Built-ins arrive from the API without any bells payload -they are
  // semantic sentinels. Resolve them here:
  //   • dayOn  → snapshot of the current default schedule
  // Day Off is intentionally NOT offered here -empty custom schedules cause
  // save errors; use the dedicated Day Off action instead.
  const allTemplateOptions = useMemo(() => [
    ...builtins
      .map((b, i) => ({ builtin: b, i }))
      .filter(({ builtin }) => builtin?.id === 'dayOn' && (defaultBells?.length > 0))
      .map(({ builtin, i }) => ({
        key: `builtin-${i}`,
        label: builtin?.id === 'dayOn' ? t('schedule.builtin.dayOn.name') : (builtin?.name || ''),
        bells: (defaultBells || []).map(({ _id, ...rest }) => rest),
      })),
    ...templates.map((tpl, i) => (
      tpl && Array.isArray(tpl.bells) && tpl.bells.length > 0
        ? {
            key: `custom-${i}`,
            label: tpl.name || t('calendar.templateSlot', { n: i + 1 }),
            bells: tpl.bells,
          }
        : null
    )).filter(Boolean),
  ], [builtins, templates, defaultBells, t]);

  useEffect(() => {
    if (allTemplateOptions.length === 0) {
      setApplyTplIdx('');
      return;
    }
    if (!allTemplateOptions.some((o) => o.key === applyTplIdx)) {
      setApplyTplIdx(allTemplateOptions[0].key);
    }
  }, [allTemplateOptions, applyTplIdx]);

  const handleApplyTemplate = () => {
    const opt = allTemplateOptions.find((o) => o.key === applyTplIdx);
    if (!opt || !(opt.bells?.length > 0)) return;
    emit(opt.bells);
    setMode('manual');
    setShowSaveHint(true);
    if (typeof onGenerated === 'function') onGenerated();
  };

  // ── preview calc ──────────────────────────────────────────────────────────

  const preview1 = shiftPreview(shift1);
  const preview2 = twoShifts ? shiftPreview(shift2) : null;
  const combinedPreview = preview2
    ? {
        count: Math.min(MAX_BELLS, preview1.count + preview2.count),
        classCount: preview1.classCount + preview2.classCount,
        from: fmtMinutes(Math.min(preview1.fromMin, preview2.fromMin)),
        to: fmtMinutes(Math.max(preview1.toMin, preview2.toMin)),
      }
    : preview1;

  // ── shift parameter grid (shared markup for shift 1 / shift 2) ───────────

  const renderShiftGrid = (cfg, setCfg) => (
    <>
      <div className="ag-start-row">
        <div className="ag-start-label">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
            <circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 3"/>
          </svg>
          {t('auto.startTime')}
        </div>
        <TimePicker24
          value={{ hour: cfg.startHour, minute: cfg.startMinute }}
          onChange={({ hour, minute }) => setCfg((p) => ({ ...p, startHour: hour, startMinute: minute }))}
        />
      </div>

      <div className="ag-grid">
        <div className="ag-card">
          <div className="ag-card-icon">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
              <rect x="3" y="3" width="7" height="7" rx="1"/>
              <rect x="14" y="3" width="7" height="7" rx="1"/>
              <rect x="3" y="14" width="7" height="7" rx="1"/>
              <rect x="14" y="14" width="7" height="7" rx="1"/>
            </svg>
          </div>
          <div className="ag-card-label">{t('auto.numClasses')}</div>
          <div className="ag-stepper">
            <button type="button" className="ag-step-btn"
              onClick={() => setShiftField(setCfg, 'classCount', Math.max(1, cfg.classCount - 1))}>−</button>
            <span className="ag-step-val">{cfg.classCount}</span>
            <button type="button" className="ag-step-btn"
              onClick={() => setShiftField(setCfg, 'classCount', Math.min(20, cfg.classCount + 1))}>+</button>
          </div>
        </div>

        <div className="ag-card">
          <div className="ag-card-icon">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M5 2h14M5 22h14M7 2c0 4.5 10 4.5 10 9S7 17.5 7 22M17 2c0 4.5-10 4.5-10 9s10 7.5 10 12"/>
            </svg>
          </div>
          <div className="ag-card-label">{t('auto.classDuration')}</div>
          <div className="ag-stepper">
            <button type="button" className="ag-step-btn"
              onClick={() => setShiftField(setCfg, 'classDuration', Math.max(5, cfg.classDuration - 5))}>−</button>
            <span className="ag-step-val">{cfg.classDuration}<span className="ag-step-unit">{t('calendar.min')}</span></span>
            <button type="button" className="ag-step-btn"
              onClick={() => setShiftField(setCfg, 'classDuration', Math.min(120, cfg.classDuration + 5))}>+</button>
          </div>
        </div>

        <div className="ag-card">
          <div className="ag-card-icon">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M18 8h1a4 4 0 0 1 0 8h-1"/>
              <path d="M2 8h16v9a4 4 0 0 1-4 4H6a4 4 0 0 1-4-4Z"/>
            </svg>
          </div>
          <div className="ag-card-label">{t('auto.breakDuration')}</div>
          <div className="ag-stepper">
            <button type="button" className="ag-step-btn"
              onClick={() => setShiftField(setCfg, 'breakDuration', Math.max(0, cfg.breakDuration - 1))}>−</button>
            <span className="ag-step-val">{cfg.breakDuration}<span className="ag-step-unit">{t('calendar.min')}</span></span>
            <button type="button" className="ag-step-btn"
              onClick={() => setShiftField(setCfg, 'breakDuration', Math.min(60, cfg.breakDuration + 1))}>+</button>
          </div>
        </div>

        <div className="ag-card">
          <div className="ag-card-icon">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
              <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>
            </svg>
          </div>
          <div className="ag-card-label">{t('auto.bigBreakDuration')}</div>
          <div className="ag-stepper">
            <button type="button" className="ag-step-btn"
              onClick={() => setShiftField(setCfg, 'bigBreakDuration', Math.max(0, cfg.bigBreakDuration - 5))}>−</button>
            <span className="ag-step-val">{cfg.bigBreakDuration}<span className="ag-step-unit">{t('calendar.min')}</span></span>
            <button type="button" className="ag-step-btn"
              onClick={() => setShiftField(setCfg, 'bigBreakDuration', Math.min(60, cfg.bigBreakDuration + 5))}>+</button>
          </div>
        </div>

        <div className="ag-card ag-card--span2">
          <div className="ag-card-icon">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M3 6h18M3 12h10M3 18h10"/><path d="M16 16l3 3 3-3"/>
            </svg>
          </div>
          <div className="ag-card-label">{t('auto.bigBreakAfterClass')}</div>
          <div className="ag-stepper">
            <button type="button" className="ag-step-btn"
              onClick={() => setShiftField(setCfg, 'bigBreakAfterClass', Math.max(1, cfg.bigBreakAfterClass - 1))}>−</button>
            <span className="ag-step-val">{cfg.bigBreakAfterClass}</span>
            <button type="button" className="ag-step-btn"
              onClick={() => setShiftField(setCfg, 'bigBreakAfterClass', Math.min(Math.max(1, cfg.classCount - 1), cfg.bigBreakAfterClass + 1))}>+</button>
          </div>
        </div>
      </div>
    </>
  );

  // ── render ────────────────────────────────────────────────────────────────

  return (
    <div className="bell-set-editor">
      {!readOnly && (
        <div className="mode-tabs">
          <button
            type="button"
            className={`mode-tab${mode === 'manual' ? ' active' : ''}`}
            onClick={() => setMode('manual')}
          >
            {t('schedule.manual')}
          </button>
          {allowApplyTemplate && allTemplateOptions.length > 0 && (
            <button
              type="button"
              className={`mode-tab${mode === 'applyTpl' ? ' active' : ''}`}
              onClick={() => setMode('applyTpl')}
            >
              {t('schedule.applyTemplate')}
            </button>
          )}
          <button
            type="button"
            className={`mode-tab${mode === 'auto' ? ' active' : ''}`}
            onClick={() => setMode('auto')}
          >
            {t('schedule.autoGenerate')}
          </button>
        </div>
      )}

      {/* ── Apply Template panel ─────────────────────────────────── */}
      {mode === 'applyTpl' && !readOnly && (
        <div className="auto-generate-form">
          <div className="form-row">
            <label className="form-label" htmlFor="tpl-select">{t('calendar.selectTemplate')}</label>
            <select
              id="tpl-select"
              className="form-select"
              value={applyTplIdx}
              onChange={(e) => setApplyTplIdx(e.target.value)}
            >
              {allTemplateOptions.map((opt) => (
                <option key={opt.key} value={opt.key}>{opt.label}</option>
              ))}
            </select>
          </div>
          <button type="button" className="add-btn generate-btn" onClick={handleApplyTemplate}>
            {t('schedule.applyTemplate')}
          </button>
          <p className="auto-hint">{t('auto.replaceWarningSimple')}</p>
        </div>
      )}

      {/* ── Auto-generate panel ──────────────────────────────────── */}
      {mode === 'auto' && !readOnly && (
        <div className="ag-panel">

          <label className="ag-shift-toggle">
            <input
              type="checkbox"
              checked={twoShifts}
              onChange={(e) => setTwoShifts(e.target.checked)}
            />
            {t('auto.secondShiftToggle')}
          </label>

          <div className="ag-shift-block">
            {twoShifts && <div className="ag-shift-heading">{t('auto.firstShift')}</div>}
            {renderShiftGrid(shift1, setShift1)}
          </div>

          {twoShifts && (
            <div className="ag-shift-block">
              <div className="ag-shift-heading">{t('auto.secondShift')}</div>
              {renderShiftGrid(shift2, setShift2)}
            </div>
          )}

          {/* Preview hero banner -3 chips */}
          <div className="ag-preview-hero">
            <span className="ag-preview-label">{t('auto.preview')}</span>
            <div className="ag-preview-chips">
              <div className="ag-preview-chip ag-preview-chip--bells">
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.3" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/>
                  <path d="M13.73 21a2 2 0 0 1-3.46 0"/>
                </svg>
                <span className="ag-chip-count">{combinedPreview.count}</span>
                <span className="ag-chip-label">{t('auto.chip.bells')}</span>
              </div>
              <span className="ag-chip-sep">·</span>
              <div className="ag-preview-chip ag-preview-chip--classes">
                <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor">
                  <rect x="3" y="3" width="7" height="7" rx="1"/>
                  <rect x="14" y="3" width="7" height="7" rx="1"/>
                  <rect x="3" y="14" width="7" height="7" rx="1"/>
                  <rect x="14" y="14" width="7" height="7" rx="1"/>
                </svg>
                <span className="ag-chip-count">{combinedPreview.classCount}</span>
                <span className="ag-chip-label">{t('auto.chip.classes')}</span>
              </div>
              <span className="ag-chip-sep">·</span>
              <div className="ag-preview-chip ag-preview-chip--time">
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.3" strokeLinecap="round">
                  <circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 3"/>
                </svg>
                <span className="ag-chip-time">{combinedPreview.from} → {combinedPreview.to}</span>
              </div>
            </div>
          </div>

          {/* Footer: CTA + warning */}
          <div className="ag-footer">
            <button type="button" className="ag-cta-btn" onClick={generateBells}>
              {t('auto.generateApply')}
            </button>
            <p className="ag-warning">{t('auto.replaceWarningSimple')}</p>
            <p className="ag-save-hint">{t('auto.generateSaveHint')}</p>
          </div>

        </div>
      )}

      {showSaveHint && mode === 'manual' && !readOnly && (
        <div className="unsaved-banner" role="status">
          {saveHint || t('auto.generateSaveHint')}
        </div>
      )}

      {/* ── Manual table ─────────────────────────────────────────── */}
      {(mode === 'manual' || readOnly) && (
        <>
          {bells.length === 0 ? (
            <p className="empty-text">{t('schedule.noBells')}</p>
          ) : (
            <div className="bell-table-wrap">
              <table className="bell-table">
                <thead>
                  <tr>
                    <th>{t('schedule.time')}</th>
                    <th>{t('schedule.label')}</th>
                    {!readOnly && <th></th>}
                  </tr>
                </thead>
                <tbody>
                  {bells.map((b, i) => (
                    <tr key={b._id || i}>
                      <td>
                        {readOnly ? (
                          <span className="bell-time-ro">
                            {String(b.hour).padStart(2, '0')}:{String(b.minute).padStart(2, '0')}
                          </span>
                        ) : (
                          <TimePicker24
                            id={`bell-time-${i}`}
                            value={{ hour: b.hour, minute: b.minute }}
                            onChange={({ hour, minute }) => updateBell(i, { hour, minute })}
                          />
                        )}
                      </td>
                      <td>
                        {readOnly ? (
                          <span className="bell-label-ro">{b.label || '—'}</span>
                        ) : (
                          <input
                            className="label-input"
                            value={b.label || ''}
                            onChange={(e) => updateBell(i, { label: e.target.value })}
                            placeholder={t('schedule.labelPlaceholder')}
                            maxLength={47}
                          />
                        )}
                      </td>
                      {!readOnly && (
                        <td>
                          <button
                            type="button"
                            className="delete-btn"
                            onClick={() => removeBell(i)}
                            title={t('schedule.removeBell')}
                          >×</button>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {!readOnly && (
            <div className="bell-actions">
              <button
                type="button"
                className="add-btn"
                onClick={addBell}
                disabled={bells.length >= MAX_BELLS}
              >
                {t('schedule.addBell')}
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
