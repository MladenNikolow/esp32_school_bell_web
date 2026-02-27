// src/features/Auth/components/AuthGuard.jsx
import React, { useEffect } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { initializeAuth } from '../AuthSlice.js';
import LoginPage from './LoginPage.jsx';
import HomePage from '../../Home/HomePage.jsx';

/**
 * AuthGuard component that handles authentication routing
 * Shows login page for unauthenticated users, home page for authenticated users
 */
export default function AuthGuard() {
  const dispatch = useDispatch();
  const { isAuthenticated, isInitializing, token } = useSelector((state) => state.auth);

  // Initialize authentication on component mount
  useEffect(() => {
    if (isInitializing) {
      dispatch(initializeAuth());
    }
  }, [dispatch, isInitializing]);

  // Show loading screen during initialization
  if (isInitializing) {
    return (
      <div className="auth-loading">
        <div className="loading-container">
          <div className="loading-spinner"></div>
          <div className="loading-text">
            Initializing ESP32 Connection...
          </div>
        </div>
      </div>
    );
  }

  // Show appropriate page based on authentication state
  return isAuthenticated ? <HomePage /> : <LoginPage />;
}