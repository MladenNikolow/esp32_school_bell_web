import React, { useEffect, useState } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import {
  fetchHolidays, saveHolidays,
  fetchExceptions, saveExceptions,
  fetchTemplates, saveTemplates,
  setHolidays, setExceptions, setCustomBellSets,
  clearError, clearSaveSuccess,
} from './CalendarSlice.js';
import { fetchBells } from '../Schedule/ScheduleSlice.js';
import BellScheduleEditor from '../Schedule/BellScheduleEditor.jsx';
import useLocale from '../../hooks/useLocale.jsx';

const SUB_TABS = ['holidays', 'exceptions'];
const ACTION_VALUES = ['day-off', 'normal', 'first-shift', 'second-shift', 'template', 'custom'];

export default function CalendarPage() {
  const dispatch = useDispatch();
  const { t } = useLocale();
  const { holidays, exceptions, customBellSets, templates, loading, saving, error, saveSuccess } =
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
    dispatch(fetchTemplates());
    dispatch(fetchBells());
  }, [dispatch]);

  useEffect(() => {
    if (saveSuccess) {
      const timer = setTimeout(() => dispatch(clearSaveSuccess()), 3000);
      return () => clearTimeout(timer);
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

  // Exception handlers
  const addException = (overrides = {}) => {
    const today = new Date().toISOString().slice(0, 10);
    dispatch(setExceptions([...exceptions, {
      startDate: today,
      endDate: '',
      label: '',
      action: 'day-off',
      timeOffsetMin: 0,
      templateIdx: 0,
      customBellsIdx: -1,
      ...overrides,
    }]));
  };

  const updateException = (idx, field, value) => {
    dispatch(setExceptions(exceptions.map((e, i) => {
      if (i !== idx) return e;
      const updated = { ...e, [field]: value };
      // Reset dependent fields on action change
      if (field === 'action') {
        if (value !== 'custom') updated.customBellsIdx = -1;
        if (value !== 'template') updated.templateIdx = 0;
      }
      return updated;
    })));
  };

  const removeException = (idx) => {
    const ex = exceptions[idx];
    const newExceptions = exceptions.filter((_, i) => i !== idx);
    // If removed exception referenced a custom bell set, check if still used
    if (ex.customBellsIdx >= 0) {
      const stillUsed = newExceptions.some(e => e.customBellsIdx === ex.customBellsIdx);
      if (!stillUsed) {
        // Remove the custom bell set and remap indices
        const removedIdx = ex.customBellsIdx;
        const newSets = customBellSets.filter((_, i) => i !== removedIdx);
        dispatch(setCustomBellSets(newSets));
        dispatch(setExceptions(newExceptions.map(e => ({
          ...e,
          customBellsIdx: e.customBellsIdx > removedIdx
            ? e.customBellsIdx - 1
            : e.customBellsIdx,
        }))));
        return;
      }
    }
    dispatch(setExceptions(newExceptions));
  };

  const updateExceptionBells = (idx, bells) => {
    const ex = exceptions[idx];
    if (ex.customBellsIdx >= 0 && ex.customBellsIdx < customBellSets.length) {
      // Update existing custom bell set
      dispatch(setCustomBellSets(customBellSets.map((s, i) =>
        i === ex.customBellsIdx ? { bells } : s
      )));
    } else {
      // Create new custom bell set
      const newIdx = customBellSets.length;
      dispatch(setCustomBellSets([...customBellSets, { bells }]));
      dispatch(setExceptions(exceptions.map((e, i) =>
        i === idx ? { ...e, customBellsIdx: newIdx } : e
      )));
    }
  };

  const [expandedEx, setExpandedEx] = useState({});

  // Template management state
  const [localTemplates, setLocalTemplates] = useState([]);
  const [templatesOpen, setTemplatesOpen] = useState(false);
  const [editingSlot, setEditingSlot] = useState(null);
  const [draftTemplate, setDraftTemplate] = useState({ name: '', bells: [] });
  const [templatesDirty, setTemplatesDirty] = useState(false);

  useEffect(() => {
    setLocalTemplates(templates);
    setTemplatesDirty(false);
  }, [templates]);

  // Quick-action date picker state
  const [pickerTarget, setPickerTarget] = useState(null); // { label, action, templateIdx? }
  const [pickerDate, setPickerDate] = useState('');

  const openPicker = (label, action, templateIdx) => {
    setPickerDate(new Date().toISOString().slice(0, 10));
    setPickerTarget({ label, action, ...(templateIdx !== undefined ? { templateIdx } : {}) });
  };
  const closePicker = () => setPickerTarget(null);

  const applyPicker = () => {
    if (!pickerTarget || !pickerDate) return;
    const { label, action, templateIdx } = pickerTarget;
    const newEx = {
      startDate: pickerDate,
      endDate: '',
      label,
      action,
      timeOffsetMin: 0,
      templateIdx: templateIdx ?? 0,
      customBellsIdx: -1,
    };
    const updated = [...exceptions, newEx];
    dispatch(setExceptions(updated));
    dispatch(saveExceptions({ exceptions: updated, customBellSets }));
    closePicker();
  };

  const handleSaveExceptions = () =>
    dispatch(saveExceptions({ exceptions, customBellSets }));

  // Get bells for a custom bell set index
  const getCustomBells = (idx) =>
    (idx >= 0 && idx < customBellSets.length) ? customBellSets[idx].bells || [] : [];

  // Template management handlers
  const handleEditSlot = (slotIdx) => {
    const existing = localTemplates[slotIdx];
    setDraftTemplate(existing
      ? { name: existing.name, bells: existing.bells ? [...existing.bells] : [] }
      : { name: t('calendar.templateSlot', { n: slotIdx + 1 }), bells: [] }
    );
    setEditingSlot(slotIdx);
  };
  const handleCancelEdit = () => {
    setEditingSlot(null);
    setDraftTemplate({ name: '', bells: [] });
  };
  const handleApplyEdit = () => {
    if (!draftTemplate.name.trim()) return;
    const updated = [...localTemplates];
    updated[editingSlot] = { name: draftTemplate.name.trim(), bells: draftTemplate.bells };
    setLocalTemplates(updated);
    setTemplatesDirty(true);
    setEditingSlot(null);
    setDraftTemplate({ name: '', bells: [] });
  };
  const handleDeleteTemplate = (slotIdx) => {
    setLocalTemplates(localTemplates.filter((_, i) => i !== slotIdx));
    setTemplatesDirty(true);
  };
  const handleSaveTemplates = () => {
    dispatch(saveTemplates({ templates: localTemplates }));
  };

  if (loading && holidays.length === 0 && exceptions.length === 0) {
    return <div className="calendar-page"><div className="loading-text">{t('calendar.loading')}</div></div>;
  }

  return (
    <div className="calendar-page">
      {error && (
        <div className="error-message">
          {error}
          <button className="error-dismiss" onClick={() => dispatch(clearError())}>x</button>
        </div>
      )}
      {saveSuccess && <div className="success-message">{t('calendar.savedSuccess')}</div>}

      {/* Sub-tab nav */}
      <div className="sub-tab-nav">
        {SUB_TABS.map((tab) => (
          <button
            key={tab}
            className={`sub-tab-btn ${subTab === tab ? 'active' : ''}`}
            onClick={() => setSubTab(tab)}
          >
            {t(`calendar.${tab}`)}
          </button>
        ))}
      </div>

      {/* Holidays Tab */}
      {subTab === 'holidays' && (
        <div className="sched-card">
          <h3>{t('calendar.holidayRanges')}</h3>
          <p className="card-desc">{t('calendar.holidayRangesDesc')}</p>
          {holidays.length === 0 ? (
            <p className="empty-text">{t('calendar.noHolidays')}</p>
          ) : (
            holidays.map((h, i) => (
              <div key={i} className="cal-entry cal-entry-holiday">
                <div className="cal-entry-number">{i + 1}</div>
                <div className="cal-entry-body">
                  <div className="cal-entry-fields">
                    <div className="date-field-group">
                      <label className="date-field-label">{t('calendar.startDate')}</label>
                      <input type="date" className="date-picker" value={h.startDate} onChange={(e) => updateHoliday(i, 'startDate', e.target.value)} />
                    </div>
                    <span className="date-range-sep">→</span>
                    <div className="date-field-group">
                      <label className="date-field-label">{t('calendar.endDate')}</label>
                      <input type="date" className="date-picker" value={h.endDate} onChange={(e) => updateHoliday(i, 'endDate', e.target.value)} />
                    </div>
                    <div className="date-field-group date-field-label-group">
                      <label className="date-field-label">{t('calendar.label')}</label>
                      <input className="date-label-input" value={h.label || ''} onChange={(e) => updateHoliday(i, 'label', e.target.value)} placeholder={t('calendar.holidayPlaceholder')} maxLength={47} />
                    </div>
                  </div>
                </div>
                <button className="delete-btn" onClick={() => removeHoliday(i)} title={t('calendar.removeHoliday')}>×</button>
              </div>
            ))
          )}
          <div className="cal-actions">
            <button className="add-btn" onClick={addHoliday}>{t('calendar.addHoliday')}</button>
            <button className="save-button" onClick={handleSaveHolidays} disabled={saving}>
              {saving ? t('calendar.saving') : t('calendar.saveHolidays')}
            </button>
          </div>
        </div>
      )}

      {/* Unified Exceptions Tab */}
      {subTab === 'exceptions' && (
        <div className="sched-card">
          <h3>{t('calendar.exceptionsTitle')}</h3>
          <p className="card-desc">{t('calendar.exceptionsDesc')}</p>

          {/* Bell Templates */}
          <div className="template-mgmt-section">
            <button className="template-mgmt-toggle" onClick={() => setTemplatesOpen(o => !o)}>
              <span>{templatesOpen ? '▼' : '▶'} {t('calendar.bellTemplates')}</span>
              <span className="template-mgmt-hint">
                {localTemplates.length > 0
                  ? `${localTemplates.length}/3 ${t('calendar.templatesConfigured')}`
                  : t('calendar.noTemplateSet')}
              </span>
            </button>
            {templatesOpen && (
              <div className="template-mgmt-body">
                {[0, 1, 2].map((slotIdx) => {
                  const tpl = localTemplates[slotIdx];
                  const isEditing = editingSlot === slotIdx;
                  return (
                    <div key={slotIdx} className={`template-slot ${tpl ? 'template-slot-filled' : 'template-slot-empty'}`}>
                      <div className="template-slot-row">
                        <span className="template-slot-label">{t('calendar.templateSlot', { n: slotIdx + 1 })}</span>
                        {tpl ? (
                          <>
                            <span className="template-slot-name">{tpl.name}</span>
                            <button className="template-icon-btn" onClick={() => handleEditSlot(slotIdx)} title={t('calendar.editTemplate')}>✎</button>
                            <button className="template-icon-btn template-icon-delete" onClick={() => handleDeleteTemplate(slotIdx)} title={t('calendar.deleteTemplate')}>×</button>
                          </>
                        ) : (
                          <button className="add-btn template-add-inline" onClick={() => handleEditSlot(slotIdx)}>
                            {t('calendar.addTemplate')}
                          </button>
                        )}
                      </div>
                      {isEditing && (
                        <div className="template-inline-editor">
                          <div className="template-name-row">
                            <label className="template-name-label">{t('calendar.templateName')}</label>
                            <input
                              className="template-name-input"
                              value={draftTemplate.name}
                              onChange={(e) => setDraftTemplate(d => ({ ...d, name: e.target.value }))}
                              maxLength={31}
                              placeholder={t('calendar.templateSlot', { n: slotIdx + 1 })}
                              autoFocus
                            />
                          </div>
                          <BellScheduleEditor
                            bells={draftTemplate.bells}
                            onChangeBells={(bells) => setDraftTemplate(d => ({ ...d, bells }))}
                            compact
                          />
                          <div className="template-editor-actions">
                            <button className="save-button" onClick={handleApplyEdit} disabled={!draftTemplate.name.trim()}>
                              {t('calendar.applyTemplate')}
                            </button>
                            <button className="secondary-btn" onClick={handleCancelEdit}>
                              {t('dashboard.cancel')}
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
                <div className="template-mgmt-footer">
                  <button className="save-button" onClick={handleSaveTemplates} disabled={saving || !templatesDirty}>
                    {saving ? t('calendar.saving') : t('calendar.saveTemplates')}
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Quick Actions — template buttons */}
          <div className="quick-actions">
            <span className="quick-actions-label">{t('calendar.quickActions')}</span>
            {/* Built-in: Normal Day */}
            <button className="quick-action-btn quick-action-work"
              onClick={() => openPicker(t('calendar.normalDay'), 'normal')}>
              {t('calendar.normalDay')}
            </button>
            {/* Built-in: Day Off */}
            <button className="quick-action-btn quick-action-off"
              onClick={() => openPicker(t('calendar.dayOff'), 'day-off')}>
              {t('calendar.dayOff')}
            </button>
            {/* Custom templates (only if set) */}
            {localTemplates.map((tpl, ti) => (
              <button key={ti} className="quick-action-btn quick-action-template"
                onClick={() => openPicker(tpl.name, 'template', ti)}>
                {tpl.name}
              </button>
            ))}
          </div>

          {/* Date picker popover */}
          {pickerTarget && (
            <div className="quick-picker-overlay" onClick={closePicker}>
              <div className="quick-picker-dialog" onClick={(e) => e.stopPropagation()}>
                <p className="quick-picker-title">{t('calendar.applyTemplateDate')}</p>
                <p className="quick-picker-label">{pickerTarget.label}</p>
                <input
                  type="date"
                  className="date-picker quick-picker-input"
                  value={pickerDate}
                  onChange={(e) => setPickerDate(e.target.value)}
                  autoFocus
                />
                <div className="quick-picker-actions">
                  <button className="save-button" onClick={applyPicker} disabled={!pickerDate || saving}>
                    {saving ? t('calendar.saving') : t('calendar.applyTemplate')}
                  </button>
                  <button className="secondary-btn" onClick={closePicker}>
                    {t('dashboard.cancel')}
                  </button>
                </div>
              </div>
            </div>
          )}

          <p className="card-desc card-desc-note">{t('calendar.expiredNote')}</p>
          {exceptions.length === 0 ? (
            <p className="empty-text">{t('calendar.noExceptions')}</p>
          ) : (
            exceptions.map((e, i) => (
              <div key={i} className={`cal-entry cal-entry-expandable ${e.action === 'day-off' ? 'cal-entry-exhol' : 'cal-entry-exwork'}`}>
                <div className="cal-entry-number">{i + 1}</div>
                <div className="cal-entry-body">
                  <div className="cal-entry-fields">
                    <div className="date-field-group">
                      <label className="date-field-label">{t('calendar.startDate')}</label>
                      <input type="date" className="date-picker" value={e.startDate}
                        onChange={(ev) => updateException(i, 'startDate', ev.target.value)} />
                    </div>
                    <div className="date-field-group">
                      <label className="date-field-label">{t('calendar.endDateOpt')}</label>
                      <input type="date" className="date-picker" value={e.endDate || ''}
                        onChange={(ev) => updateException(i, 'endDate', ev.target.value)} />
                    </div>
                    <div className="date-field-group date-field-label-group">
                      <label className="date-field-label">{t('calendar.label')}</label>
                      <input className="date-label-input" value={e.label || ''}
                        onChange={(ev) => updateException(i, 'label', ev.target.value)}
                        placeholder={e.action === 'day-off' ? t('calendar.exHolPlaceholder') : t('calendar.exWorkPlaceholder')}
                        maxLength={47} />
                    </div>
                    <div className="date-field-group">
                      <label className="date-field-label">{t('calendar.action')}</label>
                      <select
                        className="schedule-type-select"
                        value={e.action}
                        onChange={(ev) => updateException(i, 'action', ev.target.value)}
                      >
                        {ACTION_VALUES.map((av) => (
                          <option key={av} value={av}>{t(`calendar.action_${av}`)}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                  <div className="schedule-type-desc">
                    {t(`calendar.action_${e.action}_desc`)}
                  </div>

                  {/* Time offset for normal/first-shift/second-shift */}
                  {['normal', 'first-shift', 'second-shift'].includes(e.action) && (
                    <div className="time-offset-row">
                      <label>{t('calendar.timeOffset')}</label>
                      <input type="number" className="time-offset-input"
                        min="-120" max="120" value={e.timeOffsetMin || 0}
                        onChange={(ev) => updateException(i, 'timeOffsetMin', parseInt(ev.target.value) || 0)} />
                      <span className="time-offset-unit">{t('calendar.min')}</span>
                    </div>
                  )}

                  {/* Template selector */}
                  {e.action === 'template' && (
                    <div className="template-select-row">
                      <label>{t('calendar.selectTemplate')}</label>
                      <select className="template-select"
                        value={e.templateIdx || 0}
                        onChange={(ev) => updateException(i, 'templateIdx', parseInt(ev.target.value))}>
                        {templates.length === 0
                          ? <option value={0}>{t('calendar.noTemplates')}</option>
                          : templates.map((tpl, ti) => (
                              <option key={ti} value={ti}>{tpl.name || `Template ${ti + 1}`}</option>
                            ))
                        }
                      </select>
                      {templates.length > 0 && templates[e.templateIdx || 0] && (
                        <div className="template-bells-preview">
                          {(templates[e.templateIdx || 0].bells || []).map((b, j) => (
                            <span key={j} className="preview-bell-chip">
                              {String(b.hour).padStart(2, '0')}:{String(b.minute).padStart(2, '0')}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  )}

                  {/* Normal schedule: show read-only preview of bells that will ring */}
                  {e.action === 'normal' && defaultBells.length > 0 && (
                    <div className="default-bells-preview">
                      <span className="preview-summary">{t('calendar.bellsFromNormal', { count: defaultBells.length })}</span>
                      <span className="preview-times">
                        {defaultBells.map((b, j) => (
                          <span key={j} className="preview-bell-chip">
                            {String(b.hour).padStart(2, '0')}:{String(b.minute).padStart(2, '0')}
                          </span>
                        ))}
                      </span>
                    </div>
                  )}

                  {/* First shift only preview */}
                  {e.action === 'first-shift' && firstShift.enabled && (
                    <div className="default-bells-preview">
                      <span className="preview-summary">{t('calendar.bellsFromShift', { shift: t('calendar.firstShift'), count: firstShift.bells.length })}</span>
                      <span className="preview-times">
                        {firstShift.bells.map((b, j) => (
                          <span key={j} className="preview-bell-chip">
                            {String(b.hour).padStart(2, '0')}:{String(b.minute).padStart(2, '0')}
                          </span>
                        ))}
                      </span>
                    </div>
                  )}

                  {/* Second shift only preview */}
                  {e.action === 'second-shift' && secondShift.enabled && (
                    <div className="default-bells-preview">
                      <span className="preview-summary">{t('calendar.bellsFromShift', { shift: t('calendar.secondShift'), count: secondShift.bells.length })}</span>
                      <span className="preview-times">
                        {secondShift.bells.map((b, j) => (
                          <span key={j} className="preview-bell-chip">
                            {String(b.hour).padStart(2, '0')}:{String(b.minute).padStart(2, '0')}
                          </span>
                        ))}
                      </span>
                    </div>
                  )}

                  {/* Custom schedule: full bell editor */}
                  {e.action === 'custom' && (
                    <div className="exception-schedule-section">
                      <button
                        className="expand-schedule-btn"
                        onClick={() => setExpandedEx(prev => ({ ...prev, [i]: !prev[i] }))}
                      >
                        {expandedEx[i] ? '▼' : '▶'} {t('calendar.customBells', { count: getCustomBells(e.customBellsIdx).length })}
                      </button>
                      {expandedEx[i] && (
                        <BellScheduleEditor
                          bells={getCustomBells(e.customBellsIdx)}
                          onChangeBells={(bells) => updateExceptionBells(i, bells)}
                          compact
                        />
                      )}
                    </div>
                  )}
                </div>
                <button className="delete-btn" onClick={() => removeException(i)} title={t('calendar.removeException')}>×</button>
              </div>
            ))
          )}
          <div className="cal-actions">
            <button className="add-btn" onClick={() => addException()}>{t('calendar.addException')}</button>
            <button className="save-button" onClick={handleSaveExceptions} disabled={saving}>
              {saving ? t('calendar.saving') : t('calendar.saveExceptions')}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
