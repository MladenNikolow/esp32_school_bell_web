import React, { useEffect, useState, useCallback } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import {
  fetchExceptions, fetchExceptionById,
  createException, updateException, deleteException, deleteAllExceptions,
  clearErrorExceptions, clearSaveSuccessExceptions, clearExceptionDetail,
} from '../ScheduleSlice.js';
import BellSetEditor from '../components/BellSetEditor.jsx';
import HolidayImportDialog from '../components/HolidayImportDialog.jsx';
import useLocale from '../../../hooks/useLocale.jsx';
import useScrollIntoViewWhen from '../../../hooks/useScrollIntoViewWhen.js';

const ACTIONS = ['dayOff', 'template', 'custom'];

/** Client-side validation mirroring the firmware's own checks, so users get
 *  immediate feedback instead of a round-trip 400. Returns a translation key
 *  (or null when the form is valid). */
function validateExceptionForm(form, templates) {
  if (!form.startDate) return 'schedule.exceptions.errStartRequired';
  if (form.endDate && form.endDate < form.startDate) return 'schedule.exceptions.errEndBeforeStart';
  if (form.action === 'custom' && !(form.customBells?.bells?.length > 0)) {
    return 'schedule.exceptions.errCustomEmpty';
  }
  if (form.action === 'template') {
    const tpl = templates?.[form.templateIdx ?? 0];
    if (!tpl || !(tpl.bells?.length > 0)) return 'schedule.exceptions.errTemplateEmpty';
  }
  return null;
}

