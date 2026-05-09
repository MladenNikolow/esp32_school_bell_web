import React, { useEffect, useState } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import {
  fetchExceptions, saveExceptions,
  clearError, clearSaveSuccess,
} from '../ScheduleSlice.js';
import BellSetEditor from '../components/BellSetEditor.jsx';
import useLocale from '../../../hooks/useLocale.jsx';

const ACTIONS = ['dayOff', 'template', 'custom'];

function today() {
  return new Date().toISOString().slice(0, 10);
}

function emptyException() {
  return {
    startDate: today(),
    endDate: today(),
    label: '',
    action: 'dayOff',
    templateIdx: 0,
    customBells: { bells: [] },
    timeOffsetMin: 0,
  };
}

export default function ExceptionsTab() {
  const dispatch = useDispatch();
  const { t } = useLocale();
  const { exceptions, templates, builtins, loading, saving, error, saveSuccess } =
    useSelector((s) => s.schedule);

  const [localExceptions, setLocalExceptions] = useState([]);
  const [open, setOpen] = useState([]);

  useEffect(() => {
    dispatch(fetchExceptions());
  }, [dispatch]);

  useEffect(() => {
    setLocalExceptions([...(exceptions || [])]);
    setOpen(new Array(exceptions?.length ?? 0).fill(false));
  }, [exceptions]);

  useEffect(() => {
    if (saveSuccess) {
      const id = setTimeout(() => dispatch(clearSaveSuccess()), 3000);
      return () => clearTimeout(id);
    }
  }, [saveSuccess, dispatch]);

  const toggleOpen = (idx) =>
    setOpen((prev) => prev.map((v, i) => (i === idx ? !v : v)));

  const setAllOpen = (val) =>
    setOpen(new Array(localExceptions.length).fill(val));

  const addException = () => {
    setLocalExceptions((prev) => [...prev, emptyException()]);
    setOpen((prev) => [...prev, true]);
  };

  const patchException = (idx, patch) =>
    setLocalExceptions((prev) => prev.map((ex, i) => (i === idx ? { ...ex, ...patch } : ex)));

  const deleteException = (idx) => {
    const updated = localExceptions.filter((_, i) => i !== idx);
    const newOpen = open.filter((_, i) => i !== idx);
    setLocalExceptions(updated);
    setOpen(newOpen);
    dispatch(saveExceptions(updated));
  };

  const handleSave = () => dispatch(saveExceptions(localExceptions));

  const actionLabel = (action) => t(`calendar.action_${action}`) || action;

  const templateOptions = templates
    .map((tpl, i) => tpl
      ? { idx: i, label: tpl.name || t('calendar.templateSlot', { n: i + 1 }) }
      : null
    ).filter(Boolean);

  const allOpen = open.length > 0 && open.every(Boolean);

  return (
    <div className="schedule-tab-pane">
      <div className="tab-header">
        <h2>{t('schedule.exceptions')}</h2>
        <div className="tab-header-actions">
          <button type="button" className="save-button" onClick={addException}>
            {t('calendar.addException')}
          </button>
          {localExceptions.length > 0 && (
            <button
              type="button"
              className={`save-button${saving ? ' loading' : ''}`}
              onClick={handleSave}
              disabled={saving}
            >
              {saving ? t('schedule.saving') : t('calendar.saveExceptions')}
            </button>
          )}
        </div>
      </div>

      {error && (
        <div className="error-message">
          {error}
          <button className="error-dismiss" onClick={() => dispatch(clearError())}>×</button>
        </div>
      )}

      {saveSuccess && (
        <div className="success-message">{t('schedule.savedSuccess')}</div>
      )}

      {loading ? (
        <p className="loading-text">{t('schedule.loading')}</p>
      ) : (
        <>
          {localExceptions.length === 0 ? (
            <p className="empty-text">{t('calendar.noExceptions')}</p>
          ) : (
            <>
              <div className="bulk-toggle-group">
                <button type="button" className="bulk-toggle" onClick={() => setAllOpen(!allOpen)}>
                  {allOpen ? t('schedule.collapseAll') : t('schedule.expandAll')}
                </button>
              </div>

              <div className="exceptions-list">
                {localExceptions.map((ex, i) => (
                  <div key={i} className={`collapsible-card${open[i] ? ' open' : ''}`}>
                    {/* Header — always visible */}
                    <div
                      className="collapsible-card-header"
                      onClick={() => toggleOpen(i)}
                      role="button"
                      tabIndex={0}
                      onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && toggleOpen(i)}
                      aria-expanded={open[i]}
                    >
                      <span className="cc-chevron">{open[i] ? '▼' : '▶'}</span>
                      <span className="cc-dates">
                        {ex.startDate}
                        {ex.endDate && ex.endDate !== ex.startDate && <> → {ex.endDate}</>}
                      </span>
                      {ex.label && <span className="cc-exc-label">{ex.label}</span>}
                      <span className={`exception-action exception-action-${ex.action}`}>
                        {actionLabel(ex.action)}
                      </span>
                      {ex.action === 'custom' && (
                        <span className="cc-summary">
                          {ex.customBells?.bells?.length ?? 0} {t('schedule.bellsCount')}
                        </span>
                      )}
                      {ex.action === 'template' && ex.templateIdx !== undefined && (
                        <span className="cc-summary">
                          {templates[ex.templateIdx]?.name || t('calendar.templateSlot', { n: (ex.templateIdx ?? 0) + 1 })}
                        </span>
                      )}
                      <button
                        type="button"
                        className="delete-btn"
                        onClick={(e) => { e.stopPropagation(); deleteException(i); }}
                        title={t('calendar.removeException')}
                      >×</button>
                    </div>

                    {/* Body — shown when open */}
                    <div className="collapsible-card-body">
                      <div className="form-group">
                        <label className="form-label">{t('calendar.startDate')}</label>
                        <input
                          type="date"
                          className="form-input"
                          value={ex.startDate}
                          onChange={(e) => patchException(i, { startDate: e.target.value })}
                        />
                      </div>
                      <div className="form-group">
                        <label className="form-label">{t('calendar.endDate')}</label>
                        <input
                          type="date"
                          className="form-input"
                          value={ex.endDate}
                          onChange={(e) => patchException(i, { endDate: e.target.value })}
                        />
                      </div>
                      <div className="form-group">
                        <label className="form-label">{t('calendar.label')}</label>
                        <input
                          type="text"
                          className="form-input"
                          value={ex.label}
                          onChange={(e) => patchException(i, { label: e.target.value })}
                          placeholder={t('calendar.exHolPlaceholder')}
                          maxLength={63}
                        />
                      </div>
                      <div className="form-group">
                        <label className="form-label">{t('calendar.action')}</label>
                        <select
                          className="form-select"
                          value={ex.action}
                          onChange={(e) => patchException(i, { action: e.target.value })}
                        >
                          {ACTIONS.map((a) => (
                            <option key={a} value={a}>{actionLabel(a)}</option>
                          ))}
                        </select>
                      </div>

                      {ex.action === 'template' && (
                        <>
                          <div className="form-group">
                            <label className="form-label">{t('calendar.selectTemplate')}</label>
                            <select
                              className="form-select"
                              value={ex.templateIdx ?? 0}
                              onChange={(e) => patchException(i, { templateIdx: parseInt(e.target.value, 10) })}
                            >
                              {templateOptions.length > 0
                                ? templateOptions.map((o) => (
                                  <option key={o.idx} value={o.idx}>{o.label}</option>
                                ))
                                : <option disabled>{t('calendar.noTemplates')}</option>
                              }
                            </select>
                          </div>
                          <div className="form-group">
                            <label className="form-label">{t('calendar.timeOffset')}</label>
                            <div className="form-row">
                              <input
                                type="number"
                                className="duration-input"
                                min={-240}
                                max={240}
                                value={ex.timeOffsetMin}
                                onChange={(e) => patchException(i, { timeOffsetMin: parseInt(e.target.value, 10) || 0 })}
                              />
                              <span className="form-unit">{t('calendar.min')}</span>
                            </div>
                          </div>
                        </>
                      )}

                      {ex.action === 'custom' && (
                        <>
                          <div className="form-group">
                            <label className="form-label">{t('calendar.timeOffset')}</label>
                            <div className="form-row">
                              <input
                                type="number"
                                className="duration-input"
                                min={-240}
                                max={240}
                                value={ex.timeOffsetMin}
                                onChange={(e) => patchException(i, { timeOffsetMin: parseInt(e.target.value, 10) || 0 })}
                              />
                              <span className="form-unit">{t('calendar.min')}</span>
                            </div>
                          </div>
                          <div className="form-group">
                            <label className="form-label">
                              {t('calendar.customBells', { count: ex.customBells?.bells?.length ?? 0 })}
                            </label>
                            <BellSetEditor
                              value={ex.customBells || { bells: [] }}
                              onChange={(bellSet) => patchException(i, { customBells: bellSet })}
                              allowApplyTemplate
                              templates={templates}
                              builtins={builtins}
                            />
                          </div>
                        </>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
          <p className="hint-text">{t('calendar.expiredNote')}</p>
        </>
      )}
    </div>
  );
}
