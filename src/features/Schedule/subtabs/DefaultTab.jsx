import React, { useEffect, useState } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import {
  fetchDefault, saveDefault, fetchDefaults,
  setDefaultBells, clearError, clearSaveSuccess,
} from '../ScheduleSlice.js';
import BellSetEditor from '../components/BellSetEditor.jsx';
import useLocale from '../../../hooks/useLocale.jsx';

export default function DefaultTab() {
  const dispatch = useDispatch();
  const { t } = useLocale();
  const { default: defaultSet, loading, saving, error, saveSuccess } =
    useSelector((s) => s.schedule);
  const [localBells, setLocalBells] = useState([]);

  useEffect(() => {
    dispatch(fetchDefault()).then((result) => {
      if (result.meta.requestStatus === 'fulfilled') {
        setLocalBells(result.payload.bells || []);
      }
    });
  }, [dispatch]);

  useEffect(() => {
    if (saveSuccess) {
      const id = setTimeout(() => dispatch(clearSaveSuccess()), 3000);
      return () => clearTimeout(id);
    }
  }, [saveSuccess, dispatch]);

  // Keep local in sync when store changes externally (e.g. factory reset)
  useEffect(() => {
    setLocalBells(defaultSet.bells || []);
  }, [defaultSet.bells]);

  const handleSave = () => {
    dispatch(saveDefault(localBells));
  };

  const handleReset = () => {
    if (!window.confirm(t('schedule.resetConfirm'))) return;
    dispatch(fetchDefaults()).then((result) => {
      if (result.meta.requestStatus === 'fulfilled') {
        setLocalBells(result.payload.bells || []);
      }
    });
  };

  return (
    <div className="schedule-tab-pane">
      <div className="tab-header">
        <h2>{t('schedule.default')}</h2>
        <div className="tab-header-actions">
          <button className="cancel-button" onClick={handleReset}>{t('schedule.resetDefaults')}</button>
          <button
            className={`save-button${saving ? ' loading' : ''}`}
            onClick={handleSave}
            disabled={saving}
          >
            {saving ? t('schedule.saving') : t('schedule.saveBells')}
          </button>
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

      {loading ? (
        <p className="loading-text">{t('schedule.loading')}</p>
      ) : (
        <BellSetEditor
          value={{ bells: localBells }}
          onChange={({ bells }) => setLocalBells(bells)}
          allowApplyTemplate={false}
        />
      )}
    </div>
  );
}
