// src/features/Auth/components/HomePage.jsx
import React, { useEffect } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { logoutUser } from '../AuthSlice.js';
import { loadMode, updateMode, setModeLocal, clearError } from '../../App/AppSlice.jsx';
import './HomePage.css';

export default function HomePage() {
  const dispatch = useDispatch();
  const { user, isLoading: authLoading } = useSelector((state) => state.auth);
  const { value: mode, connected, loading, saving, error } = useSelector((state) => state.mode);

  // Load mode data on component mount
  useEffect(() => {
    dispatch(loadMode());
  }, [dispatch]);

  const handleLogout = async () => {
    try {
      await dispatch(logoutUser()).unwrap();
      // Navigation will be handled by auth state change
    } catch (error) {
      console.warn('Logout failed:', error);
      // Force logout even if server call fails
    }
  };

  const handleSaveMode = () => {
    dispatch(updateMode(mode));
  };

  const handleRetryConnection = () => {
    dispatch(loadMode());
  };

  const handleModeChange = (e) => {
    dispatch(setModeLocal(e.target.value));
  };

  const handleClearError = () => {
    dispatch(clearError());
  };

  return (
    <div className="home-container">
      <div className="home-header">
        <div className="header-content">
          <h1>Ringy Control Panel</h1>
          <div className="user-info">
            <span className="welcome-text">
              Welcome, {user?.username || 'User'}
            </span>
            <button 
              className="logout-button"
              onClick={handleLogout}
              disabled={authLoading}
            >
              {authLoading ? 'Logging out...' : 'Logout'}
            </button>
          </div>
        </div>
      </div>

      <div className="home-content">
        <div className="control-panel">
          <div className="status-section">
            <h2>Device Status</h2>
            <div className="status-indicator">
              <div className={`status-dot ${connected ? 'connected' : 'disconnected'}`}></div>
              <span className="status-text">
                {loading ? (
                  'Checking device...'
                ) : connected ? (
                  'Connected'
                ) : (
                  'Disconnected'
                )}
              </span>
            </div>
          </div>

          {error && (
            <div className="error-section">
              <div className="error-message">
                {error}
                <button 
                  className="error-dismiss"
                  onClick={handleClearError}
                >
                  ✕
                </button>
              </div>
            </div>
          )}

          <div className="mode-section">
            <h2>Mode Control</h2>
            <div className="mode-control">
              <label htmlFor="mode-input" className="mode-label">
                Current Mode:
              </label>
              <div className="mode-input-group">
                <input
                  id="mode-input"
                  type="text"
                  className="mode-input"
                  value={mode}
                  onChange={handleModeChange}
                  placeholder="Enter mode value"
                  disabled={saving}
                />
                <button
                  className="save-button"
                  onClick={handleSaveMode}
                  disabled={saving || !mode.trim()}
                >
                  {saving ? 'Saving...' : 'Save'}
                </button>
              </div>
            </div>
          </div>

          <div className="actions-section">
            <button
              className="retry-button"
              onClick={handleRetryConnection}
              disabled={loading}
            >
              {loading ? 'Refreshing...' : 'Refresh Status'}
            </button>
          </div>
        </div>

        <div className="info-panel">
          <h3>Device Information</h3>
          <div className="info-grid">
            <div className="info-item">
              <span className="info-label">Connection:</span>
              <span className="info-value">
                {connected ? 'Active' : 'Inactive'}
              </span>
            </div>
            <div className="info-item">
              <span className="info-label">Mode:</span>
              <span className="info-value">
                {mode || 'Not set'}
              </span>
            </div>
            <div className="info-item">
              <span className="info-label">User:</span>
              <span className="info-value">
                {user?.username || 'Unknown'}
              </span>
            </div>
          </div>
        </div>
      </div>

      <div className="home-footer">
        <div className="footer-text">
          ESP32 Authentication System - Secure Device Control
        </div>
      </div>
    </div>
  );
}