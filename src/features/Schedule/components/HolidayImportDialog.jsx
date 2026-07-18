import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useSelector } from 'react-redux';
import ScheduleService from '../../../services/ScheduleService.js';
import useLocale from '../../../hooks/useLocale.jsx';

/* ------------------------------------------------------------------ */
/* Constants & helpers                                                 */
/* ------------------------------------------------------------------ */

const SOURCE_LABEL = {
  holiday_bg_public: 'schedule.holidayImport.sourcePublic',
  holiday_bg_school: 'schedule.holidayImport.sourceSchool',
};

const STRATEGIES = ['skip', 'overwrite', 'keepBoth'];

/** Backend cap: SCHEDULE_EXCEPTION_LABEL_MAX_LEN (96) minus 1 for NUL terminator. */
const LABEL_MAX_LEN = 95;

/** Validate a per-row payload. Returns null if valid, or a translation
 *  key + params describing the first problem encountered. */
function validateRow(start, end, label) {
  const s = (start || '').trim();
  const e = (end || s).trim();
  const l = (label || '').trim();
  if (!l) return { key: 'schedule.holidayImport.errLabelEmpty' };
  if (l.length > LABEL_MAX_LEN)
    return { key: 'schedule.holidayImport.errLabelTooLong', params: { max: LABEL_MAX_LEN } };
  if (s && e && e < s)
    return { key: 'schedule.holidayImport.errEndBeforeStart' };
  return null;
}

/** Classify the conflicting exception: another imported holiday vs. user-created. */
function conflictKind(conflictSrc) {
  if (!conflictSrc) return 'none';
  if (typeof conflictSrc === 'string' && conflictSrc.indexOf('holiday') === 0) return 'holiday';
  return 'manual';
}

const YEAR_MIN = 2024;
const YEAR_MAX = 2100;

function fmtDateRange(start, end) {
  if (!end || end === start) return start;
  return `${start} – ${end}`;
}

function makeRowKey(item, idx) {
  return `${item.source}:${item.tag || `${item.startDate}:${idx}`}`;
}

function clampYear(y) {
  if (!Number.isFinite(y)) return new Date().getFullYear();
  return Math.max(YEAR_MIN, Math.min(YEAR_MAX, y));
}

/** Format an ISO 8601 timestamp as a short local datetime, or return raw on failure. */
function formatFetchedAt(iso, locale) {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  try {
    return d.toLocaleString(locale === 'bg' ? 'bg-BG' : 'en-GB', {
      year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit',
    });
  } catch {
    return iso;
  }
}

/* ---------- Inline SVG icons (avoid font-glyph mojibake) ---------- */
function IconDownload() {
  return (
    <svg className="hid-icon" width="14" height="14" viewBox="0 0 24 24"
         fill="none" stroke="currentColor" strokeWidth="2.2"
         strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M12 4v12" /><path d="M6 12l6 6 6-6" /><path d="M5 20h14" />
    </svg>
  );
}
function IconClock() {
  return (
    <svg className="hid-icon" width="13" height="13" viewBox="0 0 24 24"
         fill="none" stroke="currentColor" strokeWidth="2"
         strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" />
    </svg>
  );
}
function IconCalendar() {
  return (
    <svg className="hid-icon hid-icon-lg" width="48" height="48" viewBox="0 0 24 24"
         fill="none" stroke="currentColor" strokeWidth="1.6"
         strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="3" y="5" width="18" height="16" rx="2" />
      <path d="M3 9h18" /><path d="M8 3v4" /><path d="M16 3v4" />
    </svg>
  );
}
function IconChevronLeft() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
         stroke="currentColor" strokeWidth="2.4"
         strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M15 6l-6 6 6 6" />
    </svg>
  );
}
function IconChevronRight() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
         stroke="currentColor" strokeWidth="2.4"
         strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M9 6l6 6-6 6" />
    </svg>
  );
}
function IconAlert() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none"
         stroke="currentColor" strokeWidth="2.2"
         strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M12 3l10 18H2L12 3z" /><path d="M12 10v5" /><path d="M12 18h.01" />
    </svg>
  );
}
function IconReset() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none"
         stroke="currentColor" strokeWidth="2.2"
         strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M3 12a9 9 0 1 0 3-6.7" /><path d="M3 4v5h5" />
    </svg>
  );
}

