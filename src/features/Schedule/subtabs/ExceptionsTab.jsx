import React, { useEffect, useState, useCallback } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import {
  fetchExceptions, fetchExceptionById,
  createException, updateException, deleteException,
  fetchTemplates,
  clearError, clearSaveSuccess, clearExceptionDetail,
} from '../ScheduleSlice.js';
import BellSetEditor from '../components/BellSetEditor.jsx';
import useLocale from '../../../hooks/useLocale.jsx';

const ACTIONS = ['dayOff', 'template', 'custom'];

function today() {
  return new Date().toISOString().slice(0, 10);
}

function emptyExceptionForm() {
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

/** Merge metadata item with detail (if loaded) into an edit form */
function mergeDetail(meta, detail) {
  if (!detail) return { ...meta, customBells: meta.customBells ?? { bells: [] } };
  return { ...meta, ...detail };
}

export default function ExceptionsTab() {
  const dispatch = useDispatch();
  const { t } = useLocale();
  const { exceptions: exState, exceptionDetail, templates, builtins, saving, error, saveSuccess } =
    useSelector((s) => s.schedule);
  const { items, total, offset, limit, hasMore, loading } = exState;

  // Which cards are open: Set<id>  (new items use 'new')
  const [openIds, setOpenIds] = useState(new Set());

  // Local edit state per card: Map<id, formValues>
  const [editForms, setEditForms] = useState(new Map());

  // "New exception" draft (null = not adding)
  const [newDraft, setNewDraft] = useState(null);

  const loadPage = useCallback((pageOffset) => {
    dispatch(fetchExceptions({ offset: pageOffset, limit }));
  }, [dispatch, limit]);

  useEffect(() => {
    loadPage(0);
  }, [loadPage]);

  // Templates are needed to resolve template-based exceptions and to power the
  // "Apply Template" picker inside the custom-bell editor. They might not be
  // loaded yet if the user lands directly on the Exceptions tab.
  useEffect(() => {
    dispatch(fetchTemplates());
  }, [dispatch]);

  useEffect(() => {
    if (saveSuccess) {
      const id = setTimeout(() => dispatch(clearSaveSuccess()), 3000);
      return () => clearTimeout(id);
    }
  }, [saveSuccess, dispatch]);

  const toggleCard = (id) => {
    const next = new Set(openIds);
    if (next.has(id)) {
      next.delete(id);
    } else {
      next.add(id);
      // Fetch detail if not cached
      if (!exceptionDetail[id]) {
        dispatch(fetchExceptionById(id));
      }
      // Pre-populate edit form with metadata until detail arrives
      const meta = items.find((ex) => ex.id === id);
      if (meta && !editForms.has(id)) {
        setEditForms((prev) => new Map(prev).set(id, mergeDetail(meta, exceptionDetail[id])));
      }
    }
    setOpenIds(next);
  };

  // When detail loads, sync the edit form for open cards
  useEffect(() => {
    setEditForms((prev) => {
      const next = new Map(prev);
      let changed = false;
      for (const id of openIds) {
        const detail = exceptionDetail[id];
        if (detail && next.has(id)) {
          const current = next.get(id);
          // Only sync if we don't yet have customBells (i.e. we only had metadata)
          if (!current.customBells?.bells?.length && detail.customBells?.bells?.length) {
            next.set(id, mergeDetail(current, detail));
            changed = true;
          }
        }
      }
      return changed ? next : prev;
    });
  }, [exceptionDetail, openIds]);

  const patchForm = (id, patch) => {
    setEditForms((prev) => {
      const current = prev.get(id) ?? {};
      return new Map(prev).set(id, { ...current, ...patch });
    });
  };

  const handleSaveExisting = async (id) => {
    const form = editForms.get(id);
    if (!form) return;
    const payload = {
      startDate:      form.startDate,
      endDate:        form.endDate,
      label:          form.label,
      action:         form.action,
      templateIdx:    form.templateIdx ?? 0,
      timeOffsetMin:  form.timeOffsetMin ?? 0,
      customBells:    form.action === 'custom'
                        ? { bells: (form.customBells?.bells ?? []).map(({ _id, ...b }) => b) }
                        : undefined,
    };
    await dispatch(updateException({ id, data: payload })).unwrap();
    // Reload this item's detail and the list
    dispatch(clearExceptionDetail(id));
    loadPage(offset);
  };

  const handleDelete = async (id) => {
    await dispatch(deleteException(id)).unwrap();
    setOpenIds((prev) => { const s = new Set(prev); s.delete(id); return s; });
    setEditForms((prev) => { const m = new Map(prev); m.delete(id); return m; });
    dispatch(clearExceptionDetail(id));
    // Reload current page (or previous page if it became empty)
    const newOffset = items.length === 1 && offset > 0 ? offset - limit : offset;
    loadPage(newOffset);
  };

  const handleCreateSave = async () => {
    if (!newDraft) return;
    const payload = {
      startDate:     newDraft.startDate,
      endDate:       newDraft.endDate,
      label:         newDraft.label,
      action:        newDraft.action,
      templateIdx:   newDraft.templateIdx ?? 0,
      timeOffsetMin: newDraft.timeOffsetMin ?? 0,
      customBells:   newDraft.action === 'custom'
                       ? { bells: (newDraft.customBells?.bells ?? []).map(({ _id, ...b }) => b) }
                       : undefined,
    };
    await dispatch(createException(payload)).unwrap();
    setNewDraft(null);
    loadPage(0); // Go back to first page to see the new item
  };

  const actionLabel = (action) => t(`calendar.action_${action}`) || action;

  const templateOptions = templates
    .map((tpl, i) => tpl ? { idx: i, label: tpl.name || t('calendar.templateSlot', { n: i + 1 }) } : null)
    .filter(Boolean);

  const renderForm = (form, onPatch) => (
    <>
      <div className="form-group">
        <label className="form-label">{t('calendar.startDate')}</label>
        <input type="date" className="form-input" value={form.startDate}
          onChange={(e) => onPatch({ startDate: e.target.value })} />
      </div>
      <div className="form-group">
        <label className="form-label">{t('calendar.endDate')}</label>
        <input type="date" className="form-input" value={form.endDate}
          onChange={(e) => onPatch({ endDate: e.target.value })} />
      </div>
      <div className="form-group">
        <label className="form-label">{t('calendar.label')}</label>
        <input type="text" className="form-input" value={form.label}
          onChange={(e) => onPatch({ label: e.target.value })}
          placeholder={t('calendar.exHolPlaceholder')} maxLength={63} />
      </div>
      <div className="form-group">
        <label className="form-label">{t('calendar.action')}</label>
        <select className="form-select" value={form.action}
          onChange={(e) => onPatch({ action: e.target.value })}>
          {ACTIONS.map((a) => <option key={a} value={a}>{actionLabel(a)}</option>)}
        </select>
      </div>
      {form.action === 'template' && (
        <>
          <div className="form-group">
            <label className="form-label">{t('calendar.selectTemplate')}</label>
            <select className="form-select" value={form.templateIdx ?? 0}
              onChange={(e) => onPatch({ templateIdx: parseInt(e.target.value, 10) })}>
              {templateOptions.length > 0
                ? templateOptions.map((o) => <option key={o.idx} value={o.idx}>{o.label}</option>)
                : <option disabled>{t('calendar.noTemplates')}</option>}
            </select>
          </div>
          <div className="form-group">
            <label className="form-label">{t('calendar.timeOffset')}</label>
            <div className="form-row">
              <input type="number" className="duration-input" min={-240} max={240}
                value={form.timeOffsetMin}
                onChange={(e) => onPatch({ timeOffsetMin: parseInt(e.target.value, 10) || 0 })} />
              <span className="form-unit">{t('calendar.min')}</span>
            </div>
          </div>
        </>
      )}
      {form.action === 'custom' && (
        <>
          <div className="form-group">
            <label className="form-label">{t('calendar.timeOffset')}</label>
            <div className="form-row">
              <input type="number" className="duration-input" min={-240} max={240}
                value={form.timeOffsetMin}
                onChange={(e) => onPatch({ timeOffsetMin: parseInt(e.target.value, 10) || 0 })} />
              <span className="form-unit">{t('calendar.min')}</span>
            </div>
          </div>
          <div className="form-group">
            <label className="form-label">
              {t('calendar.customBells', { count: form.customBells?.bells?.length ?? 0 })}
            </label>
            <BellSetEditor
              value={form.customBells || { bells: [] }}
              onChange={(bellSet) => onPatch({ customBells: bellSet })}
              allowApplyTemplate
              templates={templates}
              builtins={builtins}
            />
          </div>
        </>
      )}
    </>
  );

  return (
    <div className="schedule-tab-pane">
      <div className="tab-header">
        <h2>{t('schedule.exceptions')}</h2>
        <div className="tab-header-actions">
          {!newDraft && (
            <button type="button" className="save-button" onClick={() => setNewDraft(emptyExceptionForm())}>
              {t('calendar.addException')}
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

      {/* New exception draft card */}
      {newDraft && (
        <div className="collapsible-card open">
          <div className="collapsible-card-header">
            <span className="cc-dates">{t('calendar.addException')}</span>
          </div>
          <div className="collapsible-card-body">
            {renderForm(newDraft, (patch) => setNewDraft((prev) => ({ ...prev, ...patch })))}
            <div className="action-bar">
              <button type="button" className="cancel-button"
                onClick={() => setNewDraft(null)}>{t('schedule.cancel')}</button>
              <button type="button"
                className={`save-button${saving ? ' loading' : ''}`}
                onClick={handleCreateSave} disabled={saving}>
                {saving ? t('schedule.saving') : t('schedule.save')}
              </button>
            </div>
          </div>
        </div>
      )}

      {loading ? (
        <p className="loading-text">{t('schedule.loading')}</p>
      ) : (
        <>
          {items.length === 0 && !newDraft ? (
            <p className="empty-text">{t('calendar.noExceptions')}</p>
          ) : (
            <div className="exceptions-list">
              {items.map((ex) => {
                const isOpen = openIds.has(ex.id);
                const form   = editForms.get(ex.id);
                const detail = exceptionDetail[ex.id];
                const bellCount = ex.action === 'custom'
                  ? (detail?.customBells?.bells?.length ?? ex.bellCount ?? 0)
                  : 0;

                return (
                  <div key={ex.id} className={`collapsible-card${isOpen ? ' open' : ''}`}>
                    <div className="collapsible-card-header"
                      onClick={() => toggleCard(ex.id)}
                      role="button" tabIndex={0}
                      onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && toggleCard(ex.id)}
                      aria-expanded={isOpen}>
                      <span className="cc-chevron">{isOpen ? '▼' : '▶'}</span>
                      <span className="cc-dates">
                        {ex.startDate}
                        {ex.endDate && ex.endDate !== ex.startDate && <> в†’ {ex.endDate}</>}
                      </span>
                      {ex.label && <span className="cc-exc-label">{ex.label}</span>}
                      <span className={`exception-action exception-action-${ex.action}`}>
                        {actionLabel(ex.action)}
                      </span>
                      {ex.action === 'custom' && (
                        <span className="cc-summary">{bellCount} {t('schedule.bellsCount')}</span>
                      )}
                      {ex.action === 'template' && ex.templateIdx !== undefined && (
                        <span className="cc-summary">
                          {templates[ex.templateIdx]?.name || t('calendar.templateSlot', { n: (ex.templateIdx ?? 0) + 1 })}
                        </span>
                      )}
                      <button type="button" className="delete-btn"
                        onClick={(e) => { e.stopPropagation(); handleDelete(ex.id); }}
                        title={t('calendar.removeException')}>×</button>
                    </div>

                    {isOpen && (
                      <div className="collapsible-card-body">
                        {!detail && !form ? (
                          <p className="loading-text">{t('schedule.loading')}</p>
                        ) : (
                          <>
                            {renderForm(
                              form ?? mergeDetail(ex, detail),
                              (patch) => patchForm(ex.id, patch)
                            )}
                            <div className="action-bar">
                              <button type="button"
                                className={`save-button${saving ? ' loading' : ''}`}
                                onClick={() => handleSaveExisting(ex.id)} disabled={saving}>
                                {saving ? t('schedule.saving') : t('schedule.save')}
                              </button>
                            </div>
                          </>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {/* Pagination controls */}
          {total > limit && (
            <div className="pagination-bar">
              <button type="button" className="page-btn"
                disabled={offset === 0}
                onClick={() => loadPage(Math.max(0, offset - limit))}>
                в†ђ {t('schedule.prev')}
              </button>
              <span className="page-info">
                {offset + 1}вЂ“{Math.min(offset + limit, total)} / {total}
              </span>
              <button type="button" className="page-btn"
                disabled={!hasMore}
                onClick={() => loadPage(offset + limit)}>
                {t('schedule.next')} в†’
              </button>
            </div>
          )}

          <p className="hint-text">{t('calendar.expiredNote')}</p>
        </>
      )}
    </div>
  );
}
