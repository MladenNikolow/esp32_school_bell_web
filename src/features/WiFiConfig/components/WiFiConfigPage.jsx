import React, { useState } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import {
  fetchNetworks,
  saveWifiConfig,
  clearNetworksError,
  clearSaveError,
} from '../WiFiConfigSlice.js';

export default function WiFiConfigPage() {
  const dispatch = useDispatch();
  const {
    apSsid,
    networks,
    networksLoading,
    networksError,
    saving,
    saveError,
    saved,
  } = useSelector((state) => state.wifiConfig);

  const [expandedSsid, setExpandedSsid] = useState(null);
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [manualSsid, setManualSsid] = useState('');
  const [manualPassword, setManualPassword] = useState('');
  const [showManualPassword, setShowManualPassword] = useState(false);
  const [showManualEntry, setShowManualEntry] = useState(false);
  const [manualTouched, setManualTouched] = useState(false);

  // The SSID that was submitted (for success message)
  const [submittedSsid, setSubmittedSsid] = useState('');

  const handleScanNetworks = () => {
    dispatch(fetchNetworks());
  };

  const handleToggleNetwork = (network) => {
    if (expandedSsid === network.ssid) {
      setExpandedSsid(null);
      setPassword('');
      setShowPassword(false);
    } else {
      setExpandedSsid(network.ssid);
      setPassword('');
      setShowPassword(false);
      setShowManualEntry(false);
    }
  };

  const handleConnectNetwork = (network) => {
    if (!network.secured && !password) {
      // Open network — no password needed
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
    setExpandedSsid(null);
    setPassword('');
    setManualSsid('');
    setManualPassword('');
    setManualTouched(false);
  };

  const sortedNetworks = [...networks].sort((a, b) => b.rssi - a.rssi);

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
      <div className="wifi-config-container">
        <div className="wifi-config-header">
          <h1>Ringy — WiFi Setup</h1>
        </div>
        <div className="wifi-config-content">
          <div className="success-banner">
            <p>
              Credentials saved! The device is restarting and will connect to{' '}
              <strong>{submittedSsid}</strong>.
            </p>
            <p>
              This page will become unavailable — reconnect to your normal
              network and navigate to the device's new IP address.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="wifi-config-container">
      <div className="wifi-config-header">
        <h1>Ringy — WiFi Setup</h1>
      </div>

      <div className="wifi-config-content">
        {/* Connection info card */}
        <div className="login-form">
          <p style={{ margin: 0, color: '#424242' }}>
            You are connected to the device's access point:{' '}
            <strong>{apSsid}</strong>
          </p>
        </div>

        {/* Network scanner panel */}
        <div className="login-form" style={{ marginTop: 20 }}>
          <h2 style={{ margin: '0 0 16px', fontSize: 18, fontWeight: 500, color: '#424242' }}>
            Available Networks
          </h2>

          <button
            type="button"
            className="login-button"
            onClick={handleScanNetworks}
            disabled={networksLoading}
            style={{ marginBottom: 16 }}
          >
            {networksLoading ? 'Scanning...' : 'Scan for Networks'}
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
              {sortedNetworks.map((network, idx) => (
                <div
                  key={`${network.ssid}-${idx}`}
                  className={`network-item${expandedSsid === network.ssid ? ' expanded' : ''}`}
                >
                  <div
                    className="network-item-header"
                    onClick={() => handleToggleNetwork(network)}
                  >
                    <span className="network-ssid">{network.ssid}</span>
                    <span className="network-info">
                      {network.secured && <span className="lock-icon">🔒</span>}
                      {renderSignalIcon(network.rssi)}
                      <span className="expand-arrow">{expandedSsid === network.ssid ? '▲' : '▼'}</span>
                    </span>
                  </div>

                  {expandedSsid === network.ssid && (
                    <div className="network-item-body">
                      {network.secured ? (
                        <>
                          <div className="password-input-container">
                            <input
                              type={showPassword ? 'text' : 'password'}
                              className="form-input"
                              value={password}
                              onChange={(e) => setPassword(e.target.value)}
                              placeholder="Enter password"
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
                              aria-label={showPassword ? 'Hide password' : 'Show password'}
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
                            {saving ? 'Saving...' : 'Connect'}
                          </button>
                        </>
                      ) : (
                        <button
                          type="button"
                          className="login-button network-connect-btn"
                          onClick={() => handleConnectNetwork(network)}
                          disabled={saving}
                        >
                          {saving ? 'Saving...' : 'Connect (Open Network)'}
                        </button>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* Manual SSID entry toggle */}
          <button
            type="button"
            className="manual-entry-toggle"
            onClick={toggleManualEntry}
          >
            {showManualEntry ? 'Cancel manual entry' : 'Enter SSID manually'}
          </button>

          {showManualEntry && (
            <form onSubmit={handleManualConnect} className="manual-entry-form">
              <div className="form-group">
                <label htmlFor="manual-ssid" className="form-label">
                  SSID
                </label>
                <input
                  id="manual-ssid"
                  type="text"
                  className={`form-input${manualTouched && !manualSsid.trim() ? ' error' : ''}`}
                  value={manualSsid}
                  onChange={(e) => setManualSsid(e.target.value)}
                  placeholder="Network name"
                  disabled={saving}
                />
                {manualTouched && !manualSsid.trim() && (
                  <div className="field-error">SSID is required</div>
                )}
              </div>

              <div className="form-group">
                <label htmlFor="manual-password" className="form-label">
                  Password (optional for open networks)
                </label>
                <div className="password-input-container">
                  <input
                    id="manual-password"
                    type={showManualPassword ? 'text' : 'password'}
                    className="form-input"
                    value={manualPassword}
                    onChange={(e) => setManualPassword(e.target.value)}
                    placeholder="Enter password"
                    disabled={saving}
                  />
                  <button
                    type="button"
                    className="password-toggle"
                    onClick={() => setShowManualPassword(!showManualPassword)}
                    disabled={saving}
                    aria-label={showManualPassword ? 'Hide password' : 'Show password'}
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
                {saving ? 'Saving...' : 'Save & Connect'}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
