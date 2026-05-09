import React, { useEffect, useState } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import {
  fetchTemplates, saveTemplates,
  clearError, clearSaveSuccess,
} from '../ScheduleSlice.js';
import BellSetEditor from '../components/BellSetEditor.jsx';
import useLocale from '../../../hooks/useLocale.jsx';

const SLOT_COUNT = 3;

export default function TemplatesTab() {
  const dispatch = useDispatch();
  const { t } = useLocale();
  const { templates: storeTemplates, builtins, loading, saving, error, saveSuccess } =
    useSelector((s) => s.schedule);

  const [local, setLocal] = useState([null, null, null]);
  const [open, setOpen] = useState([false, false, false]);

  useEffect(() => {
    dispatch(fetchTemplates());
  }, [dispatch]);

  useEffect(() => {
    const arr = Array.from({ length: SLOT_COUNT }, (_, i) => storeTemplates[i] ?? null);
    setLocal(arr);
    // preserve open state across re-fetches
  }, [storeTemplates]);

  useEffect(() => {
    if (saveSuccess) {
      const id = setTimeout(() => dispatch(clearSaveSuccess()), 3000);
      return () => clearTimeout(id);
    }
  }, [saveSuccess, dispatch]);

  const toggleOpen = (idx) =>
    setOpen((prev) => prev.map((v, i) => (i === idx ? !v : v)));

  const setAllOpen = (val) => setOpen([val, val, val]);

  const updateSlot = (idx, patch) => {
    setLocal((prev) =>
      prev.map((s, i) => (i === idx ? { ...(s || { name: '', bells: [] }), ...patch } : s))
    );
    // Auto-expand if this slot was null (first activation)
    setOpen((prev) => prev.map((v, i) => (i === idx ? true : v)));
  };

  const clearSlot = (idx) =>
    setLocal((prev) => prev.map((s, i) => (i === idx ? null : s)));

  const handleSave = () => dispatch(saveTemplates(local));

  const allOpen = open.every(Boolean);

  return (
    <div className="schedule-tab-pane">
      <div className="tab-header">
        <h2>{t('schedule.templates')}</h2>
        <button
          className={`save-button${saving ? ' loading' : ''}`}
          onClick={handleSave}
          disabled={saving}
        >
          {saving ? t('schedule.saving') : t('calendar.saveTemplates')}
        </button>
      </div>

      {error && (
        <div className="error-message">
          {error}
          <button className="error-dismiss" onClick={() => dispatch(clearError())}>×</button>
        </div>
      )}

      {saveSuccess && (
        <div className="success-message">{t('calendar.templatesSaved')}</div>
      )}

      {loading ? (
        <p className="loading-text">{t('schedule.loading')}</p>
      ) : (
        <>
          {/* Built-in read-only templates */}
          {builtins.length > 0 && (
            <section className="template-section">
              <h3 className="template-section-title">{t('schedule.builtinTemplates')}</h3>
              {builtins.map((b, i) => (
                <div key={i} className="template-slot template-slot-readonly">
                  <div className="template-slot-header">
                    <span className="template-slot-name">{b.name}</span>
                    <span className="template-readonly-badge">{t('schedule.readOnly')}</span>
                  </div>
                  <BellSetEditor value={{ bells: b.bells || [] }} onChange={() => {}} readOnly />
                </div>
              ))}
            </section>
          )}

          {/* 3 editable custom slots — collapsible */}
          <section className="template-section">
            <div className="section-header-row">
              <h3 className="template-section-title">{t('schedule.customTemplates')}</h3>
              <button type="button" className="bulk-toggle" onClick={() => setAllOpen(!allOpen)}>
                {allOpen ? t('schedule.collapseAll') : t('schedule.expandAll')}
              </button>
            </div>

            {Array.from({ length: SLOT_COUNT }, (_, idx) => {
              const slot = local[idx];
              const isOpen = open[idx];
              const bellCount = slot?.bells?.length ?? 0;
              return (
                <div key={idx} className={`collapsible-card${isOpen ? ' open' : ''}`}>
                  <div
                    className="collapsible-card-header"
                    onClick={() => toggleOpen(idx)}
                    role="button"
                    tabIndex={0}
                    onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && toggleOpen(idx)}
                    aria-expanded={isOpen}
                  >
                    <span className="cc-chevron">{isOpen ? '▼' : '▶'}</span>
                    <span className="cc-slot-index">{idx + 1}</span>
                    <input
                      className="template-name-input cc-name-input"
                      value={slot?.name || ''}
                      placeholder={t('calendar.templateSlot', { n: idx + 1 })}
                      onChange={(e) => updateSlot(idx, { name: e.target.value })}
                      onClick={(e) => e.stopPropagation()}
                      onFocus={(e) => { e.stopPropagation(); if (!isOpen) toggleOpen(idx); }}
                    />
                    <span className="cc-summary">{bellCount} {t('schedule.bellsCount')}</span>
                    {slot && (
                      <button
                        type="button"
                        className="delete-btn"
                        title={t('calendar.deleteTemplate')}
                        onClick={(e) => { e.stopPropagation(); clearSlot(idx); }}
                      >×</button>
                    )}
                  </div>
                  <div className="collapsible-card-body">
                    <BellSetEditor
                      value={{ bells: slot?.bells || [] }}
                      onChange={({ bells }) => updateSlot(idx, { bells })}
                      allowApplyTemplate
                      templates={local}
                      builtins={builtins}
                    />
                  </div>
                </div>
              );
            })}
          </section>
        </>
      )}
    </div>
  );
}
