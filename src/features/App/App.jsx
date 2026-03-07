import React, { useEffect } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { checkWifiMode } from '../WiFiConfig/WiFiConfigSlice.js';
import WiFiConfigPage from '../WiFiConfig/components/WiFiConfigPage.jsx';
import AuthGuard from '../Auth/components/AuthGuard.jsx';

export default function App() {
  const dispatch = useDispatch();
  const { isApMode } = useSelector((state) => state.wifiConfig);

  useEffect(() => {
    dispatch(checkWifiMode());
  }, [dispatch]);

  return isApMode ? <WiFiConfigPage /> : <AuthGuard />;
}