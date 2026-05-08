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
  const [editingIdx, setEditingIdx] = useState(null); // null = not editing, -1 = new
  const [draft, setDraft] = useState(null);

  useEffect(() => {
    dispatch(fetchExceptions());
  }, [dispatch]);

  useEffect(() => {
    setLocalExceptions([...(exceptions || [])]);
  }, [exceptions]);

  useEffect(() => {
    if (saveSuccess) {
      const id = setTimeout(() => dispatch(clearSaveSuccess()), 3000);
      return () => clearTimeout(id);
    }
  }, [saveSuccess, dispatch]);

  const startNew = () => {
    setDraft(emptyException());
    setEditingIdx(-1);
  };

  const startEdit = (idx) => {
    setDraft({ ...localExceptions[idx] });
    setEditingIdx(idx);
  };

  const cancelEdit = () => {
    setEditingIdx(null);
    setDraft(null);
  };

  const commitDraft = () => {
    let updated;
    if (editingIdx === -1) {
      updated = [...localExceptions, draft];
    } else {
      updated = localExceptions.map((ex, i) => (i === editingIdx ? draft : ex));
    }
    setLocalExceptions(updated);
    setEditingIdx(null);
    setDraft(null);
    dispatch(saveExceptions(updated));
  };

  const deleteException = (idx) => {
    const updated = localExceptions.filter((_, i) => i !== idx);
    setLocalExceptions(updated);
    dispatch(saveExceptions(updated));
  };

  const patchDraft = (patch) => setDraft((d) => ({ ...d, ...patch }));

  const templateOptions = templates
    .map((tpl, i) => tpl
      ? { idx: i, label: tpl.name || t('calendar.templateSlot', { n: i + 1 }) }
      : null
    ).filter(Boolean);

  const actionLabel = (action) => t(`calendar.action_${action}`) || action;

  return (
    <div className="schedule-tab-pane">
      <div className="tab-header">
        <h2>{t('schedule.exceptions')}</h2>
        {editingIdx === null && (
          <button className="save-button" onClick={startNew}>{t('calendar.addException')}</button>
        )}
      </div>

      {error && (
        <div className="error-message">
          {error}
          <button className="error-dismiss" onClick={() => dispatch(clearError())}>×</button>
        </div>
      )}

      {saveSuccess && editingIdx === null && (
        <div className="success-message">{t('schedule.savedSuccess')}</div>
      )}

      {loading ? (
        <p className="loading-text">{t('schedule.loading')}</p>
      ) : editingIdx !== null && draft ? (
        /* ── Exception editor ─────────────────────────────────── */
        <div className="exception-editor">
          <h3 className="exception-editor-title">
            {editingIdx === -1 ? t('calendar.addException') : t('calendar.editException')}
          </h3>

          <div className="form-group">
            <label className="form-label" htmlFor="ex-startDate">{t('calendar.startDate')}</label>
            <input
              id="ex-startDate"
              type="date"
              className="form-input"
              value={draft.startDate}
              onChange={(e) => patchDraft({ startDate: e.target.value })}
            />
          </div>
          <div className="form-group">
            <label className="form-label" htmlFor="ex-endDate">{t('calendar.endDate')}</label>
            <input
              id="ex-endDate"
              type="date"
              className="form-input"
              value={draft.endDate}
              onChange={(e) => patchDraft({ endDate: e.target.value })}
            />
          </div>
          <div className="form-group">
            <label className="form-label" htmlFor="ex-label">{t('calendar.label')}</label>
            <input
              id="ex-label"
              type="text"
              className="form-input"
              value={draft.label}
              onChange={(e) => patchDraft({ label: e.target.value })}
              placeholder={t('calendar.exHolPlaceholder')}
              maxLength={63}
            />
          </div>
          <div className="form-group">
            <label className="form-label" htmlFor="ex-action">{t('calendar.action')}</label>
            <select
              id="ex-action"
              className="form-select"
              value={draft.action}
              onChange={(e) => patchDraft({ action: e.target.value })}
            >
              {ACTIONS.map((a) => (
                <option key={a} value={a}>{actionLabel(a)}</option>
              ))}
            </select>
          </div>

          {draft.action === 'template' && (
            <>
              <div className="form-group">
                <label className="form-label" htmlFor="ex-tpl">{t('calendar.selectTemplate')}</label>
                <select
                  id="ex-tpl"
                  className="form-select"
                  value={draft.templateIdx}
                  onChange={(e) => patchDraft({ templateIdx: parseInt(e.target.value, 10) })}
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
                <label className="form-label" htmlFor="ex-offset">{t('calendar.timeOffset')}</label>
                <div className="form-row">
                  <input
                    id="ex-offset"
                    type="number"
                    className="duration-input"
                    min={-240}
                    max={240}
                    value={draft.timeOffsetMin}
                    onChange={(e) => patchDraft({ timeOffsetMin: parseInt(e.target.value, 10) || 0 })}
                  />
                  <span className="form-unit">{t('calendar.min')}</span>
                </div>
              </div>
            </>
          )}

          {draft.action === 'custom' && (
            <>
              <div className="form-group">
                <label className="form-label" htmlFor="ex-offset">{t('calendar.timeOffset')}</label>
                <div className="form-row">
                  <input
                    id="ex-offset"
                    type="number"
                    className="duration-input"
                    min={-240}
                    max={240}
                    value={draft.timeOffsetMin}
                    onChange={(e) => patchDraft({ timeOffsetMin: parseInt(e.target.value, 10) || 0 })}
                  />
                  <span className="form-unit">{t('calendar.min')}</span>
                </div>
              </div>
              <div className="form-group">
                <label className="form-label">{t('calendar.customBells', { count: draft.customBells?.bells?.length ?? 0 })}</label>
                <BellSetEditor
                  value={draft.customBells || { bells: [] }}
                  onChange={(bellSet) => patchDraft({ customBells: bellSet })}
                  allowApplyTemplate
                  templates={templates}
                  builtins={builtins}
                />
              </div>
            </>
          )}

          <div className="action-bar">
            <button className="cancel-button" onClick={cancelEdit}>{t('schedule.cancel')}</button>
            <button
              className={`save-button${saving ? ' loading' : ''}`}
              onClick={commitDraft}
              disabled={saving}
            >
              {saving ? t('schedule.saving') : t('calendar.saveExceptions')}
            </button>
          </div>
        </div>
      ) : (
        /* ── Exceptions list ──────────────────────────────────── */
        <>
          {localExceptions.length === 0 ? (
            <p className="empty-text">{t('calendar.noExceptions')}</p>
          ) : (
            <div className="exceptions-list">
              {localExceptions.map((ex, i) => (
                <div key={i} className="exception-entry">
                  <div className="exception-dates">
                    <span className="exception-date">{ex.startDate}</span>
                    {ex.endDate && ex.endDate !== ex.startDate && (
                      <> → <span className="exception-date">{ex.endDate}</span></>
                    )}
                  </div>
                  <div className="exception-info">
                    {ex.label && <span className="exception-label">{ex.label}</span>}
                    <span className={`exception-action exception-action-${ex.action}`}>
                      {actionLabel(ex.action)}
                      {ex.action === 'template' && ex.templateIdx !== undefined && (
                        <> — {templates[ex.templateIdx]?.name || t('calendar.templateSlot', { n: ex.templateIdx + 1 })}</>
                      )}
                      {ex.action === 'custom' && (
                        <> ({ex.customBells?.bells?.length ?? 0} {t('schedule.bellsCount')})</>
                      )}
                    </span>
                    {ex.timeOffsetMin !== 0 && (
                      <span className="exception-offset">
                        {t('calendar.timeOffset')} {ex.timeOffsetMin > 0 ? '+' : ''}{ex.timeOffsetMin} {t('calendar.min')}
                      </span>
                    )}
                  </div>
                  <div className="exception-actions">
                    <button className="edit-btn" onClick={() => startEdit(i)}>{t('calendar.editTemplate')}</button>
                    <button className="delete-btn" onClick={() => deleteException(i)} title={t('calendar.removeException')}>×</button>
                  </div>
                </div>
              ))}
            </div>
          )}
          <p className="hint-text">{t('calendar.expiredNote')}</p>
        </>
      )}
    </div>
  );
}
