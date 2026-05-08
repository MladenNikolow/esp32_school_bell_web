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

  // Local editable copies of 3 custom slots
  const [local, setLocal] = useState([null, null, null]);

  useEffect(() => {
    dispatch(fetchTemplates());
  }, [dispatch]);

  useEffect(() => {
    // Sync from store
    const arr = Array.from({ length: SLOT_COUNT }, (_, i) => storeTemplates[i] ?? null);
    setLocal(arr);
  }, [storeTemplates]);

  useEffect(() => {
    if (saveSuccess) {
      const id = setTimeout(() => dispatch(clearSaveSuccess()), 3000);
      return () => clearTimeout(id);
    }
  }, [saveSuccess, dispatch]);

  const updateSlot = (idx, patch) =>
    setLocal((prev) => prev.map((s, i) => i === idx ? { ...(s || { name: '', bells: [] }), ...patch } : s));

  const clearSlot = (idx) =>
    setLocal((prev) => prev.map((s, i) => (i === idx ? null : s)));

  const handleSave = () => {
    dispatch(saveTemplates(local));
  };

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
                  <BellSetEditor
                    value={{ bells: b.bells || [] }}
                    onChange={() => {}}
                    readOnly
                  />
                </div>
              ))}
            </section>
          )}

          {/* 3 editable custom slots */}
          <section className="template-section">
            <h3 className="template-section-title">{t('schedule.customTemplates')}</h3>
            {Array.from({ length: SLOT_COUNT }, (_, idx) => {
              const slot = local[idx];
              return (
                <div key={idx} className="template-slot">
                  <div className="template-slot-header">
                    <input
                      className="template-name-input"
                      value={slot?.name || ''}
                      placeholder={t('calendar.templateSlot', { n: idx + 1 })}
                      onChange={(e) => updateSlot(idx, { name: e.target.value })}
                    />
                    {slot && (
                      <button
                        type="button"
                        className="delete-btn"
                        title={t('calendar.deleteTemplate')}
                        onClick={() => clearSlot(idx)}
                      >×</button>
                    )}
                  </div>
                  <BellSetEditor
                    value={{ bells: slot?.bells || [] }}
                    onChange={({ bells }) => updateSlot(idx, { bells })}
                    allowApplyTemplate
                    templates={local}
                    builtins={builtins}
                  />
                </div>
              );
            })}
          </section>
        </>
      )}
    </div>
  );
}
