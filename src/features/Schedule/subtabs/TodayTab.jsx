import React, { useEffect, useState } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import {
  fetchToday, saveToday,
  setTodayBells, clearError, clearSaveSuccess,
} from '../ScheduleSlice.js';
import BellSetEditor from '../components/BellSetEditor.jsx';
import useLocale from '../../../hooks/useLocale.jsx';

export default function TodayTab() {
  const dispatch = useDispatch();
  const { t } = useLocale();
  const { today, templates, builtins, loading, saving, error, saveSuccess } =
    useSelector((s) => s.schedule);
  const [editing, setEditing] = useState(false);
  const [localBells, setLocalBells] = useState([]);

  useEffect(() => {
    dispatch(fetchToday());
  }, [dispatch]);

  useEffect(() => {
    if (saveSuccess) {
      setEditing(false);
      const id = setTimeout(() => dispatch(clearSaveSuccess()), 3000);
      return () => clearTimeout(id);
    }
  }, [saveSuccess, dispatch]);

  const startEdit = () => {
    setLocalBells([...today.bells]);
    setEditing(true);
  };

  const cancelEdit = () => setEditing(false);

  const handleSave = () => {
    dispatch(saveToday(localBells));
  };

  const dayTypeLabelKey = today.dayType ? `dayType.${today.dayType}` : null;

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
        </div>
        {!editing && (
          <button className="save-button" onClick={startEdit}>{t('schedule.editToday')}</button>
        )}
      </div>

      {today.multiDayException && !editing && (
        <div className="info-banner">
          {t('schedule.multiDayExceptionNote')}
        </div>
      )}

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
      ) : editing ? (
        <>
          {today.multiDayException && (
            <div className="warning-banner">{t('schedule.multiDayExceptionNote')}</div>
          )}
          <BellSetEditor
            value={{ bells: localBells }}
            onChange={({ bells }) => setLocalBells(bells)}
            allowApplyTemplate
            templates={templates}
            builtins={builtins}
          />
          <div className="action-bar">
            <button className="cancel-button" onClick={cancelEdit}>{t('schedule.cancel')}</button>
            <button
              className={`save-button${saving ? ' loading' : ''}`}
              onClick={handleSave}
              disabled={saving}
            >
              {saving ? t('schedule.saving') : t('schedule.saveToday')}
            </button>
          </div>
        </>
      ) : (
        <BellSetEditor
          value={{ bells: today.bells }}
          onChange={() => {}}
          readOnly
        />
      )}
    </div>
  );
}
