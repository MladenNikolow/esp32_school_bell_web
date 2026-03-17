import { useState } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import {
  fetchNetworks,
  saveWifiConfig,
  clearNetworksError,
  clearSaveError,
} from '../WiFiConfigSlice.js';
import useTheme from '../../../hooks/useTheme.js';
import useLocale from '../../../hooks/useLocale.jsx';
import RingyLogo from '../../../components/RingyLogo.jsx';

export default function WiFiConfigPage() {
  const dispatch = useDispatch();
  const { theme, toggleTheme } = useTheme();
  const { t, locale, setLocale } = useLocale();
  const {
    apSsid,
    networks,
    networksLoading,
    networksError,
    saving,
    saveError,
    saved,
  } = useSelector((state) => state.wifiConfig);

  const [expandedBssid, setExpandedBssid] = useState(null);
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [manualSsid, setManualSsid] = useState('');
  const [manualPassword, setManualPassword] = useState('');
  const [showManualPassword, setShowManualPassword] = useState(false);
  const [showManualEntry, setShowManualEntry] = useState(false);
  const [manualTouched, setManualTouched] = useState(false);
  const [submittedSsid, setSubmittedSsid] = useState('');

  const handleScanNetworks = () => {
    dispatch(fetchNetworks());
  };

  const handleToggleNetwork = (network) => {
    const id = network.bssid || network.ssid;
    if (expandedBssid === id) {
      setExpandedBssid(null);
      setPassword('');
      setShowPassword(false);
    } else {
      setExpandedBssid(id);
      setPassword('');
      setShowPassword(false);
      setShowManualEntry(false);
    }
  };

  const handleConnectNetwork = (network) => {
    if (!network.secured && !password) {
      setSubmittedSsid(network.ssid);
      dispatch(saveWifiConfig({ ssid: network.ssid, password: '' }));
      return;
    }
    if (network.secured && !password) return;
    setSubmittedSsid(network.ssid);
    dispatch(saveWifiConfig({ ssid: network.ssid, password }));
  };

  const handleManualConnect = (e) => {
    e.preventDefault();
    setManualTouched(true);
    if (!manualSsid.trim()) return;
    setSubmittedSsid(manualSsid.trim());
    dispatch(saveWifiConfig({ ssid: manualSsid.trim(), password: manualPassword }));
  };

  const toggleManualEntry = () => {
    setShowManualEntry(!showManualEntry);
    setExpandedBssid(null);
    setPassword('');
    setManualSsid('');
    setManualPassword('');
    setManualTouched(false);
  };

  const sortedNetworks = [...networks].sort((a, b) => b.rssi - a.rssi);

  // Detect duplicate SSIDs to show channel info for disambiguation
  const ssidCounts = sortedNetworks.reduce((acc, n) => {
    acc[n.ssid] = (acc[n.ssid] || 0) + 1;
    return acc;
  }, {});

  const getSignalLevel = (rssi) => {
    if (rssi >= -50) return 4;
    if (rssi >= -60) return 3;
    if (rssi >= -70) return 2;
    return 1;
  };

  const renderSignalIcon = (rssi) => {
    const level = getSignalLevel(rssi);
    return (
      <span className="signal-icon" title={`${rssi} dBm`}>
        <span className={`signal-bar-segment${level >= 1 ? ' active' : ''}`} data-level={level}></span>
        <span className={`signal-bar-segment${level >= 2 ? ' active' : ''}`} data-level={level}></span>
        <span className={`signal-bar-segment${level >= 3 ? ' active' : ''}`} data-level={level}></span>
        <span className={`signal-bar-segment${level >= 4 ? ' active' : ''}`} data-level={level}></span>
      </span>
    );
  };

  if (saved) {
    return (
      <div className="login-container">
        <div className="login-header">
          <div className="login-header-toggles">
            <div className="lang-switcher" role="radiogroup" aria-label={t('lang.title')}>
              <button
                className={`lang-switcher-btn${locale === 'bg' ? ' active' : ''}`}
                onClick={() => setLocale('bg')}
                aria-checked={locale === 'bg'}
                role="radio"
              >BG</button>
              <button
                className={`lang-switcher-btn${locale === 'en' ? ' active' : ''}`}
                onClick={() => setLocale('en')}
                aria-checked={locale === 'en'}
                role="radio"
              >EN</button>
            </div>
            <button className="theme-toggle login-theme-toggle" onClick={toggleTheme} title={t('auth.toggleDarkMode')}>
              {theme === 'dark' ? '☀️' : '🌙'}
            </button>
          </div>
          <RingyLogo height="72px" />
        </div>
        <div className="login-content">
          <div className="login-form">
            <div className="success-banner">
              <p dangerouslySetInnerHTML={{ __html: t('wifi.savedMsg', { ssid: submittedSsid }) }} />
              <p>{t('wifi.savedNote')}</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="login-container">
      <div className="login-header">
        <div className="login-header-toggles">
          <div className="lang-switcher" role="radiogroup" aria-label={t('lang.title')}>
            <button
              className={`lang-switcher-btn${locale === 'bg' ? ' active' : ''}`}
              onClick={() => setLocale('bg')}
              aria-checked={locale === 'bg'}
              role="radio"
            >BG</button>
            <button
              className={`lang-switcher-btn${locale === 'en' ? ' active' : ''}`}
              onClick={() => setLocale('en')}
              aria-checked={locale === 'en'}
              role="radio"
            >EN</button>
          </div>
          <button className="theme-toggle login-theme-toggle" onClick={toggleTheme} title={t('auth.toggleDarkMode')}>
            {theme === 'dark' ? '☀️' : '🌙'}
          </button>
        </div>
        <RingyLogo height="72px" />
      </div>

      <div className="login-content">
        {/* Connection info card */}
        <div className="login-form">
          <p className="wifi-ap-info" dangerouslySetInnerHTML={{ __html: t('wifi.connectedTo', { ssid: apSsid }) }} />
        </div>

        {/* Network scanner panel */}
        <div className="login-form" style={{ marginTop: 16 }}>
          <h2 className="wifi-section-title">
            {t('wifi.availableNetworks')}
          </h2>
          <p className="wifi-band-note">{t('wifi.only24ghz')}</p>

          <button
            type="button"
            className="login-button"
            onClick={handleScanNetworks}
            disabled={networksLoading}
            style={{ marginBottom: 16 }}
          >
            {networksLoading ? t('wifi.scanning') : t('wifi.scanNetworks')}
          </button>

          {networksError && (
            <div className="error-message">
              {networksError}
              <button
                type="button"
                className="error-dismiss"
                onClick={() => dispatch(clearNetworksError())}
              >
                ✕
              </button>
            </div>
          )}

          {saveError && (
            <div className="error-message">
              {saveError}
              <button
                type="button"
                className="error-dismiss"
                onClick={() => dispatch(clearSaveError())}
              >
                ✕
              </button>
            </div>
          )}

          {sortedNetworks.length > 0 && (
            <div className="network-list">
              {sortedNetworks.map((network, idx) => {
                const networkId = network.bssid || `${network.ssid}-${idx}`;
                const isExpanded = expandedBssid === networkId;
                const showChannel = ssidCounts[network.ssid] > 1;
                return (
                <div
                  key={networkId}
                  className={`network-item${isExpanded ? ' expanded' : ''}`}
                >
                  <div
                    className="network-item-header"
                    onClick={() => handleToggleNetwork(network)}
                  >
                    <span className="network-ssid">
                      {network.ssid}
                      {showChannel && <span className="network-channel"> (CH {network.channel})</span>}
                    </span>
                    <span className="network-info">
                      {network.secured && <span className="lock-icon">🔒</span>}
                      {renderSignalIcon(network.rssi)}
                      <span className="expand-arrow">{isExpanded ? '▲' : '▼'}</span>
                    </span>
                  </div>

                  {isExpanded && (
                    <div className="network-item-body">
                      {network.secured ? (
                        <>
                          <div className="password-input-container">
                            <input
                              type={showPassword ? 'text' : 'password'}
                              className="form-input"
                              value={password}
                              onChange={(e) => setPassword(e.target.value)}
                              placeholder={t('wifi.enterPassword')}
                              disabled={saving}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') handleConnectNetwork(network);
                              }}
                            />
                            <button
                              type="button"
                              className="password-toggle"
                              onClick={() => setShowPassword(!showPassword)}
                              disabled={saving}
                              aria-label={showPassword ? t('wifi.hidePassword') : t('wifi.showPassword')}
                            >
                              {showPassword ? '👁️' : '👁️‍🗨️'}
                            </button>
                          </div>
                          <button
                            type="button"
                            className="login-button network-connect-btn"
                            onClick={() => handleConnectNetwork(network)}
                            disabled={!password || saving}
                          >
                            {saving ? t('wifi.saving') : t('wifi.connect')}
                          </button>
                        </>
                      ) : (
                        <button
                          type="button"
                          className="login-button network-connect-btn"
                          onClick={() => handleConnectNetwork(network)}
                          disabled={saving}
                        >
                          {saving ? t('wifi.saving') : t('wifi.connectOpen')}
                        </button>
                      )}
                    </div>
                  )}
                </div>
                );
              })}
            </div>
          )}

          {/* Manual SSID entry toggle */}
          <button
            type="button"
            className="manual-entry-toggle"
            onClick={toggleManualEntry}
          >
            {showManualEntry ? t('wifi.cancelManual') : t('wifi.enterManually')}
          </button>

          {showManualEntry && (
            <form onSubmit={handleManualConnect} className="manual-entry-form">
              <div className="form-group">
                <label htmlFor="manual-ssid" className="form-label">
                  {t('wifi.ssid')}
                </label>
                <input
                  id="manual-ssid"
                  type="text"
                  className={`form-input${manualTouched && !manualSsid.trim() ? ' error' : ''}`}
                  value={manualSsid}
                  onChange={(e) => setManualSsid(e.target.value)}
                  placeholder={t('wifi.networkName')}
                  disabled={saving}
                />
                {manualTouched && !manualSsid.trim() && (
                  <div className="field-error">{t('wifi.ssidRequired')}</div>
                )}
              </div>

              <div className="form-group">
                <label htmlFor="manual-password" className="form-label">
                  {t('wifi.passwordOptional')}
                </label>
                <div className="password-input-container">
                  <input
                    id="manual-password"
                    type={showManualPassword ? 'text' : 'password'}
                    className="form-input"
                    value={manualPassword}
                    onChange={(e) => setManualPassword(e.target.value)}
                    placeholder={t('wifi.enterPassword')}
                    disabled={saving}
                  />
                  <button
                    type="button"
                    className="password-toggle"
                    onClick={() => setShowManualPassword(!showManualPassword)}
                    disabled={saving}
                    aria-label={showManualPassword ? t('wifi.hidePassword') : t('wifi.showPassword')}
                  >
                    {showManualPassword ? '👁️' : '👁️‍🗨️'}
                  </button>
                </div>
              </div>

              <button
                type="submit"
                className="login-button"
                disabled={!manualSsid.trim() || saving}
              >
                {saving ? t('wifi.saving') : t('wifi.saveConnect')}
              </button>
            </form>
          )}
        </div>

        <div className="login-footer">
          <div className="device-info">
            {t('wifi.title')}
          </div>
        </div>
      </div>
    </div>
  );
}
