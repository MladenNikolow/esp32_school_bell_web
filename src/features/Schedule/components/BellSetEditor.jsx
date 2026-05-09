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
        <div className="auto-generate-form">
          <div className="form-row">
            <label className="form-label">{t('auto.startTime')}</label>
            <TimePicker24
              value={{ hour: autoConfig.startHour, minute: autoConfig.startMinute }}
              onChange={({ hour, minute }) => setAutoConfig((p) => ({ ...p, startHour: hour, startMinute: minute }))}
            />
          </div>
          <div className="form-row">
            <label className="form-label" htmlFor="auto-numClasses">{t('auto.numClasses')}</label>
            <input
              id="auto-numClasses"
              type="number"
              className="duration-input"
              min={1}
              max={20}
              value={autoConfig.classCount}
              onChange={(e) => setAutoField('classCount', Math.min(20, Math.max(1, parseInt(e.target.value) || 1)))}
            />
          </div>
          <div className="form-row">
            <label className="form-label" htmlFor="auto-classDur">{t('auto.classDuration')}</label>
            <input
              id="auto-classDur"
              type="number"
              className="duration-input"
              min={5}
              max={120}
              value={autoConfig.classDuration}
              onChange={(e) => setAutoField('classDuration', Math.max(5, parseInt(e.target.value) || 45))}
            />
            <span className="form-unit">{t('calendar.min')}</span>
          </div>
          <div className="form-row">
            <label className="form-label" htmlFor="auto-breakDur">{t('auto.breakDuration')}</label>
            <input
              id="auto-breakDur"
              type="number"
              className="duration-input"
              min={0}
              max={60}
              value={autoConfig.breakDuration}
              onChange={(e) => setAutoField('breakDuration', Math.max(0, parseInt(e.target.value) || 0))}
            />
            <span className="form-unit">{t('calendar.min')}</span>
          </div>
          <div className="form-row">
            <label className="form-label" htmlFor="auto-bigBreakDur">{t('auto.bigBreakDuration')}</label>
            <input
              id="auto-bigBreakDur"
              type="number"
              className="duration-input"
              min={0}
              max={60}
              value={autoConfig.bigBreakDuration}
              onChange={(e) => setAutoField('bigBreakDuration', Math.max(0, parseInt(e.target.value) || 0))}
            />
            <span className="form-unit">{t('calendar.min')}</span>
          </div>
          <div className="form-row">
            <label className="form-label" htmlFor="auto-bigBreakAfter">{t('auto.bigBreakAfterClass')}</label>
            <input
              id="auto-bigBreakAfter"
              type="number"
              className="duration-input"
              min={1}
              max={Math.max(1, autoConfig.classCount - 1)}
              value={autoConfig.bigBreakAfterClass}
              onChange={(e) => setAutoField('bigBreakAfterClass', Math.min(Math.max(1, autoConfig.classCount - 1), Math.max(1, parseInt(e.target.value) || 1)))}
            />
          </div>
          <div className="auto-generate-preview">
            <span className="preview-label">{t('auto.preview')}</span>
            <span>{autoPreview}</span>
          </div>
          <button type="button" className="add-btn generate-btn" onClick={generateBells}>
            {t('auto.generateApply')}
          </button>
          <p className="auto-hint">{t('auto.replaceWarningSimple')}</p>
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
