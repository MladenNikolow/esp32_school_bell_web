import React, { useEffect } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { checkWifiMode } from '../WiFiConfig/WiFiConfigSlice.js';
import WiFiConfigPage from '../WiFiConfig/components/WiFiConfigPage.jsx';
import AuthGuard from '../Auth/components/AuthGuard.jsx';
import useLocale from '../../hooks/useLocale.jsx';

export default function App() {
  const dispatch = useDispatch();
  const { t } = useLocale();
  const { isApMode, wifiModeChecked } = useSelector((state) => state.wifiConfig);

  useEffect(() => {
    dispatch(checkWifiMode());
  }, [dispatch]);

  // Wait for the AP-mode check to settle before rendering anything else.
  // This prevents <AuthGuard /> from mounting (and calling initializeAuth)
  // while the check is still in-flight, which would flash <LoginPage /> in AP mode.
  if (!wifiModeChecked) {
    return (
      <div className="auth-loading">
        <div className="loading-container">
          <div className="loading-spinner"></div>
          <div className="loading-text">{t('app.connecting')}</div>
        </div>
      </div>
    );
  }

  return isApMode ? <WiFiConfigPage /> : <AuthGuard />;
}