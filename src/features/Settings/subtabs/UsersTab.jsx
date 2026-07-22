import React, { useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { saveCredentials, deleteCredentials } from '../SettingsSlice.js';
import useLocale from '../../../hooks/useLocale.jsx';

export default function UsersTab() {
  const dispatch = useDispatch();
  const { t } = useLocale();
  const {
    clientCredentials, credentialsLoading, credentialsSaving, credentialsDeleting,
  } = useSelector((s) => s.settings);

  const [clientUsername, setClientUsername] = useState('');
  const [clientPassword, setClientPassword] = useState('');
  const [clientConfirmPassword, setClientConfirmPassword] = useState('');
  const [credentialError, setCredentialError] = useState('');

  const handleSaveCredentials = () => {
    setCredentialError('');
    if (!clientUsername.trim() || clientUsername.trim().length > 31) {
      setCredentialError(t('settings.credUsernameInvalid'));
      return;
    }
    if (clientPassword.length < 8) {
      setCredentialError(t('settings.credPasswordMin'));
      return;
    }
    if (clientPassword !== clientConfirmPassword) {
      setCredentialError(t('settings.credPasswordMismatch'));
      return;
    }
    dispatch(saveCredentials({
      username: clientUsername.trim(),
      password: clientPassword,
    })).then((result) => {
      if (result.meta.requestStatus === 'fulfilled') {
        setClientUsername('');
        setClientPassword('');
        setClientConfirmPassword('');
      }
    });
  };

  const handleDeleteCredentials = () => {
    if (!window.confirm(t('settings.credDeleteConfirm'))) return;
    dispatch(deleteCredentials()).then((result) => {
      if (result.meta.requestStatus === 'fulfilled') {
        setClientUsername('');
        setClientPassword('');
        setClientConfirmPassword('');
      }
    });
  };

  return (
    <div className="sched-card">
      <h3>{t('settings.credTitle')}</h3>
      <p className="card-desc">{t('settings.credDesc')}</p>

      <div className="settings-section">
        <div className="settings-row">
          <label className="form-label">{t('settings.credCurrentClient')}</label>
          <span className="info-value">
            {credentialsLoading
              ? '...'
              : (clientCredentials?.clientExists
                ? clientCredentials.clientUsername
                : t('settings.credNoAccount'))}
          </span>
        </div>
      </div>

      <div className="settings-section" style={{ borderBottom: 'none', marginBottom: 0 }}>
        <h4>
          {clientCredentials?.clientExists
            ? t('settings.credUpdate')
            : t('settings.credCreate')}
        </h4>
        {credentialError && (
          <div className="error-message" style={{ marginBottom: 8 }}>{credentialError}</div>
        )}
        <div className="settings-row">
          <label className="form-label">{t('settings.credUsername')}</label>
          <input
            type="text"
            className="form-input"
            maxLength={31}
            value={clientUsername}
            onChange={(e) => { setClientUsername(e.target.value); setCredentialError(''); }}
            placeholder={t('settings.credUsernamePlaceholder')}
            disabled={credentialsSaving}
          />
        </div>
        <div className="settings-row">
          <label className="form-label">{t('settings.credPassword')}</label>
          <input
            type="password"
            className="form-input"
            value={clientPassword}
            onChange={(e) => { setClientPassword(e.target.value); setCredentialError(''); }}
            placeholder={t('settings.credPasswordPlaceholder')}
            disabled={credentialsSaving}
          />
        </div>
        <div className="settings-row">
          <label className="form-label">{t('settings.credConfirmPassword')}</label>
          <input
            type="password"
            className="form-input"
            value={clientConfirmPassword}
            onChange={(e) => { setClientConfirmPassword(e.target.value); setCredentialError(''); }}
            placeholder={t('settings.credPasswordPlaceholder')}
            disabled={credentialsSaving}
            onKeyDown={(e) => { if (e.key === 'Enter') handleSaveCredentials(); }}
          />
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button
            type="button"
            className={`save-button${credentialsSaving ? ' loading' : ''}`}
            onClick={handleSaveCredentials}
            disabled={credentialsSaving}
          >
            {credentialsSaving ? t('settings.credSaving') : t('settings.credSave')}
          </button>
          {clientCredentials?.clientExists && (
            <button
              type="button"
              className={`save-button danger${credentialsDeleting ? ' loading' : ''}`}
              onClick={handleDeleteCredentials}
              disabled={credentialsDeleting}
            >
              {credentialsDeleting ? t('settings.credDeleting') : t('settings.credDelete')}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
