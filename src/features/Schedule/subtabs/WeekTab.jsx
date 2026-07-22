import React, { useEffect, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import useLocale from '../../../hooks/useLocale.jsx';
import useScrollIntoViewWhen from '../../../hooks/useScrollIntoViewWhen.js';
import BellSetEditor from '../components/BellSetEditor.jsx';
import {
  fetchWeek, saveWeekFull, fetchDefault, fetchTemplates,
  clearErrorWeek, clearSaveSuccessWeek, isFactoryDefaultBells,
} from '../ScheduleSlice.js';

/** Monday-first order (Mon..Sun); day indices follow the firmware's 0=Sun..6=Sat convention. */
const ORDERED_DAYS = [1, 2, 3, 4, 5, 6, 0];
const PLAN_CUSTOM = -2;
const PLAN_DEFAULT = -1;

let _idSeq = 0;
const assignIds = (bells) => (bells || []).map((b) => (
  b._id ? b : { ...b, _id: `w-${++_idSeq}` }
));

function planPreview(bells) {
  if (!bells || bells.length === 0) return null;
  const sorted = [...bells].sort((a, b) => (a.hour * 60 + a.minute) - (b.hour * 60 + b.minute));
  const fmt = (b) => `${String(b.hour).padStart(2, '0')}:${String(b.minute).padStart(2, '0')}`;
  return { count: sorted.length, from: fmt(sorted[0]), to: fmt(sorted[sorted.length - 1]) };
}

function emptyCustomSlots() {
  return Array.from({ length: 7 }, () => ({ bells: [] }));
}

export default function WeekTab() {
  const dispatch = useDispatch();
  const { t, bellWord } = useLocale();
  const {
    weekdayPlans, weekdayCustom, workingDays, templates, builtins,
    default: defaultSet,
    loading, savingWeek, errorWeek, saveSuccessWeek,
  } = useSelector((s) => s.schedule);

  const [localPlans, setLocalPlans] = useState(weekdayPlans);
  const [localCustom, setLocalCustom] = useState(weekdayCustom || emptyCustomSlots());
  const [expandedDay, setExpandedDay] = useState(null);
  const statusBannerRef = useScrollIntoViewWhen(Boolean(errorWeek || saveSuccessWeek));

  useEffect(() => {
    dispatch(fetchWeek());
    dispatch(fetchDefault());
    dispatch(fetchTemplates());
  }, [dispatch]);

  useEffect(() => { setLocalPlans(weekdayPlans); }, [weekdayPlans]);
  useEffect(() => {
    setLocalCustom(weekdayCustom || emptyCustomSlots());
  }, [weekdayCustom]);

  useEffect(() => {
    if (saveSuccessWeek) {
      setExpandedDay(null);
      const id = setTimeout(() => dispatch(clearSaveSuccessWeek()), 3000);
      return () => clearTimeout(id);
    }
  }, [saveSuccessWeek, dispatch]);

  const planOptionsForDay = (dayIdx) => {
    const current = localPlans[dayIdx] ?? PLAN_DEFAULT;
    const opts = [
      { value: PLAN_DEFAULT, label: t('schedule.week.defaultPlan') },
      { value: PLAN_CUSTOM, label: t('schedule.week.customPlan') },
    ];
    templates.forEach((tpl, i) => {
      if (!tpl) return;
      const hasBells = Array.isArray(tpl.bells) && tpl.bells.length > 0;
      /* Keep listing a template that is still stored as a live weekday plan
       * (legacy), even if its bells were emptied, so the row stays editable. */
      const legacyBound = current === i || localPlans.some((p) => p === i);
      if (!hasBells && !legacyBound) return;
      const name = tpl.name || t('calendar.templateSlot', { n: i + 1 });
      opts.push({
        value: i,
        label: !hasBells
          ? `${name} (${t('schedule.week.previewEmpty')})`
          : current === i
            ? name
            : t('schedule.week.applyTemplate', { name }),
      });
    });
    return opts;
  };

  const previewFor = (dayIdx, planValue) => {
    if (planValue === PLAN_CUSTOM) {
      return planPreview(localCustom[dayIdx]?.bells);
    }
    if (planValue === PLAN_DEFAULT) return planPreview(defaultSet.bells);
    const tpl = templates[planValue];
    return tpl ? planPreview(tpl.bells) : null;
  };

  const setDayPlan = (dayIdx, value) => {
    /* Named templates are a one-time setup source: copy bells into a custom
     * day plan so the weekday is not permanently linked to the template. */
    if (value >= 0) {
      const tpl = templates[value];
      const copied = (tpl?.bells || []).map(({ _id, ...rest }) => ({ ...rest }));
      setLocalPlans((prev) => prev.map((v, i) => (i === dayIdx ? PLAN_CUSTOM : v)));
      setLocalCustom((prev) => {
        const next = [...prev];
        next[dayIdx] = { bells: assignIds(copied) };
        return next;
      });
      setExpandedDay(dayIdx);
      return;
    }

    setLocalPlans((prev) => prev.map((v, i) => (i === dayIdx ? value : v)));
    if (value === PLAN_CUSTOM) {
      setLocalCustom((prev) => {
        const next = [...prev];
        const existing = next[dayIdx]?.bells || [];
        if (existing.length === 0 && defaultSet.bells?.length) {
          // Seed from default so the editor isn't empty on first select.
          next[dayIdx] = { bells: assignIds(defaultSet.bells.map(({ _id, ...rest }) => rest)) };
        } else {
          next[dayIdx] = { bells: assignIds(existing) };
        }
        return next;
      });
      setExpandedDay(dayIdx);
    } else if (expandedDay === dayIdx) {
      setExpandedDay(null);
    }
  };

  const setDayCustomBells = (dayIdx, bells) => {
    setLocalCustom((prev) => {
      const next = [...prev];
      next[dayIdx] = { bells };
      return next;
    });
  };

  const handleSave = () => {
    const emptyCustom = localPlans.findIndex((p, i) =>
      p === PLAN_CUSTOM && !(localCustom[i]?.bells?.length > 0));
    if (emptyCustom >= 0) {
      setExpandedDay(emptyCustom);
      return;
    }
    dispatch(saveWeekFull({ weekdayPlans: localPlans, weekdayCustom: localCustom }));
  };

  const noCustomPlans = templates.every((tpl) => !tpl);
  const showGuidance = noCustomPlans && isFactoryDefaultBells(defaultSet.bells);
  const hasEmptyCustom = localPlans.some((p, i) =>
    p === PLAN_CUSTOM && !(localCustom[i]?.bells?.length > 0));

  return (
    <div className="schedule-tab-pane">
      <div className="tab-header">
        <h2>{t('schedule.subtab.week')}</h2>
        <button
          className={`save-button${savingWeek ? ' loading' : ''}`}
          onClick={handleSave}
          disabled={savingWeek || hasEmptyCustom}
          title={hasEmptyCustom ? t('schedule.week.customNeedsBells') : undefined}
        >
          {savingWeek ? t('schedule.saving') : t('schedule.week.save')}
        </button>
      </div>

      {(errorWeek || saveSuccessWeek) && (
        <div ref={statusBannerRef} className="status-banner-anchor">
          {errorWeek && (
            <div className="error-message">
              {errorWeek}
              <button className="error-dismiss" onClick={() => dispatch(clearErrorWeek())}>×</button>
            </div>
          )}
          {saveSuccessWeek && <div className="success-message">{t('schedule.savedSuccess')}</div>}
        </div>
      )}

      {showGuidance && (
        <div className="info-banner week-guidance-card">{t('schedule.week.guidance')}</div>
      )}

      {loading ? (
        <p className="loading-text">{t('schedule.loading')}</p>
      ) : (
        <>
          <div className="week-rows">
            {ORDERED_DAYS.map((dayIdx) => {
              const isWorking = workingDays.includes(dayIdx);
              const planValue = localPlans[dayIdx] ?? PLAN_DEFAULT;
              const isCustom = planValue === PLAN_CUSTOM;
              const preview = isWorking ? previewFor(dayIdx, planValue) : null;
              const showEditor = isWorking && isCustom && expandedDay === dayIdx;
              const dayPlanOptions = planOptionsForDay(dayIdx);

              return (
                <div
                  key={dayIdx}
                  className={`week-row${isWorking ? '' : ' week-row-nonworking'}${isCustom ? ' week-row-custom' : ''}`}
                >
                  <div className="week-row-main">
                    <span className="week-row-day">{t(`clock.days.${dayIdx}`)}</span>
                    {isWorking ? (
                      <>
                        <select
                          className="form-select week-row-select"
                          value={planValue}
                          onChange={(e) => setDayPlan(dayIdx, parseInt(e.target.value, 10))}
                        >
                          {dayPlanOptions.map((o) => (
                            <option key={o.value} value={o.value}>{o.label}</option>
                          ))}
                        </select>
                        <span className="week-row-preview">
                          {preview
                            ? t('schedule.week.previewSummary', {
                                count: preview.count,
                                from: preview.from,
                                to: preview.to,
                                bellWord: bellWord(preview.count),
                              })
                            : t('schedule.week.previewEmpty')}
                        </span>
                        {isCustom && (
                          <button
                            type="button"
                            className="cancel-button week-row-edit-btn"
                            onClick={() => setExpandedDay(showEditor ? null : dayIdx)}
                          >
                            {showEditor
                              ? t('schedule.week.hideCustom')
                              : t('schedule.week.editCustom')}
                          </button>
                        )}
                      </>
                    ) : (
                      <span className="week-row-offnote">{t('schedule.week.nonWorkingNote')}</span>
                    )}
                  </div>

                  {showEditor && (
                    <div className="week-row-editor">
                      <p className="hint-text week-custom-hint">{t('schedule.week.customHint')}</p>
                      <BellSetEditor
                        value={{ bells: localCustom[dayIdx]?.bells || [] }}
                        onChange={({ bells }) => setDayCustomBells(dayIdx, bells)}
                        allowApplyTemplate
                        templates={templates}
                        builtins={builtins}
                      />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
          <p className="hint-text">{t('schedule.week.settingsHint')}</p>
        </>
      )}
    </div>
  );
}
