import React, { useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { savePin } from '../SettingsSlice.js';
import useLocale from '../../../hooks/useLocale.jsx';
import TlsSettingsPanel from '../TlsSettingsPanel.jsx';

export default function SecurityTab({ loadMaintenancePart, maintenanceReady }) {
  const dispatch = useDispatch();
  const { t } = useLocale();
  const { pinSaving, tlsStatus } = useSelector((s) => s.settings);

  const [newPin, setNewPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [pinError, setPinError] = useState('');

  const handleSavePin = () => {
    setPinError('');
    if (!/^\d{4,6}$/.test(newPin)) {
      setPinError(t('settings.pinInvalidFormat'));
      return;
    }
    if (newPin !== confirmPin) {
      setPinError(t('settings.pinMismatch'));
      return;
    }
    dispatch(savePin(newPin)).then((result) => {
      if (result.meta.requestStatus === 'fulfilled') {
        setNewPin('');
        setConfirmPin('');
      }
    });
  };

  return (
    <>
      <div className="sched-card">
        <h3>{t('settings.pinTitle')}</h3>
        <p className="card-desc">{t('settings.pinDesc')}</p>

        <div className="settings-section" style={{ borderBottom: 'none', marginBottom: 0 }}>
          <h4>{t('settings.pinChange')}</h4>
          {pinError && <div className="error-message" style={{ marginBottom: 8 }}>{pinError}</div>}
          <div className="settings-row">
            <label className="form-label">{t('settings.pinNew')}</label>
            <input
              type="password"
              className="form-input"
              inputMode="numeric"
              autoComplete="new-password"
              pattern="\d{4,6}"
              maxLength={6}
              value={newPin}
              onChange={(e) => {
                setNewPin(e.target.value.replace(/\D/g, '').slice(0, 6));
                setPinError('');
              }}
              placeholder={t('settings.pinPlaceholder')}
              disabled={pinSaving}
            />
          </div>
          <div className="settings-row">
            <label className="form-label">{t('settings.pinConfirm')}</label>
            <input
              type="password"
              className="form-input"
              inputMode="numeric"
              autoComplete="new-password"
              pattern="\d{4,6}"
              maxLength={6}
              value={confirmPin}
              onChange={(e) => {
                setConfirmPin(e.target.value.replace(/\D/g, '').slice(0, 6));
                setPinError('');
              }}
              placeholder={t('settings.pinPlaceholder')}
              disabled={pinSaving}
              onKeyDown={(e) => { if (e.key === 'Enter') handleSavePin(); }}
            />
          </div>
          <button
            type="button"
            className={`save-button${pinSaving ? ' loading' : ''}`}
            onClick={handleSavePin}
            disabled={pinSaving || newPin.length < 4 || confirmPin.length < 4}
          >
            {pinSaving ? t('settings.saving') : t('settings.pinSave')}
          </button>
        </div>
      </div>

      <TlsSettingsPanel
        initialStatus={tlsStatus}
        autoLoad={false}
        enableFocusRefresh={maintenanceReady}
        loadStatusOverride={() => loadMaintenancePart('tls')}
      />
    </>
  );
}
