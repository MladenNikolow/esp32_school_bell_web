// src/features/Auth/components/AuthGuard.jsx
import React, { useEffect, useState } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { initializeAuth, logoutUser } from '../AuthSlice.js';
import LoginPage from './LoginPage.jsx';
import Navigation from '../../Navigation/Navigation.jsx';
import DashboardPage from '../../Dashboard/DashboardPage.jsx';
import SchedulePage from '../../Schedule/SchedulePage.jsx';
import CalendarPage from '../../Calendar/CalendarPage.jsx';
import SettingsPage from '../../Settings/SettingsPage.jsx';
import RingyLogo from '../../../components/RingyLogo.jsx';
import useTheme from '../../../hooks/useTheme.js';

const PAGES = {
  dashboard: DashboardPage,
  schedule: SchedulePage,
  calendar: CalendarPage,
  settings: SettingsPage,
};

/**
 * AuthGuard component that handles authentication routing
 * Shows login page for unauthenticated users, main app for authenticated users
 */
export default function AuthGuard() {
  const dispatch = useDispatch();
  const { isAuthenticated, isInitializing, user } = useSelector((state) => state.auth);
  const [activeTab, setActiveTab] = useState('dashboard');
  const { theme, toggleTheme } = useTheme();

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

  if (!isAuthenticated) return <LoginPage />;

  const ActivePage = PAGES[activeTab] || DashboardPage;

  return (
    <div className="app-shell">
      <header className="app-header">
        <div className="header-content">
          <RingyLogo height="48px" onClick={() => setActiveTab('dashboard')} />
          <div className="user-info">
            {user && <span className="welcome-text">Hi, {user.username || 'Admin'}</span>}
            <button className="theme-toggle" onClick={toggleTheme} title="Toggle dark mode">
              {theme === 'dark' ? '☀️' : '🌙'}
            </button>
            <button className="logout-button" onClick={() => dispatch(logoutUser())}>Logout</button>
          </div>
        </div>
        <Navigation activeTab={activeTab} onTabChange={setActiveTab} />
      </header>
      <main className="app-main">
        <ActivePage />
      </main>
    </div>
  );
}