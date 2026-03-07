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

  const [ssid, setSsid] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [selectedSecured, setSelectedSecured] = useState(true);
  const [touched, setTouched] = useState({ ssid: false, password: false });

  const handleScanNetworks = () => {
    dispatch(fetchNetworks());
  };

  const handleSelectNetwork = (network) => {
    setSsid(network.ssid);
    setSelectedSecured(network.secured);
    setTouched((prev) => ({ ...prev, ssid: true }));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    setTouched({ ssid: true, password: true });

    if (!ssid.trim()) return;
    if (selectedSecured && !password) return;

    dispatch(saveWifiConfig({ ssid: ssid.trim(), password }));
  };

  const showSsidError = touched.ssid && !ssid.trim();
  const showPasswordError = touched.password && selectedSecured && !password;
  const isFormValid = ssid.trim() && (!selectedSecured || password);

  const sortedNetworks = [...networks].sort((a, b) => b.rssi - a.rssi);

  const getSignalLevel = (rssi) => {
    if (rssi >= -50) return 4;
    if (rssi >= -60) return 3;
    if (rssi >= -70) return 2;
    return 1;
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
              <strong>{ssid}</strong>.
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

          {sortedNetworks.length > 0 && (
            <div className="network-list">
              {sortedNetworks.map((network, idx) => (
                <div
                  key={`${network.ssid}-${idx}`}
                  className={`network-item${ssid === network.ssid ? ' selected' : ''}`}
                  onClick={() => handleSelectNetwork(network)}
                >
                  <span>{network.ssid}</span>
                  <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    {network.secured && <span className="lock-icon">🔒</span>}
                    <span className="signal-bar" data-level={getSignalLevel(network.rssi)}>
                      {network.rssi} dBm
                    </span>
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* WiFi config form */}
        <form onSubmit={handleSubmit} className="login-form" style={{ marginTop: 20 }}>
          <h2 style={{ margin: '0 0 16px', fontSize: 18, fontWeight: 500, color: '#424242' }}>
            Connect to Network
          </h2>

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

          <div className="form-group">
            <label htmlFor="wifi-ssid" className="form-label">
              SSID
            </label>
            <input
              id="wifi-ssid"
              type="text"
              className={`form-input${showSsidError ? ' error' : ''}`}
              value={ssid}
              onChange={(e) => setSsid(e.target.value)}
              onBlur={() => setTouched((prev) => ({ ...prev, ssid: true }))}
              placeholder="Network name"
              disabled={saving}
            />
            {showSsidError && (
              <div className="field-error">SSID is required</div>
            )}
          </div>

          <div className="form-group">
            <label htmlFor="wifi-password" className="form-label">
              Password
            </label>
            <div className="password-input-container">
              <input
                id="wifi-password"
                type={showPassword ? 'text' : 'password'}
                className={`form-input${showPasswordError ? ' error' : ''}`}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                onBlur={() => setTouched((prev) => ({ ...prev, password: true }))}
                placeholder={selectedSecured ? 'Enter password' : 'Not required for open network'}
                disabled={saving}
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
            {showPasswordError && (
              <div className="field-error">Password is required for secured networks</div>
            )}
          </div>

          <div className="form-actions">
            <button
              type="submit"
              className="login-button"
              disabled={!isFormValid || saving}
            >
              {saving ? 'Saving...' : 'Save & Connect'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
