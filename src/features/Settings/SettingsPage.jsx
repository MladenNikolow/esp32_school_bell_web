import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import {
  clearError as clearScheduleError,
  clearSaveSuccess,
  hydrateSettings,
} from '../Schedule/ScheduleSlice.js';
import {
  fetchSettingsCore, fetchSettingsAccess, fetchSettingsMaintenance,
  clearError, clearActionSuccess,
} from './SettingsSlice.js';
import useLocale from '../../hooks/useLocale.jsx';
import useScrollIntoViewWhen from '../../hooks/useScrollIntoViewWhen.js';
import GeneralTab from './subtabs/GeneralTab.jsx';
import SoftwareTab from './subtabs/SoftwareTab.jsx';
import UsersTab from './subtabs/UsersTab.jsx';
import SecurityTab from './subtabs/SecurityTab.jsx';
import SystemTab from './subtabs/SystemTab.jsx';

const ALL_SUBTABS = ['general', 'software', 'users', 'security', 'system'];
const CLIENT_SUBTABS = ['general', 'software', 'security', 'system'];

export default function SettingsPage() {
  const dispatch = useDispatch();
  const { t } = useLocale();

  const scheduleError = useSelector((s) => s.schedule.error);
  const saveSuccess = useSelector((s) => s.schedule.saveSuccess);
  const { error, actionSuccess, resources } = useSelector((s) => s.settings);
  const user = useSelector((s) => s.auth.user);
  const isService = user?.role === 'service';

  const subtabs = useMemo(
    () => (isService ? ALL_SUBTABS : CLIENT_SUBTABS),
    [isService],
  );
  const [activeSubTab, setActiveSubTab] = useState('general');

  useEffect(() => {
    if (!subtabs.includes(activeSubTab)) setActiveSubTab('general');
  }, [subtabs, activeSubTab]);

  useEffect(() => {
    dispatch(fetchSettingsCore()).then((result) => {
      if (result.meta.requestStatus === 'fulfilled') {
        dispatch(hydrateSettings(result.payload.scheduleSettings));
      }
      dispatch(fetchSettingsAccess());
    });
  }, [dispatch]);

  /* Load firmware/TLS when a tab that needs them becomes active. */
  useEffect(() => {
    if (activeSubTab === 'software' || activeSubTab === 'security') {
      dispatch(fetchSettingsMaintenance());
    }
  }, [activeSubTab, dispatch]);

  const loadMaintenancePart = useCallback((part) =>
    dispatch(fetchSettingsMaintenance({ force: true }))
      .unwrap()
      .then((payload) => payload?.[part]), [dispatch]);

  useEffect(() => {
    if (!saveSuccess) return undefined;
    const timer = setTimeout(() => dispatch(clearSaveSuccess()), 3000);
    return () => clearTimeout(timer);
  }, [saveSuccess, dispatch]);

  useEffect(() => {
    if (!actionSuccess) return undefined;
    const timer = setTimeout(() => dispatch(clearActionSuccess()), 4000);
    return () => clearTimeout(timer);
  }, [actionSuccess, dispatch]);

  const combinedError = error || scheduleError;
  const statusBannerRef = useScrollIntoViewWhen(
    Boolean(combinedError || saveSuccess || actionSuccess),
  );

  const SubTabComponent = {
    general: GeneralTab,
    software: SoftwareTab,
    users: UsersTab,
    security: SecurityTab,
    system: SystemTab,
  }[activeSubTab];

  const subTabProps = {
    software: { loadMaintenancePart },
    security: {
      loadMaintenancePart,
      maintenanceReady: resources.maintenance.status === 'ready',
    },
  }[activeSubTab] || {};

  return (
    <div className="settings-page">
      {(combinedError || saveSuccess || actionSuccess) && (
        <div ref={statusBannerRef} className="status-banner-anchor">
          {combinedError && (
            <div className="error-message">
              {combinedError}
              <button
                type="button"
                className="error-dismiss"
                onClick={() => { dispatch(clearError()); dispatch(clearScheduleError()); }}
              >
                ×
              </button>
            </div>
          )}
          {saveSuccess && <div className="success-message">{t('settings.settingsSaved')}</div>}
          {actionSuccess && <div className="success-message">{actionSuccess}</div>}
        </div>
      )}

      <nav className="subtab-nav">
        {subtabs.map((id) => (
          <button
            key={id}
            type="button"
            className={`subtab-btn${activeSubTab === id ? ' active' : ''}`}
            onClick={() => setActiveSubTab(id)}
          >
            {t(`settings.subtab.${id}`)}
          </button>
        ))}
      </nav>

      <div className="subtab-content">
        <SubTabComponent {...subTabProps} />
      </div>
    </div>
  );
}
