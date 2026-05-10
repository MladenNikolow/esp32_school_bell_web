import React, { useState } from 'react';
import useLocale from '../../../hooks/useLocale.jsx';
import TimePicker24 from './TimePicker24.jsx';

function sortBells(bells) {
  return [...bells].sort((a, b) => a.hour * 60 + a.minute - (b.hour * 60 + b.minute));
}

let _bellIdCounter = 0;
const newBellId = () => `b-${++_bellIdCounter}`;

/**
 * Reusable bell-set editor.
 *
 * Props:
 *   value            — { bells: [...] } BellSet shape
 *   onChange         — (newBellSet) => void
 *   allowApplyTemplate — show "Apply Template" toolbar option (default false)
 *   templates        — array of 3 custom template slots (may be null)
 *   builtins         — array of built-in templates [{name, bells}]
 *   readOnly         — boolean; show table without edit controls
 */
export default function BellSetEditor({
  value,
  onChange,
  allowApplyTemplate = false,
  templates = [],
  builtins = [],
  readOnly = false,
}) {
  const { t } = useLocale();
  const bells = value?.bells || [];

  const [mode, setMode] = useState('manual');
  const [applyTplIdx, setApplyTplIdx] = useState('builtin-0');

  const [autoConfig, setAutoConfig] = useState({
    startHour: 7,
    startMinute: 30,
    classDuration: 45,
    breakDuration: 5,
    bigBreakDuration: 15,
    bigBreakAfterClass: 3,
    classCount: 6,
  });

  // ── helpers ──────────────────────────────────────────────────────────────

  const emit = (newBells) => onChange({ ...(value || {}), bells: newBells });

  const updateBell = (idx, patch) =>
    emit(bells.map((b, i) => (i === idx ? { ...b, ...patch } : b)));

  const removeBell = (idx) => emit(bells.filter((_, i) => i !== idx));

  const addBell = () =>
    emit([...bells, { hour: 8, minute: 0, label: '', _id: newBellId() }]);

  // ── auto-generate ────────────────────────────────────────────────────────

  const setAutoField = (field, v) =>
    setAutoConfig((p) => ({ ...p, [field]: v }));

  const generateBells = () => {
    const generated = [];
    let mins = autoConfig.startHour * 60 + autoConfig.startMinute;
    for (let i = 0; i < autoConfig.classCount; i++) {
      // start bell
      generated.push({
        hour: Math.floor(mins / 60) % 24,
        minute: mins % 60,
        label: t('schedule.classStart', { n: i + 1 }),
      });
      mins += autoConfig.classDuration;
      // end bell
      generated.push({
        hour: Math.floor(mins / 60) % 24,
        minute: mins % 60,
        label: t('schedule.classEnd', { n: i + 1 }),
      });
      const brk = (i + 1 === autoConfig.bigBreakAfterClass)
        ? autoConfig.bigBreakDuration
        : autoConfig.breakDuration;
      mins += brk;
    }
    emit(generated);
    setMode('manual');
  };

  // ── apply template ────────────────────────────────────────────────────────

  const allTemplateOptions = [
    ...builtins.map((b, i) => ({ key: `builtin-${i}`, label: b.name, bells: b.bells || [] })),
    ...templates.map((tpl, i) => tpl
      ? { key: `custom-${i}`, label: tpl.name || t('calendar.templateSlot', { n: i + 1 }), bells: tpl.bells || [] }
      : null
    ).filter(Boolean),
  ];

  const handleApplyTemplate = () => {
    const opt = allTemplateOptions.find((o) => o.key === applyTplIdx);
    if (opt) {
      emit(opt.bells);
      setMode('manual');
    }
  };

  // ── preview calc ──────────────────────────────────────────────────────────

  const autoPreview = (() => {
    let last = autoConfig.startHour * 60 + autoConfig.startMinute;
    const count = autoConfig.classCount;
    for (let i = 0; i < count; i++) {
      last += autoConfig.classDuration;
      if (i < count - 1) {
        last += (i + 1 === autoConfig.bigBreakAfterClass)
          ? autoConfig.bigBreakDuration
          : autoConfig.breakDuration;
      }
    }
    const endH = Math.floor(last / 60) % 24;
    const endM = last % 60;
    const from = `${String(autoConfig.startHour).padStart(2, '0')}:${String(autoConfig.startMinute).padStart(2, '0')}`;
    const to = `${String(endH).padStart(2, '0')}:${String(endM).padStart(2, '0')}`;
    return t('auto.previewRange', { count: count * 2, from, to });
  })();

  // ── timeline segments (Phase 2) ──────────────────────────────────────────

  const tlStartStr = `${String(autoConfig.startHour).padStart(2, '0')}:${String(autoConfig.startMinute).padStart(2, '0')}`;

  const tlSegs = (() => {
    const fmt = (m) => `${String(Math.floor(m / 60) % 24).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
    const segs = [];
    let cursor = autoConfig.startHour * 60 + autoConfig.startMinute;
    for (let i = 0; i < autoConfig.classCount; i++) {
      const s = cursor;
      cursor += autoConfig.classDuration;
      segs.push({ kind: 'class', label: String(i + 1), startStr: fmt(s), endStr: fmt(cursor), durationMin: autoConfig.classDuration });
      if (i < autoConfig.classCount - 1) {
        const isBig = (i + 1 === autoConfig.bigBreakAfterClass);
        const dur = isBig ? autoConfig.bigBreakDuration : autoConfig.breakDuration;
        if (dur > 0) {
          segs.push({ kind: isBig ? 'bigBreak' : 'break', label: '', startStr: fmt(cursor), endStr: fmt(cursor + dur), durationMin: dur });
        }
        cursor += dur;
      }
    }
    return segs;
  })();

  const tlEndStr = tlSegs.length > 0 ? tlSegs[tlSegs.length - 1].endStr : tlStartStr;

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

      {/* ── Auto-generate panel (Phase 1: Card Grid) ─────────────── */}
      {mode === 'auto' && !readOnly && (
        <div className="ag-panel">

          {/* Start Time row */}
          <div className="ag-start-row">
            <div className="ag-start-label">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                <circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 3"/>
              </svg>
              {t('auto.startTime')}
            </div>
            <TimePicker24
              value={{ hour: autoConfig.startHour, minute: autoConfig.startMinute }}
              onChange={({ hour, minute }) => setAutoConfig((p) => ({ ...p, startHour: hour, startMinute: minute }))}
            />
          </div>

          {/* 2-column parameter card grid */}
          <div className="ag-grid">

            {/* Number of Classes */}
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
                  onClick={() => setAutoField('classCount', Math.max(1, autoConfig.classCount - 1))}>−</button>
                <span className="ag-step-val">{autoConfig.classCount}</span>
                <button type="button" className="ag-step-btn"
                  onClick={() => setAutoField('classCount', Math.min(20, autoConfig.classCount + 1))}>+</button>
              </div>
            </div>

            {/* Class Duration */}
            <div className="ag-card">
              <div className="ag-card-icon">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M5 2h14M5 22h14M7 2c0 4.5 10 4.5 10 9S7 17.5 7 22M17 2c0 4.5-10 4.5-10 9s10 7.5 10 12"/>
                </svg>
              </div>
              <div className="ag-card-label">{t('auto.classDuration')}</div>
              <div className="ag-stepper">
                <button type="button" className="ag-step-btn"
                  onClick={() => setAutoField('classDuration', Math.max(5, autoConfig.classDuration - 5))}>−</button>
                <span className="ag-step-val">{autoConfig.classDuration}<span className="ag-step-unit">{t('calendar.min')}</span></span>
                <button type="button" className="ag-step-btn"
                  onClick={() => setAutoField('classDuration', Math.min(120, autoConfig.classDuration + 5))}>+</button>
              </div>
            </div>

            {/* Break */}
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
                  onClick={() => setAutoField('breakDuration', Math.max(0, autoConfig.breakDuration - 1))}>−</button>
                <span className="ag-step-val">{autoConfig.breakDuration}<span className="ag-step-unit">{t('calendar.min')}</span></span>
                <button type="button" className="ag-step-btn"
                  onClick={() => setAutoField('breakDuration', Math.min(60, autoConfig.breakDuration + 1))}>+</button>
              </div>
            </div>

            {/* Big Break */}
            <div className="ag-card">
              <div className="ag-card-icon">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                  <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>
                </svg>
              </div>
              <div className="ag-card-label">{t('auto.bigBreakDuration')}</div>
              <div className="ag-stepper">
                <button type="button" className="ag-step-btn"
                  onClick={() => setAutoField('bigBreakDuration', Math.max(0, autoConfig.bigBreakDuration - 5))}>−</button>
                <span className="ag-step-val">{autoConfig.bigBreakDuration}<span className="ag-step-unit">{t('calendar.min')}</span></span>
                <button type="button" className="ag-step-btn"
                  onClick={() => setAutoField('bigBreakDuration', Math.min(60, autoConfig.bigBreakDuration + 5))}>+</button>
              </div>
            </div>

            {/* Big Break After — spans both columns */}
            <div className="ag-card ag-card--span2">
              <div className="ag-card-icon">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M3 6h18M3 12h10M3 18h10"/><path d="M16 16l3 3 3-3"/>
                </svg>
              </div>
              <div className="ag-card-label">{t('auto.bigBreakAfterClass')}</div>
              <div className="ag-stepper">
                <button type="button" className="ag-step-btn"
                  onClick={() => setAutoField('bigBreakAfterClass', Math.max(1, autoConfig.bigBreakAfterClass - 1))}>−</button>
                <span className="ag-step-val">{autoConfig.bigBreakAfterClass}</span>
                <button type="button" className="ag-step-btn"
                  onClick={() => setAutoField('bigBreakAfterClass', Math.min(Math.max(1, autoConfig.classCount - 1), autoConfig.bigBreakAfterClass + 1))}>+</button>
              </div>
            </div>

          </div>{/* /ag-grid */}

          {/* Preview hero banner */}
          <div className="ag-preview-hero">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
              <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/>
            </svg>
            <span className="ag-preview-label">{t('auto.preview')}</span>
            <span className="ag-preview-text">{autoPreview}</span>
          </div>

          {/* Footer: CTA + warning */}
          <div className="ag-footer">
            <button type="button" className="ag-cta-btn" onClick={generateBells}>
              {t('auto.generateApply')}
            </button>
            <p className="ag-warning">{t('auto.replaceWarningSimple')}</p>
          </div>

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
              <button type="button" className="add-btn" onClick={addBell}>
                {t('schedule.addBell')}
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