/* Inline SVG icons (consistent with HolidayImportDialog) */
const IconChevronLeft = (props) => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"
    aria-hidden="true" {...props}>
    <polyline points="15 18 9 12 15 6" />
  </svg>
);
const IconChevronRight = (props) => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"
    aria-hidden="true" {...props}>
    <polyline points="9 18 15 12 9 6" />
  </svg>
);
const IconCalendar = (props) => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
    aria-hidden="true" {...props}>
    <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
    <line x1="16" y1="2" x2="16" y2="6" />
    <line x1="8" y1="2" x2="8" y2="6" />
    <line x1="3" y1="10" x2="21" y2="10" />
  </svg>
);
const IconTrash = (props) => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
    aria-hidden="true" {...props}>
    <polyline points="3 6 5 6 21 6" />
    <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
    <path d="M10 11v6" />
    <path d="M14 11v6" />
    <path d="M9 6V4a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2" />
  </svg>
);

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
  const { t, bellWord } = useLocale();
  const { exceptions: exState, exceptionDetail, templates, builtins, savingExceptions, errorExceptions, saveSuccessExceptions } =
    useSelector((s) => s.schedule);
  const { items, total, offset, limit, hasMore, loading } = exState;
  const saving = savingExceptions;
  const error = errorExceptions;
  const saveSuccess = saveSuccessExceptions;
  const statusBannerRef = useScrollIntoViewWhen(Boolean(error || saveSuccess));

  // Which cards are open: Set<id>  (new items use 'new')
  const [openIds, setOpenIds] = useState(new Set());

  // Local edit state per card: Map<id, formValues>
  const [editForms, setEditForms] = useState(new Map());

  // Per-card validation error (keyed by id, or 'new' for the create draft)
  const [formErrors, setFormErrors] = useState(new Map());

  // "New exception" draft (null = not adding)
  const [newDraft, setNewDraft] = useState(null);

  // Holiday import dialog
  const [holidayDialogOpen, setHolidayDialogOpen] = useState(false);

  // Delete-all confirmation
  const [confirmDeleteAll, setConfirmDeleteAll] = useState(false);

  // Single-delete confirmation -id awaiting confirmation, or null
  const [confirmDeleteId, setConfirmDeleteId] = useState(null);

  // Overlap warning surfaced by the API after create/update
  const [overlapNotice, setOverlapNotice] = useState(null); // { ids: [...] }

  const loadPage = useCallback((pageOffset) => {
    dispatch(fetchExceptions({ offset: pageOffset, limit }));
  }, [dispatch, limit]);

  useEffect(() => {
    loadPage(0);
  }, [loadPage]);

  useEffect(() => {
    if (saveSuccess) {
      const id = setTimeout(() => dispatch(clearSaveSuccessExceptions()), 3000);
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

  const setFormError = (key, msg) =>
    setFormErrors((prev) => { const m = new Map(prev); if (msg) m.set(key, msg); else m.delete(key); return m; });

  const handleSaveExisting = async (id) => {
    const form = editForms.get(id);
    if (!form) return;
    const validationKey = validateExceptionForm(form, templates);
    if (validationKey) { setFormError(id, t(validationKey)); return; }
    setFormError(id, null);
    const payload = {
      startDate:      form.startDate,
      endDate:        form.endDate,
      label:          form.label,
      action:         form.action,
      templateIdx:    form.templateIdx ?? 0,
      timeOffsetMin:  0,
      customBells:    form.action === 'custom'
                        ? { bells: (form.customBells?.bells ?? []).map(({ _id, ...b }) => b) }
                        : undefined,
    };
    try {
      const result = await dispatch(updateException({ id, data: payload })).unwrap();
      setOverlapNotice(result?.overlapWarning ? { ids: result.overlappingIds || [] } : null);
      // Reload this item's detail and the list
      dispatch(clearExceptionDetail(id));
      loadPage(offset);
    } catch { /* error surfaces via state */ }
  };

  const handleDelete = async (id) => {
    await dispatch(deleteException(id)).unwrap();
    setOpenIds((prev) => { const s = new Set(prev); s.delete(id); return s; });
    setEditForms((prev) => { const m = new Map(prev); m.delete(id); return m; });
    setFormError(id, null);
    dispatch(clearExceptionDetail(id));
    // Reload current page (or previous page if it became empty)
    const newOffset = items.length === 1 && offset > 0 ? offset - limit : offset;
    loadPage(newOffset);
  };

  const handleCreateSave = async () => {
    if (!newDraft) return;
    const validationKey = validateExceptionForm(newDraft, templates);
    if (validationKey) { setFormError('new', t(validationKey)); return; }
    setFormError('new', null);
    const payload = {
      startDate:     newDraft.startDate,
      endDate:       newDraft.endDate,
      label:         newDraft.label,
      action:        newDraft.action,
      templateIdx:   newDraft.templateIdx ?? 0,
      timeOffsetMin: 0,
      customBells:   newDraft.action === 'custom'
                       ? { bells: (newDraft.customBells?.bells ?? []).map(({ _id, ...b }) => b) }
                       : undefined,
    };
    try {
      const result = await dispatch(createException(payload)).unwrap();
      setOverlapNotice(result?.overlapWarning ? { ids: result.overlappingIds || [] } : null);
      setNewDraft(null);
      loadPage(0); // Go back to first page to see the new item
    } catch { /* error surfaces via state */ }
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
          placeholder={t('calendar.exHolPlaceholder')} maxLength={95} />
      </div>
      <div className="form-group">
        <label className="form-label">{t('calendar.action')}</label>
        <select className="form-select" value={form.action}
          onChange={(e) => onPatch({ action: e.target.value })}>
          {ACTIONS.map((a) => <option key={a} value={a}>{actionLabel(a)}</option>)}
        </select>
      </div>
      {form.action === 'template' && (
        <div className="form-group">
          <label className="form-label">{t('calendar.selectTemplate')}</label>
          <select className="form-select" value={form.templateIdx ?? 0}
            onChange={(e) => onPatch({ templateIdx: parseInt(e.target.value, 10) })}>
            {templateOptions.length > 0
              ? templateOptions.map((o) => <option key={o.idx} value={o.idx}>{o.label}</option>)
              : <option disabled>{t('calendar.noTemplates')}</option>}
          </select>
        </div>
      )}
      {form.action === 'custom' && (
        <div className="form-group">
          <label className="form-label">
            {t('calendar.customBells', {
              count: form.customBells?.bells?.length ?? 0,
              bellWord: bellWord(form.customBells?.bells?.length ?? 0),
            })}
          </label>
          <BellSetEditor
            value={form.customBells || { bells: [] }}
            onChange={(bellSet) => onPatch({ customBells: bellSet })}
            allowApplyTemplate
            templates={templates}
            builtins={builtins}
          />
        </div>
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
          <button
            type="button"
            className="save-button holiday-import-btn"
            onClick={() => setHolidayDialogOpen(true)}
            title={t('schedule.holidayImport.openButtonTooltip')}
          >
            <IconCalendar style={{ marginRight: 6, verticalAlign: '-3px' }} />
            {t('schedule.holidayImport.openButton')}
          </button>
          {items.length > 0 && (
            <button
              type="button"
              className="danger-button delete-all-btn"
              onClick={() => setConfirmDeleteAll(true)}
              disabled={saving}
              title={t('schedule.deleteAllTooltip')}
            >
              <IconTrash style={{ marginRight: 6, verticalAlign: '-3px' }} />
              {t('schedule.deleteAll')}
            </button>
          )}
        </div>
      </div>

      {(error || saveSuccess) && (
        <div ref={statusBannerRef} className="status-banner-anchor">
          {error && (
            <div className="error-message">
              {error}
              <button className="error-dismiss" onClick={() => dispatch(clearErrorExceptions())}>×</button>
            </div>
          )}
          {saveSuccess && (
            <div className="success-message">{t('schedule.savedSuccess')}</div>
          )}
        </div>
      )}

      {overlapNotice && (
        <div className="warning-banner">
          {t('schedule.exceptions.overlapWarning', { ids: overlapNotice.ids.join(', ') })}
          <button className="error-dismiss" onClick={() => setOverlapNotice(null)}>×</button>
        </div>
      )}

      {/* New exception draft card */}
      {newDraft && (
        <div className="collapsible-card open">
          <div className="collapsible-card-header">
            <span className="cc-dates">{t('calendar.addException')}</span>
          </div>
          <div className="collapsible-card-body">
            {renderForm(newDraft, (patch) => setNewDraft((prev) => ({ ...prev, ...patch })))}
            {formErrors.get('new') && <div className="error-message">{formErrors.get('new')}</div>}
            <div className="action-bar">
              <button type="button" className="cancel-button"
                onClick={() => { setNewDraft(null); setFormError('new', null); }}>{t('schedule.cancel')}</button>
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
                        {ex.endDate && ex.endDate !== ex.startDate && <> – {ex.endDate}</>}
                      </span>
                      {ex.label && <span className="cc-exc-label">{ex.label}</span>}
                      <span className={`exception-action exception-action-${ex.action}`}>
                        {actionLabel(ex.action)}
                      </span>
                      {ex.action === 'custom' && (
                        <span className="cc-summary">{bellCount} {bellWord(bellCount)}</span>
                      )}
                      {ex.action === 'template' && ex.templateIdx !== undefined && (
                        <span className="cc-summary">
                          {templates[ex.templateIdx]?.name || t('calendar.templateSlot', { n: (ex.templateIdx ?? 0) + 1 })}
                        </span>
                      )}
                      <button type="button" className="delete-btn"
                        onClick={(e) => { e.stopPropagation(); setConfirmDeleteId(ex.id); }}
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
                            {formErrors.get(ex.id) && <div className="error-message">{formErrors.get(ex.id)}</div>}
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
              <button type="button" className="page-btn page-btn-nav"
                disabled={offset === 0}
                onClick={() => loadPage(Math.max(0, offset - limit))}
                aria-label={t('schedule.prev')}>
                <IconChevronLeft />
                <span>{t('schedule.prev')}</span>
              </button>
              <span className="page-info">
                {offset + 1}–{Math.min(offset + limit, total)} / {total}
              </span>
              <button type="button" className="page-btn page-btn-nav"
                disabled={!hasMore}
                onClick={() => loadPage(offset + limit)}
                aria-label={t('schedule.next')}>
                <span>{t('schedule.next')}</span>
                <IconChevronRight />
              </button>
            </div>
          )}

          <p className="hint-text">{t('calendar.expiredNote')}</p>
        </>
      )}

      <HolidayImportDialog
        open={holidayDialogOpen}
        onClose={(didApply) => {
          setHolidayDialogOpen(false);
          if (didApply) loadPage(0);
        }}
      />

      {confirmDeleteAll && (
        <div className="confirm-modal-backdrop" role="dialog" aria-modal="true"
          onClick={(e) => { if (e.target === e.currentTarget) setConfirmDeleteAll(false); }}>
          <div className="confirm-modal">
            <h3>{t('schedule.deleteAllTitle')}</h3>
            <p>{t('schedule.deleteAllConfirm')}</p>
            <div className="confirm-modal-actions">
              <button type="button" className="cancel-button"
                onClick={() => setConfirmDeleteAll(false)} disabled={saving}>
                {t('schedule.cancel')}
              </button>
              <button type="button" className="danger-button"
                disabled={saving}
                onClick={async () => {
                  try {
                    await dispatch(deleteAllExceptions()).unwrap();
                    setConfirmDeleteAll(false);
                    loadPage(0);
                  } catch { /* error surfaces via state */ }
                }}>
                <IconTrash style={{ marginRight: 6, verticalAlign: '-3px' }} />
                {saving ? t('schedule.saving') : t('schedule.deleteAll')}
              </button>
            </div>
          </div>
        </div>
      )}

      {confirmDeleteId != null && (
        <div className="confirm-modal-backdrop" role="dialog" aria-modal="true"
          onClick={(e) => { if (e.target === e.currentTarget) setConfirmDeleteId(null); }}>
          <div className="confirm-modal">
            <h3>{t('schedule.exceptions.deleteConfirmTitle')}</h3>
            <p>{t('schedule.exceptions.deleteConfirmBody')}</p>
            <div className="confirm-modal-actions">
              <button type="button" className="cancel-button"
                onClick={() => setConfirmDeleteId(null)} disabled={saving}>
                {t('schedule.cancel')}
              </button>
              <button type="button" className="danger-button"
                disabled={saving}
                onClick={async () => {
                  const id = confirmDeleteId;
                  setConfirmDeleteId(null);
                  await handleDelete(id);
                }}>
                <IconTrash style={{ marginRight: 6, verticalAlign: '-3px' }} />
                {saving ? t('schedule.saving') : t('calendar.removeException')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
