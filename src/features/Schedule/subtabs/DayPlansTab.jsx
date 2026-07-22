import React, { useEffect, useMemo, useState } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import {
  fetchDefault, saveDefault, fetchDefaults,
  fetchTemplates, saveTemplates,
  clearErrorDefault, clearSaveSuccessDefault,
  clearErrorTemplates, clearSaveSuccessTemplates,
} from '../ScheduleSlice.js';
import ScheduleService from '../../../services/ScheduleService.js';
import BellSetEditor from '../components/BellSetEditor.jsx';
import useLocale from '../../../hooks/useLocale.jsx';
import useScrollIntoViewWhen from '../../../hooks/useScrollIntoViewWhen.js';

const SLOT_COUNT = 5;

function planPreview(bells) {
  if (!bells || bells.length === 0) return null;
  const sorted = [...bells].sort((a, b) => (a.hour * 60 + a.minute) - (b.hour * 60 + b.minute));
  const fmt = (b) => `${String(b.hour).padStart(2, '0')}:${String(b.minute).padStart(2, '0')}`;
  return { count: sorted.length, from: fmt(sorted[0]), to: fmt(sorted[sorted.length - 1]) };
}

export default function DayPlansTab() {
  const dispatch = useDispatch();
  const { t, bellWord } = useLocale();
  const {
    default: defaultSet, templates: storeTemplates, builtins,
    loading,
    savingDefault, errorDefault, saveSuccessDefault,
    savingTemplates, errorTemplates, saveSuccessTemplates,
  } = useSelector((s) => s.schedule);

  // ── Default plan card ────────────────────────────────────────────────
  const [defaultBells, setDefaultBells] = useState([]);
  const [defaultOpen, setDefaultOpen] = useState(false);

  useEffect(() => {
    dispatch(fetchDefault()).then((result) => {
      if (result.meta.requestStatus === 'fulfilled') {
        setDefaultBells(result.payload.bells || []);
      }
    });
  }, [dispatch]);

  useEffect(() => { setDefaultBells(defaultSet.bells || []); }, [defaultSet.bells]);

  useEffect(() => {
    if (saveSuccessDefault) {
      setNeedsSaveDefault(false);
      const id = setTimeout(() => dispatch(clearSaveSuccessDefault()), 3000);
      return () => clearTimeout(id);
    }
  }, [saveSuccessDefault, dispatch]);

  const handleSaveDefault = () => dispatch(saveDefault(defaultBells));
  const handleResetDefault = () => {
    if (!window.confirm(t('schedule.resetConfirm'))) return;
    dispatch(fetchDefaults()).then((result) => {
      if (result.meta.requestStatus === 'fulfilled') {
        setDefaultBells(result.payload.bells || []);
      }
    });
  };
  const defaultPreview = planPreview(defaultBells);

  // ── Named plan slots (5) ─────────────────────────────────────────────
  const [local, setLocal] = useState(Array.from({ length: SLOT_COUNT }, () => null));
  const [open, setOpen] = useState(Array.from({ length: SLOT_COUNT }, () => false));
  const [dupSource, setDupSource] = useState(Array.from({ length: SLOT_COUNT }, () => ''));
  const [clearWarning, setClearWarning] = useState(null); // { idx, exceptionCount }
  const [needsSaveDefault, setNeedsSaveDefault] = useState(false);
  const [needsSaveTemplates, setNeedsSaveTemplates] = useState(false);
  const defaultSaveRef = React.useRef(null);
  const templatesSaveRef = React.useRef(null);
  const defaultBannerRef = useScrollIntoViewWhen(Boolean(errorDefault || saveSuccessDefault));
  const templatesBannerRef = useScrollIntoViewWhen(Boolean(errorTemplates || saveSuccessTemplates));

  useEffect(() => {
    const arr = Array.from({ length: SLOT_COUNT }, (_, i) => storeTemplates[i] ?? null);
    setLocal(arr);
  }, [storeTemplates]);

  useEffect(() => {
    if (saveSuccessTemplates) {
      setNeedsSaveTemplates(false);
      const id = setTimeout(() => dispatch(clearSaveSuccessTemplates()), 3000);
      return () => clearTimeout(id);
    }
  }, [saveSuccessTemplates, dispatch]);

  const toggleOpen = (idx) => setOpen((prev) => prev.map((v, i) => (i === idx ? !v : v)));
  const setAllOpen = (val) => setOpen(Array.from({ length: SLOT_COUNT }, () => val));

  const updateSlot = (idx, patch) => {
    setLocal((prev) =>
      prev.map((s, i) => (i === idx ? { ...(s || { name: '', bells: [] }), ...patch } : s))
    );
    setOpen((prev) => prev.map((v, i) => (i === idx ? true : v)));
  };

  const doClear = (idx) => setLocal((prev) => prev.map((s, i) => (i === idx ? null : s)));

  const requestClear = async (idx) => {
    let exceptionCount = 0;
    try {
      const resp = await ScheduleService.getExceptions({ limit: 40 });
      exceptionCount = (resp?.items || []).filter(
        (e) => e.action === 'template' && e.templateIdx === idx
      ).length;
    } catch {
      /* best-effort only -proceed without the exception check on failure */
    }
    if (exceptionCount > 0) {
      setClearWarning({ idx, exceptionCount });
    } else {
      doClear(idx);
    }
  };

  const duplicateOptions = useMemo(() => {
    const opts = [];
    if (defaultBells.length > 0) {
      opts.push({ value: 'default', label: t('schedule.week.defaultPlan'), bells: defaultBells });
    }
    local.forEach((slot, i) => {
      if (slot && slot.bells?.length > 0) {
        opts.push({
          value: `slot-${i}`,
          label: slot.name || t('calendar.templateSlot', { n: i + 1 }),
          bells: slot.bells,
        });
      }
    });
    return opts;
  }, [defaultBells, local, t]);

  const handleDuplicate = (idx) => {
    const src = dupSource[idx];
    if (!src) return;
    const option = duplicateOptions.find((o) => o.value === src && o.value !== `slot-${idx}`);
    if (!option) return;
    const copiedBells = option.bells.map(({ _id, ...rest }) => ({ ...rest }));
    updateSlot(idx, { bells: copiedBells });
  };

  const handleSaveTemplates = () => dispatch(saveTemplates(local));

  const allOpen = open.every(Boolean);

  return (
    <div className="schedule-tab-pane">
      <div className="tab-header">
        <h2>{t('schedule.subtab.dayPlans')}</h2>
        <p className="hint-text">{t('schedule.dayPlans.helper')}</p>
      </div>

      {loading ? (
        <p className="loading-text">{t('schedule.loading')}</p>
      ) : (
        <>
          {/* ── Default plan ─────────────────────────────────────────── */}
          <section className="template-section">
            <h3 className="template-section-title">{t('schedule.default')}</h3>
            {(errorDefault || saveSuccessDefault) && (
              <div ref={defaultBannerRef} className="status-banner-anchor">
                {errorDefault && (
                  <div className="error-message">
                    {errorDefault}
                    <button className="error-dismiss" onClick={() => dispatch(clearErrorDefault())}>×</button>
                  </div>
                )}
                {saveSuccessDefault && <div className="success-message">{t('schedule.savedSuccess')}</div>}
              </div>
            )}

            <div className={`collapsible-card plan-card${defaultOpen ? ' open' : ''}`}>
              <div
                className="collapsible-card-header"
                onClick={() => setDefaultOpen((v) => !v)}
                role="button" tabIndex={0}
                onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && setDefaultOpen((v) => !v)}
                aria-expanded={defaultOpen}
              >
                <span className="cc-chevron">{defaultOpen ? '▼' : '▶'}</span>
                <span className="plan-card-title">{t('schedule.default')}</span>
                <span className="cc-summary">
                  {defaultPreview
                    ? t('schedule.week.previewSummary', {
                        ...defaultPreview,
                        bellWord: bellWord(defaultPreview.count),
                      })
                    : t('schedule.week.previewEmpty')}
                </span>
              </div>
              <div className="collapsible-card-body">
                <BellSetEditor
                  value={{ bells: defaultBells }}
                  onChange={({ bells }) => { setDefaultBells(bells); setNeedsSaveDefault(true); }}
                  allowApplyTemplate={false}
                  onGenerated={() => {
                    setNeedsSaveDefault(true);
                    requestAnimationFrame(() => defaultSaveRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' }));
                  }}
                />
                <div className="action-bar">
                  <button className="cancel-button" onClick={handleResetDefault}>
                    {t('schedule.resetDefaults')}
                  </button>
                  <button
                    ref={defaultSaveRef}
                    className={`save-button${savingDefault ? ' loading' : ''}${needsSaveDefault ? ' needs-save' : ''}`}
                    onClick={handleSaveDefault}
                    disabled={savingDefault}
                  >
                    {savingDefault ? t('schedule.saving') : t('schedule.saveBells')}
                  </button>
                </div>
              </div>
            </div>
          </section>

          {/* ── Built-in read-only helpers ──────────────────────────── */}
          {builtins.length > 0 && (
            <section className="template-section">
              <h3 className="template-section-title">{t('schedule.builtinTemplates')}</h3>
              {builtins.map((b, i) => (
                <div key={i} className="template-slot template-slot-readonly">
                  <div className="template-slot-header">
                    <span className="template-slot-name">
                      {b.id === 'dayOff' || b.id === 'dayOn'
                        ? t(`schedule.builtin.${b.id}.name`)
                        : b.name}
                    </span>
                    <span className="template-readonly-badge">{t('schedule.readOnly')}</span>
                  </div>
                  <div className={`builtin-template-desc builtin-template-desc--${b.id}`}>
                    <div className="builtin-template-icon" aria-hidden="true">
                      {b.id === 'dayOff' ? (
                        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M13.73 21a2 2 0 0 1-3.46 0"/>
                          <path d="M18.63 13A17.89 17.89 0 0 1 18 8"/>
                          <path d="M6.26 6.26A5.86 5.86 0 0 0 6 8c0 7-3 9-3 9h14"/>
                          <path d="M18 8a6 6 0 0 0-9.33-5"/>
                          <line x1="1" y1="1" x2="23" y2="23"/>
                        </svg>
                      ) : (
                        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/>
                          <path d="M13.73 21a2 2 0 0 1-3.46 0"/>
                        </svg>
                      )}
                    </div>
                    <div className="builtin-template-text">
                      <span className="builtin-template-detail">{t(`schedule.builtin.${b.id}.detail`)}</span>
                      <p className="builtin-template-body">{t(`schedule.builtin.${b.id}.desc`)}</p>
                    </div>
                  </div>
                </div>
              ))}
            </section>
          )}

          {/* ── Named day-plan slots ─────────────────────────────────── */}
          <section className="template-section">
            <div className="section-header-row">
              <h3 className="template-section-title">{t('schedule.dayPlans.namedTitle')}</h3>
              <button type="button" className="bulk-toggle" onClick={() => setAllOpen(!allOpen)}>
                {allOpen ? t('schedule.collapseAll') : t('schedule.expandAll')}
              </button>
            </div>

            {(errorTemplates || saveSuccessTemplates) && (
              <div ref={templatesBannerRef} className="status-banner-anchor">
                {errorTemplates && (
                  <div className="error-message">
                    {errorTemplates}
                    <button className="error-dismiss" onClick={() => dispatch(clearErrorTemplates())}>×</button>
                  </div>
                )}
                {saveSuccessTemplates && <div className="success-message">{t('schedule.savedSuccess')}</div>}
              </div>
            )}

            {Array.from({ length: SLOT_COUNT }, (_, idx) => {
              const slot = local[idx];
              const isOpen = open[idx];
              const preview = planPreview(slot?.bells);
              const dupOpts = duplicateOptions.filter((o) => o.value !== `slot-${idx}`);
              return (
                <div key={idx} className={`collapsible-card plan-card${isOpen ? ' open' : ''}`}>
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
                    <span className="cc-summary">
                      {preview
                        ? t('schedule.week.previewSummary', {
                            ...preview,
                            bellWord: bellWord(preview.count),
                          })
                        : t('schedule.week.previewEmpty')}
                    </span>
                    {slot && (
                      <button
                        type="button"
                        className="delete-btn"
                        title={t('calendar.deleteTemplate')}
                        onClick={(e) => { e.stopPropagation(); requestClear(idx); }}
                      >×</button>
                    )}
                  </div>
                  <div className="collapsible-card-body">
                    <div className="plan-duplicate-row">
                      <select
                        className="form-select"
                        value={dupSource[idx] || ''}
                        onChange={(e) => setDupSource((prev) => prev.map((v, i) => (i === idx ? e.target.value : v)))}
                      >
                        <option value="">{t('schedule.dayPlans.duplicateFrom')}</option>
                        {dupOpts.map((o) => (
                          <option key={o.value} value={o.value}>{o.label}</option>
                        ))}
                      </select>
                      <button
                        type="button"
                        className="add-btn"
                        disabled={!dupSource[idx]}
                        onClick={() => handleDuplicate(idx)}
                      >
                        {t('schedule.dayPlans.duplicateButton')}
                      </button>
                    </div>
                    <BellSetEditor
                      value={{ bells: slot?.bells || [] }}
                      onChange={({ bells }) => { updateSlot(idx, { bells }); setNeedsSaveTemplates(true); }}
                      allowApplyTemplate
                      templates={local}
                      builtins={builtins}
                      onGenerated={() => {
                        setNeedsSaveTemplates(true);
                        requestAnimationFrame(() => templatesSaveRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' }));
                      }}
                    />
                  </div>
                </div>
              );
            })}

            <div className="action-bar">
              <button
                ref={templatesSaveRef}
                className={`save-button${savingTemplates ? ' loading' : ''}${needsSaveTemplates ? ' needs-save' : ''}`}
                onClick={handleSaveTemplates}
                disabled={savingTemplates}
              >
                {savingTemplates ? t('schedule.saving') : t('schedule.dayPlans.save')}
              </button>
            </div>
          </section>
        </>
      )}

      {clearWarning && (
        <div className="confirm-modal-backdrop" role="dialog" aria-modal="true"
          onClick={(e) => { if (e.target === e.currentTarget) setClearWarning(null); }}>
          <div className="confirm-modal">
            <h3>{t('schedule.dayPlans.clearConfirmTitle')}</h3>
            <p>
              {t('schedule.dayPlans.clearWarnExceptions', { count: clearWarning.exceptionCount })}
            </p>
            <div className="confirm-modal-actions">
              <button type="button" className="cancel-button" onClick={() => setClearWarning(null)}>
                {t('schedule.cancel')}
              </button>
              <button
                type="button"
                className="danger-button"
                onClick={() => { doClear(clearWarning.idx); setClearWarning(null); }}
              >
                {t('schedule.dayPlans.clearConfirmAction')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