/** Small inline spinner used inside buttons. */
function InlineSpinner({ size = 14 }) {
  return (
    <span
      className="hid-inline-spinner"
      style={{ width: size, height: size }}
      aria-hidden="true"
    />
  );
}

/* ------------------------------------------------------------------ */
/* Dialog                                                              */
/* ------------------------------------------------------------------ */

/**
 * Props:
 *  - open: boolean
 *  - initialYear: number (defaults to current year)
 *  - preloaded: { year, fetchedAt, items } | null  (skips initial fetch)
 *  - onClose(refresh?: boolean)
 */
export default function HolidayImportDialog({
  open,
  initialYear,
  preloaded,
  onClose,
}) {
  const { t, locale } = useLocale();
  /* OpenHolidays API expects ISO codes: BG / EN. */
  const apiLang = (locale || 'bg').toUpperCase();

  const [year, setYear] = useState(() =>
    clampYear(preloaded?.year ?? initialYear ?? new Date().getFullYear()),
  );
  const [items, setItems] = useState(() => preloaded?.items ?? null);
  const [fetchedAt, setFetchedAt] = useState(preloaded?.fetchedAt ?? '');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const [selection, setSelection] = useState(() => new Set());
  const [globalAction, setGlobalAction] = useState('dayOff');
  const [globalTemplateIdx, setGlobalTemplateIdx] = useState(0);
  const [globalStrategy, setGlobalStrategy] = useState('skip');
  /** Per-row override: Map<key, { action?, conflictAction?, templateIdx? }> */
  const [overrides, setOverrides] = useState(() => new Map());

  /** Shared Schedule cache; the dialog never starts its own templates GET. */
  const templates = useSelector((state) => state.schedule.templates);

  const [submitting, setSubmitting] = useState(false);
  const [resultMsg, setResultMsg] = useState('');

  /** Tracks in-flight preview so we can cancel on re-fetch / close. */
  const abortRef = useRef(null);

  /* ---------- Reset state when dialog opens ---------- */
  useEffect(() => {
    if (!open) return;
    setError('');
    setResultMsg('');
    setOverrides(new Map());
    if (preloaded) {
      setYear(clampYear(preloaded.year));
      setItems(preloaded.items);
      setFetchedAt(preloaded.fetchedAt);
      const initSel = new Set();
      (preloaded.items || []).forEach((it, i) => {
        if (!it.alreadyImported) initSel.add(makeRowKey(it, i));
      });
      setSelection(initSel);
    } else {
      setYear(clampYear(initialYear ?? new Date().getFullYear()));
      setItems(null);
      setFetchedAt('');
      setSelection(new Set());
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const firstUsed = templates.findIndex((tpl) => tpl);
    if (firstUsed >= 0) setGlobalTemplateIdx(firstUsed);
  }, [open, templates]);

  /* ---------- Abort any in-flight request when dialog closes ---------- */
  useEffect(() => {
    if (!open && abortRef.current) {
      abortRef.current.abort();
      abortRef.current = null;
    }
    return () => {
      if (abortRef.current) {
        abortRef.current.abort();
        abortRef.current = null;
      }
    };
  }, [open]);

  /* ---------- Escape key closes (when not busy) ---------- */
  useEffect(() => {
    if (!open) return;
    const handler = (e) => {
      if (e.key === 'Escape' && !loading && !submitting) {
        onClose?.(false);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [open, loading, submitting, onClose]);

  /* ---------- Fetch preview ---------- */
  const runPreview = async (yArg) => {
    const y = clampYear(yArg);
    if (y !== yArg) setYear(y);

    // Cancel any previous in-flight preview before starting a new one.
    if (abortRef.current) abortRef.current.abort();
    const ctrl = new AbortController();
    abortRef.current = ctrl;

    setLoading(true);
    setError('');
    setItems(null);
    setOverrides(new Map());
    try {
      const data = await ScheduleService.previewHolidays(y, apiLang, ctrl.signal);
      if (ctrl.signal.aborted) return; // stale response
      setItems(data.items || []);
      setFetchedAt(data.fetchedAt || '');
      const sel = new Set();
      (data.items || []).forEach((it, i) => {
        if (!it.alreadyImported) sel.add(makeRowKey(it, i));
      });
      setSelection(sel);
    } catch (e) {
      if (ctrl.signal.aborted || e?.name === 'AbortError') return;
      setError(e?.message || t('schedule.holidayImport.errFetch'));
    } finally {
      if (abortRef.current === ctrl) abortRef.current = null;
      setLoading(false);
    }
  };

  const cancelLoading = () => {
    if (abortRef.current) abortRef.current.abort();
    abortRef.current = null;
    setLoading(false);
  };

  /* ---------- Derived ---------- */
  const rows = useMemo(() => {
    if (!items) return [];
    return items.map((it, i) => ({ key: makeRowKey(it, i), idx: i, item: it }));
  }, [items]);

  /**
   * Display order: conflicts first (most attention), then new items, then
   * already-imported (lowest priority). Within each group, sort by start date.
   * Original `idx` (insertion order) is preserved as final tiebreaker.
   */
  const orderedRows = useMemo(() => {
    const priority = (it) => (it.conflict ? 0 : it.alreadyImported ? 2 : 1);
    return [...rows].sort((a, b) => {
      const p = priority(a.item) - priority(b.item);
      if (p) return p;
      const da = a.item.startDate || '';
      const db = b.item.startDate || '';
      if (da !== db) return da < db ? -1 : 1;
      return a.idx - b.idx;
    });
  }, [rows]);

  const conflictCount = useMemo(
    () => rows.filter((r) => r.item.conflict).length,
    [rows],
  );
  const importedCount = useMemo(
    () => rows.filter((r) => r.item.alreadyImported).length,
    [rows],
  );

  const selectedCount = selection.size;

  /* ---------- Row helpers ---------- */
  const toggleRow = (key) => {
    setSelection((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const setOverride = (key, patch) => {
    setOverrides((prev) => {
      const next = new Map(prev);
      next.set(key, { ...(next.get(key) || {}), ...patch });
      return next;
    });
  };

  const selectAll = () => setSelection(new Set(rows.map((r) => r.key)));
  const selectNone = () => setSelection(new Set());
  const selectNonImported = () => {
    const s = new Set();
    rows.forEach((r) => { if (!r.item.alreadyImported) s.add(r.key); });
    setSelection(s);
  };

  const templateOptions = useMemo(
    () => templates
      .map((tpl, i) => (tpl ? {
        idx: i,
        label: tpl.name || t('schedule.holidayImport.templateSlot', { n: i + 1 }),
      } : null))
      .filter(Boolean),
    [templates, t],
  );
  const hasTemplates = templateOptions.length > 0;

  /* ---------- Apply ---------- */
  const onApply = async () => {
    if (selectedCount === 0) return;
    /* Defensive: block submit if any selected row fails validation. The UI
     * already disables the apply button in this case, but guard anyway. */
    for (const r of rows) {
      if (!selection.has(r.key)) continue;
      const ov = overrides.get(r.key) || {};
      const s = ov.startDate ?? r.item.startDate ?? '';
      const e = ov.endDate   ?? r.item.endDate   ?? s;
      const l = ov.label     ?? r.item.label     ?? '';
      if (validateRow(s, e, l)) return;
    }
    setSubmitting(true);
    setError('');
    setResultMsg('');
    try {
      const payload = {
        year,
        defaultAction: globalAction,
        conflictStrategy: globalStrategy,
        items: rows
          .filter((r) => selection.has(r.key))
          .map((r) => {
            const ov = overrides.get(r.key) || {};
            /* Per-row edits: dates + label. Fall back to the API-supplied
             * values when the user did not override them. End date defaults
             * to start when blank (single-day holidays). */
            const effStart = (ov.startDate || r.item.startDate || '').trim();
            const effEnd   = (ov.endDate   || r.item.endDate   || effStart).trim();
            const effLabel = (ov.label != null ? ov.label : r.item.label) || '';
            const out = {
              startDate: effStart,
              endDate:   effEnd,
              label:     effLabel,
              source:    r.item.source,
              tag:       r.item.tag,
            };
            const effectiveAction = ov.action || globalAction;
            if (ov.action) out.action = ov.action;
            /* Conflict handling:
             *  - holiday-vs-holiday  -> always skip (the day is already covered)
             *  - holiday-vs-manual   -> use the row override, else the global default
             */
            if (r.item.conflict) {
              const kind = conflictKind(r.item.conflict.source);
              if (kind === 'holiday') {
                out.conflictAction = 'skip';
              } else if (ov.conflictAction) {
                out.conflictAction = ov.conflictAction;
              }
            }
            /* Carry templateIdx whenever the (effective) action is 'template'. */
            if (effectiveAction === 'template') {
              out.templateIdx = Number.isFinite(ov.templateIdx)
                ? ov.templateIdx
                : globalTemplateIdx;
            }
            if (r.item.conflict?.exceptionId)
              out.conflictExceptionId = r.item.conflict.exceptionId;
            return out;
          }),
      };
      const res = await ScheduleService.applyHolidays(payload);
      setResultMsg(
        t('schedule.holidayImport.applyResult', {
          created: res.created ?? 0,
          updated: res.updated ?? 0,
          skipped: res.skipped ?? 0,
        }),
      );
      // Auto-close after short delay
      setTimeout(() => onClose?.(true), 1200);
    } catch (e) {
      setError(e?.message || t('schedule.holidayImport.errApply'));
    } finally {
      setSubmitting(false);
    }
  };

  /* Count selected rows with validation problems so we can disable Apply
   * and surface a friendly hint in the footer. Computed before the early
   * `open` guard so hook order stays stable across renders. */
  const invalidSelectedCount = useMemo(() => {
    if (!items) return 0;
    let n = 0;
    for (const r of rows) {
      if (!selection.has(r.key)) continue;
      const ov = overrides.get(r.key) || {};
      const s = ov.startDate ?? r.item.startDate ?? '';
      const e = ov.endDate   ?? r.item.endDate   ?? s;
      const l = ov.label     ?? r.item.label     ?? '';
      if (validateRow(s, e, l)) n++;
    }
    return n;
  }, [items, rows, selection, overrides]);

  if (!open) return null;

  const busy = loading || submitting;
  const hasItems = items !== null;
  const canApply = !busy && hasItems && selectedCount > 0 && invalidSelectedCount === 0;

  /* ---------- Render ---------- */
  return (
    <div className="modal-overlay" onClick={() => !busy && onClose?.(false)}>
      <div
        className="modal-dialog holiday-import-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="hid-title"
        onClick={(e) => e.stopPropagation()}
      >
        {/* ---------- Header ---------- */}
        <header className="hid-header">
          <div className="hid-header-text">
            <h3 id="hid-title">{t('schedule.holidayImport.title')}</h3>
            <p className="hid-subtitle">{t('schedule.holidayImport.subtitle')}</p>
          </div>
          <button
            type="button"
            className="hid-close"
            onClick={() => !busy && onClose?.(false)}
            disabled={busy}
            aria-label={t('schedule.cancel')}
            title={t('schedule.cancel')}
          >×</button>
        </header>

        {/* ---------- Year bar ---------- */}
        <div className="hid-yearbar">
          <div className="hid-yearbar-left">
            <label htmlFor="hid-year-input" className="hid-yearbar-label">
              {t('schedule.holidayImport.year')}
            </label>
            <div className="hid-year-stepper" role="group">
              <button
                type="button"
                className="hid-year-step"
                onClick={() => {
                  const ny = clampYear(year - 1);
                  setYear(ny);
                  if (!busy) runPreview(ny);
                }}
                disabled={busy || year <= YEAR_MIN}
                aria-label={t('schedule.holidayImport.prevYear')}
                title={t('schedule.holidayImport.prevYear')}
              ><IconChevronLeft /></button>
              <input
                id="hid-year-input"
                type="number"
                min={YEAR_MIN}
                max={YEAR_MAX}
                value={year}
                onChange={(e) => {
                  const v = parseInt(e.target.value, 10);
                  setYear(Number.isFinite(v) ? v : year);
                }}
                onBlur={() => setYear((y) => clampYear(y))}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !busy) runPreview(year);
                }}
                disabled={busy}
                className="hid-year-input"
                inputMode="numeric"
              />
              <button
                type="button"
                className="hid-year-step"
                onClick={() => {
                  const ny = clampYear(year + 1);
                  setYear(ny);
                  if (!busy) runPreview(ny);
                }}
                disabled={busy || year >= YEAR_MAX}
                aria-label={t('schedule.holidayImport.nextYear')}
                title={t('schedule.holidayImport.nextYear')}
              ><IconChevronRight /></button>
            </div>
            <button
              type="button"
              className="hid-fetch-btn"
              onClick={() => runPreview(year)}
              disabled={busy}
              title={t('schedule.holidayImport.fetchTooltip')}
            >
              {loading
                ? <InlineSpinner />
                : <IconDownload />}
              <span>
                {loading
                  ? t('schedule.holidayImport.loading')
                  : hasItems
                    ? t('schedule.holidayImport.refresh')
                    : t('schedule.holidayImport.fetch')}
              </span>
            </button>
            {loading && (
              <button
                type="button"
                className="hid-cancel-fetch"
                onClick={cancelLoading}
              >
                {t('schedule.cancel')}
              </button>
            )}
          </div>
          {fetchedAt && !loading && (
            <span className="hid-fetched" title={fetchedAt}>
              <IconClock />
              {t('schedule.holidayImport.fetchedAt')}: {formatFetchedAt(fetchedAt, locale)}
            </span>
          )}
        </div>

        {/* ---------- Messages ---------- */}
        {error && <div className="error-message hid-error">{error}</div>}
        {resultMsg && <div className="success-message hid-success">{resultMsg}</div>}

        {/* ---------- Body ---------- */}
        <div className="hid-body">
          {/* Empty state */}
          {!loading && !error && !hasItems && (
            <div className="hid-empty-state">
              <div className="hid-empty-icon" aria-hidden="true"><IconCalendar /></div>
              <p className="hid-empty-title">
                {t('schedule.holidayImport.emptyTitle')}
              </p>
              <p className="hid-empty-help">
                {t('schedule.holidayImport.help')}
              </p>
            </div>
          )}

          {/* Loading state */}
          {loading && (
            <div className="hid-loading-state" aria-busy="true" aria-live="polite">
              <div className="loading-spinner" />
              <p className="hid-loading-title">
                {t('schedule.holidayImport.fetchingTitle')}
              </p>
              <p className="hid-loading-sub">
                {t('schedule.holidayImport.fetchingSub')}
              </p>
            </div>
          )}

          {/* Loaded state */}
          {!loading && hasItems && (
            <>
              {/* How-it-works help banner */}
              <div className="hid-help-card" role="note">
                <div className="hid-help-title">
                  {t('schedule.holidayImport.helpTitle')}
                </div>
                <ol className="hid-help-steps">
                  <li>{t('schedule.holidayImport.helpStep1')}</li>
                  <li>{t('schedule.holidayImport.helpStep2')}</li>
                  <li>{t('schedule.holidayImport.helpStep3')}</li>
                </ol>
              </div>

              {/* Summary chips */}
              <div className="hid-chips" role="status" aria-live="polite">
                <span className="hid-chip hid-chip-total">
                  <span className="hid-chip-label">
                    {t('schedule.holidayImport.chipTotal')}
                  </span>
                  <span className="hid-chip-value">{rows.length}</span>
                </span>
                <span className="hid-chip hid-chip-selected">
                  <span className="hid-chip-label">
                    {t('schedule.holidayImport.chipSelected')}
                  </span>
                  <span className="hid-chip-value">{selectedCount}</span>
                </span>
                {importedCount > 0 && (
                  <span className="hid-chip hid-chip-imported">
                    <span className="hid-chip-label">
                      {t('schedule.holidayImport.chipImported')}
                    </span>
                    <span className="hid-chip-value">{importedCount}</span>
                  </span>
                )}
                {conflictCount > 0 && (
                  <span className="hid-chip hid-chip-conflict">
                    <span className="hid-chip-label">
                      {t('schedule.holidayImport.chipConflicts')}
                    </span>
                    <span className="hid-chip-value">{conflictCount}</span>
                  </span>
                )}
              </div>

              {/* Toolbar */}
              <div className="hid-toolbar">
                <div className="hid-toolbar-group hid-toolbar-selectors">
                  <span className="hid-toolbar-caption">
                    {t('schedule.holidayImport.selectionLabel')}
                  </span>
                  <button type="button" onClick={selectAll} disabled={submitting}>
                    {t('schedule.holidayImport.selectAll')}
                  </button>
                  <button type="button" onClick={selectNone} disabled={submitting}>
                    {t('schedule.holidayImport.selectNone')}
                  </button>
                  <button type="button" onClick={selectNonImported} disabled={submitting}>
                    {t('schedule.holidayImport.selectNew')}
                  </button>
                </div>
                <div className="hid-toolbar-group hid-toolbar-defaults">
                  <label className="hid-field">
                    <span>{t('schedule.holidayImport.defaultAction')}</span>
                    <select
                      value={globalAction}
                      onChange={(e) => setGlobalAction(e.target.value)}
                      disabled={submitting}
                    >
                      <option value="dayOff">{t('schedule.holidayImport.actionDayOff')}</option>
                      <option value="template" disabled={!hasTemplates}>
                        {t('schedule.holidayImport.actionTemplate')}
                        {!hasTemplates ? ` (${t('schedule.holidayImport.noTemplates')})` : ''}
                      </option>
                    </select>
                  </label>
                  {globalAction === 'template' && hasTemplates && (
                    <label className="hid-field">
                      <span>{t('schedule.holidayImport.templatePicker')}</span>
                      <select
                        value={globalTemplateIdx}
                        onChange={(e) =>
                          setGlobalTemplateIdx(parseInt(e.target.value, 10))
                        }
                        disabled={submitting}
                      >
                        {templateOptions.map((o) => (
                          <option key={o.idx} value={o.idx}>{o.label}</option>
                        ))}
                      </select>
                    </label>
                  )}
                  <label className="hid-field">
                    <span>{t('schedule.holidayImport.conflictStrategy')}</span>
                    <select
                      value={globalStrategy}
                      onChange={(e) => setGlobalStrategy(e.target.value)}
                      disabled={submitting}
                    >
                      {STRATEGIES.map((s) => (
                        <option key={s} value={s}>
                          {t(`schedule.holidayImport.strategy_${s}`)}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>
              </div>

              {/* Items table */}
              <div className="hid-table-wrap">
                <table className="hid-table">
                  <thead>
                    <tr>
                      <th className="hid-col-check" aria-label="select" />
                      <th className="hid-col-date">{t('schedule.holidayImport.colDate')}</th>
                      <th className="hid-col-label">{t('schedule.holidayImport.colLabel')}</th>
                      <th className="hid-col-source">{t('schedule.holidayImport.colSource')}</th>
                      <th className="hid-col-status">{t('schedule.holidayImport.colStatus')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {orderedRows.length === 0 && (
                      <tr><td colSpan={5} className="hid-empty">
                        {t('schedule.holidayImport.noItems')}
                      </td></tr>
                    )}
                    {orderedRows.map((r) => {
                      const it = r.item;
                      const checked = selection.has(r.key);
                      const ov = overrides.get(r.key) || {};
                      const editedStart = ov.startDate && ov.startDate !== it.startDate;
                      const editedEnd = ov.endDate && ov.endDate !== (it.endDate || it.startDate);
                      const editedLabel = ov.label != null && ov.label !== it.label;
                      const edited = editedStart || editedEnd || editedLabel;
                      const curStart = ov.startDate ?? it.startDate ?? '';
                      const curEnd   = ov.endDate   ?? it.endDate   ?? it.startDate ?? '';
                      const curLabel = ov.label    ?? it.label     ?? '';
                      const rowErr = checked ? validateRow(curStart, curEnd, curLabel) : null;
                      const dateErr   = rowErr?.key === 'schedule.holidayImport.errEndBeforeStart';
                      const labelErr  = rowErr?.key === 'schedule.holidayImport.errLabelEmpty'
                                     || rowErr?.key === 'schedule.holidayImport.errLabelTooLong';
                      const resetRow = () => setOverrides((prev) => {
                        const next = new Map(prev);
                        const cur = { ...(next.get(r.key) || {}) };
                        delete cur.startDate;
                        delete cur.endDate;
                        delete cur.label;
                        if (Object.keys(cur).length === 0) next.delete(r.key);
                        else next.set(r.key, cur);
                        return next;
                      });
                      const rowCls = [
                        it.alreadyImported ? 'hid-row-imported' : '',
                        it.conflict ? 'hid-row-conflict' : '',
                        edited ? 'hid-row-edited' : '',
                        rowErr ? 'hid-row-invalid' : '',
                      ].filter(Boolean).join(' ');
                      return (
                        <tr key={r.key} className={rowCls}>
                          <td className="hid-col-check">
                            <input
                              type="checkbox"
                              checked={checked}
                              onChange={() => toggleRow(r.key)}
                              disabled={submitting}
                              aria-label={it.label}
                            />
                          </td>
                          <td className="hid-col-date">
                            <div className="hid-date-edit">
                              <input
                                type="date"
                                className={`hid-date-input${editedStart ? ' is-edited' : ''}${dateErr ? ' is-invalid' : ''}`}
                                value={curStart}
                                onChange={(e) =>
                                  setOverride(r.key, { startDate: e.target.value })
                                }
                                disabled={submitting}
                                aria-invalid={dateErr || undefined}
                                aria-label={t('schedule.holidayImport.startDate')}
                              />
                              <span className="hid-date-sep" aria-hidden="true">–</span>
                              <input
                                type="date"
                                className={`hid-date-input${editedEnd ? ' is-edited' : ''}${dateErr ? ' is-invalid' : ''}`}
                                value={curEnd}
                                min={curStart || undefined}
                                onChange={(e) =>
                                  setOverride(r.key, { endDate: e.target.value })
                                }
                                disabled={submitting}
                                aria-invalid={dateErr || undefined}
                                aria-label={t('schedule.holidayImport.endDate')}
                              />
                            </div>
                            {dateErr && (
                              <div className="hid-row-error">
                                {t(rowErr.key, rowErr.params)}
                              </div>
                            )}
                          </td>
                          <td className="hid-col-label">
                            <div className="hid-label-edit">
                              <input
                                type="text"
                                className={`hid-label-input${editedLabel ? ' is-edited' : ''}${labelErr ? ' is-invalid' : ''}`}
                                value={curLabel}
                                onChange={(e) =>
                                  setOverride(r.key, { label: e.target.value })
                                }
                                disabled={submitting}
                                maxLength={LABEL_MAX_LEN}
                                aria-invalid={labelErr || undefined}
                                aria-label={t('schedule.holidayImport.colLabel')}
                              />
                              {edited && (
                                <button
                                  type="button"
                                  className="hid-reset-btn"
                                  onClick={resetRow}
                                  disabled={submitting}
                                  title={t('schedule.holidayImport.resetEdit')}
                                  aria-label={t('schedule.holidayImport.resetEdit')}
                                ><IconReset /></button>
                              )}
                            </div>
                            {labelErr && (
                              <div className="hid-row-error">
                                {t(rowErr.key, rowErr.params)}
                              </div>
                            )}
                          </td>
                          <td className="hid-col-source">
                            <span className={`hid-src-pill hid-src-${it.source}`}>
                              {t(SOURCE_LABEL[it.source] || 'schedule.holidayImport.sourceOther')}
                            </span>
                          </td>
                          <td className="hid-col-status">
                            {it.alreadyImported && (
                              <span className="hid-badge hid-badge-imported">
                                {t('schedule.holidayImport.statusImported')}
                              </span>
                            )}
                            {!it.alreadyImported && !it.conflict && (
                              <span className="hid-badge hid-badge-new">
                                {t('schedule.holidayImport.statusNew')}
                              </span>
                            )}
                            {it.conflict && (() => {
                              const kind = conflictKind(it.conflict.source);
                              const rowStrat = ov.conflictAction || globalStrategy;
                              return (
                                <div className="hid-conflict">
                                  <span className="hid-badge hid-badge-conflict">
                                    <IconAlert />
                                    {t('schedule.holidayImport.statusConflict')}
                                  </span>
                                  <div className="hid-conflict-kind">
                                    {t(kind === 'holiday'
                                      ? 'schedule.holidayImport.conflictKindHoliday'
                                      : 'schedule.holidayImport.conflictKindManual')}
                                  </div>
                                  <div
                                    className="hid-conflict-info"
                                    title={`${it.conflict.label} (${fmtDateRange(it.conflict.startDate, it.conflict.endDate)})`}
                                  >
                                    <span className="hid-conflict-label">{it.conflict.label}</span>
                                    {it.conflict.startDate && (
                                      <span className="hid-conflict-date">
                                        {fmtDateRange(it.conflict.startDate, it.conflict.endDate)}
                                      </span>
                                    )}
                                  </div>
                                  {kind === 'holiday' ? (
                                    <p className="hid-conflict-auto">
                                      {t('schedule.holidayImport.conflictAutoSkip')}
                                    </p>
                                  ) : (
                                    <>
                                      <select
                                        className="hid-conflict-select"
                                        value={rowStrat}
                                        onChange={(e) =>
                                          setOverride(r.key, { conflictAction: e.target.value })
                                        }
                                        disabled={submitting}
                                        aria-label={t('schedule.holidayImport.conflictStrategy')}
                                      >
                                        {STRATEGIES.map((s) => (
                                          <option key={s} value={s}>
                                            {t(`schedule.holidayImport.strategy_${s}`)}
                                          </option>
                                        ))}
                                      </select>
                                      <p className="hid-strategy-desc">
                                        {t(`schedule.holidayImport.strategy_${rowStrat}_hint`)}
                                      </p>
                                    </>
                                  )}
                                </div>
                              );
                            })()}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>

        {/* ---------- Footer ---------- */}
        <div className="modal-actions hid-footer">
          <span className="hid-footer-hint">
            {invalidSelectedCount > 0 && !submitting && (
              <span className="hid-footer-error">
                {t('schedule.holidayImport.hasInvalid', { n: invalidSelectedCount })}
              </span>
            )}
            {invalidSelectedCount === 0 && hasItems && !submitting && selectedCount > 0 &&
              t('schedule.holidayImport.applyHint', { n: selectedCount })}
          </span>
          <div className="hid-footer-buttons">
            <button
              type="button"
              className="modal-cancel"
              onClick={() => !submitting && onClose?.(false)}
              disabled={submitting}
            >
              {t('schedule.cancel')}
            </button>
            <button
              type="button"
              className="save-button hid-apply-btn"
              onClick={onApply}
              disabled={!canApply}
            >
              {submitting && <InlineSpinner />}
              <span>
                {submitting
                  ? t('schedule.holidayImport.applying')
                  : t('schedule.holidayImport.applyN', { n: selectedCount })}
              </span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
