import React, { useEffect, useState } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import {
  fetchToday, saveToday, cancelToday,
  clearErrorToday, clearSaveSuccessToday,
} from '../ScheduleSlice.js';
import BellSetEditor from '../components/BellSetEditor.jsx';
import useLocale from '../../../hooks/useLocale.jsx';
import useScrollIntoViewWhen from '../../../hooks/useScrollIntoViewWhen.js';

export default function TodayTab() {
  const dispatch = useDispatch();
  const { t } = useLocale();
  const { today, templates, builtins, loading, savingToday, errorToday, saveSuccessToday } =
    useSelector((s) => s.schedule);
  const [editing, setEditing] = useState(false);
  const [localBells, setLocalBells] = useState([]);
  const [usePlanIdx, setUsePlanIdx] = useState('');
  const [needsSave, setNeedsSave] = useState(false);
  const saveBtnRef = React.useRef(null);
  const statusBannerRef = useScrollIntoViewWhen(Boolean(errorToday || saveSuccessToday));

  useEffect(() => {
    if (saveSuccessToday) {
      setEditing(false);
      setUsePlanIdx('');
      setNeedsSave(false);
      dispatch(fetchToday());
      const id = setTimeout(() => dispatch(clearSaveSuccessToday()), 3000);
      return () => clearTimeout(id);
    }
  }, [saveSuccessToday, dispatch]);

  const startEdit = () => {
    setLocalBells([...today.bells]);
    setNeedsSave(false);
    setEditing(true);
  };

  const cancelEdit = () => {
    setNeedsSave(false);
    setEditing(false);
  };

  const handleGenerated = () => {
    setNeedsSave(true);
    requestAnimationFrame(() => {
      saveBtnRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    });
  };

  const handleSave = () => {
    if (!localBells || localBells.length === 0) {
      dispatch(saveToday({ action: 'dayOff' }));
      return;
    }
    dispatch(saveToday({ action: 'custom', customBells: { bells: localBells } }));
  };

  const handleDayOff = () => dispatch(saveToday({ action: 'dayOff' }));

  const handleUsePlan = () => {
    if (usePlanIdx === '') return;
    dispatch(saveToday({ action: 'template', templateIdx: parseInt(usePlanIdx, 10) }));
  };

  const handleCancelOverride = async () => {
    try {
      await dispatch(cancelToday()).unwrap();
      dispatch(fetchToday());
    } catch {
      /* error surfaces via errorToday */
    }
  };

  const dayTypeLabelKey = today.dayType ? `dayType.${today.dayType}` : null;
  const exception = today.exception;
  const isMultiDay = !!(exception && exception.endDate && exception.endDate !== exception.startDate);

  const namedPlanOptions = templates
    .map((tpl, i) => (
      tpl && Array.isArray(tpl.bells) && tpl.bells.length > 0
        ? { idx: i, label: tpl.name || t('calendar.templateSlot', { n: i + 1 }) }
        : null
    ))
    .filter(Boolean);

  const planLabel = (today.planIdx === -1 || today.planIdx == null)
    ? t('schedule.week.defaultPlan')
    : (today.planIdx === -2)
      ? t('schedule.week.customPlan')
      : (today.planName || t('calendar.templateSlot', { n: today.planIdx + 1 }));

  return (
    <div className="schedule-tab-pane">
      <div className="tab-header">
        <div>
          <h2>{t('schedule.today')}</h2>
          {today.dayType && (
            <span className={`day-type-badge day-type-${today.dayType}`}>
              {dayTypeLabelKey ? t(dayTypeLabelKey) : today.dayType}
            </span>
          )}
          {today.dayType === 'working' && !exception && (
            <div className="today-plan-note">{t('schedule.today.usingPlan', { name: planLabel })}</div>
          )}
        </div>
        {!editing && (
          <button className="save-button" onClick={startEdit}>{t('schedule.editToday')}</button>
        )}
      </div>

      {exception && !editing && (
        <div className="info-banner">
          {isMultiDay
            ? t('schedule.multiDayExceptionNote')
            : t('schedule.today.exceptionActive', { label: exception.label || t(`calendar.action_${exception.action}`) })}
        </div>
      )}

      {(errorToday || saveSuccessToday) && (
        <div ref={statusBannerRef} className="status-banner-anchor">
          {errorToday && (
            <div className="error-message">
              {errorToday}
              <button className="error-dismiss" onClick={() => dispatch(clearErrorToday())}>×</button>
            </div>
          )}
          {saveSuccessToday && (
            <div className="success-message">{t('schedule.savedSuccess')}</div>
          )}
        </div>
      )}

      {loading ? (
        <p className="loading-text">{t('schedule.loading')}</p>
      ) : editing ? (
        <>
          {isMultiDay && (
            <div className="warning-banner">{t('schedule.multiDayExceptionNote')}</div>
          )}
          <BellSetEditor
            value={{ bells: localBells }}
            onChange={({ bells }) => { setLocalBells(bells); setNeedsSave(true); }}
            allowApplyTemplate
            templates={templates}
            builtins={builtins}
            onGenerated={handleGenerated}
          />
          <div className="action-bar">
            <button className="cancel-button" onClick={cancelEdit}>{t('schedule.cancel')}</button>
            <button
              ref={saveBtnRef}
              className={`save-button${savingToday ? ' loading' : ''}${needsSave ? ' needs-save' : ''}`}
              onClick={handleSave}
              disabled={savingToday}
            >
              {savingToday ? t('schedule.saving') : t('schedule.saveToday')}
            </button>
          </div>
        </>
      ) : (
        <>
          <div className="today-quick-actions">
            <span className="today-quick-label">{t('schedule.today.quickActions')}</span>
            <button
              type="button"
              className="cancel-button"
              onClick={handleDayOff}
              disabled={savingToday}
            >
              {t('schedule.today.dayOff')}
            </button>
            {namedPlanOptions.length > 0 && (
              <div className="today-use-plan">
                <select
                  className="form-select"
                  value={usePlanIdx}
                  onChange={(e) => setUsePlanIdx(e.target.value)}
                >
                  <option value="">{t('schedule.today.usePlan')}</option>
                  {namedPlanOptions.map((o) => (
                    <option key={o.idx} value={o.idx}>{o.label}</option>
                  ))}
                </select>
                <button
                  type="button"
                  className="cancel-button"
                  onClick={handleUsePlan}
                  disabled={savingToday || usePlanIdx === ''}
                >
                  {t('schedule.today.applyPlan')}
                </button>
              </div>
            )}
            {exception && (
              <button
                type="button"
                className="danger-button"
                onClick={handleCancelOverride}
                disabled={savingToday}
              >
                {t('schedule.today.cancelOverride')}
              </button>
            )}
          </div>
          <BellSetEditor
            value={{ bells: today.bells }}
            onChange={() => {}}
            readOnly
          />
        </>
      )}
    </div>
  );
}
