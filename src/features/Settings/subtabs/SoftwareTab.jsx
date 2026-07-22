import React from 'react';
import { useDispatch, useSelector } from 'react-redux';
import {
  rebootDevice, factoryReset,
  fetchSettingsCore, fetchSettingsMaintenance,
} from '../SettingsSlice.js';
import { hydrateSettings } from '../../Schedule/ScheduleSlice.js';
import TokenManager from '../../../utils/TokenManager.js';
import useLocale from '../../../hooks/useLocale.jsx';
import FirmwareUpdatePanel from '../FirmwareUpdatePanel.jsx';

export default function SoftwareTab({ loadMaintenancePart }) {
  const dispatch = useDispatch();
  const { t } = useLocale();
  const { rebooting, resetting, firmwareInfo } = useSelector((s) => s.settings);
  const user = useSelector((s) => s.auth.user);
  const isService = user?.role === 'service';

  const handleReboot = () => {
    if (!window.confirm(t('settings.rebootConfirm'))) return;
    dispatch(rebootDevice()).then((result) => {
      if (result.meta.requestStatus === 'fulfilled') {
        TokenManager.clearStoredToken();
        setTimeout(() => window.location.reload(), 3000);
      }
    });
  };

  const handleFactoryReset = () => {
    if (!window.confirm(t('settings.factoryResetConfirm'))) return;
    dispatch(factoryReset()).then((result) => {
      if (result.meta.requestStatus === 'fulfilled') {
        dispatch(fetchSettingsCore({ force: true })).then((refresh) => {
          if (refresh.meta.requestStatus === 'fulfilled') {
            dispatch(hydrateSettings(refresh.payload.scheduleSettings));
          }
        });
        if (isService) dispatch(fetchSettingsMaintenance({ force: true }));
      }
    });
  };

  return (
    <>
      {isService && (
        <FirmwareUpdatePanel
          initialInfo={firmwareInfo}
          autoLoad={false}
          loadInfo={() => loadMaintenancePart('firmware')}
        />
      )}

      {!isService && (
        <div className="sched-card">
          <h3>{t('settings.softwareTitle')}</h3>
          <p className="card-desc">{t('settings.softwareClientHint')}</p>
        </div>
      )}

      <div className="sched-card">
        <h3>{t('settings.systemActions')}</h3>
        <p className="card-desc">{t('settings.systemActionsDesc')}</p>

        <div className="system-actions">
          <div className="system-action-item">
            <div className="action-info">
              <strong>{t('settings.reboot')}</strong>
              <p className="card-desc">{t('settings.rebootDesc')}</p>
            </div>
            <button
              type="button"
              className={`save-button action-btn${rebooting ? ' loading' : ''}`}
              onClick={handleReboot}
              disabled={rebooting || resetting}
            >
              {rebooting ? t('settings.rebooting') : t('settings.rebootBtn')}
            </button>
          </div>

          <div className="system-action-item system-action-danger">
            <div className="action-info">
              <strong>{t('settings.factoryReset')}</strong>
              <p className="card-desc">{t('settings.factoryResetDesc')}</p>
            </div>
            <button
              type="button"
              className={`save-button action-btn danger-btn${resetting ? ' loading' : ''}`}
              onClick={handleFactoryReset}
              disabled={rebooting || resetting}
            >
              {resetting ? t('settings.resetting') : t('settings.factoryResetBtn')}
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
