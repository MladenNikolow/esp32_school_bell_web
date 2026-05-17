// src/features/Auth/components/AuthGuard.jsx
import React, { useEffect, useState } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { initializeAuth, logoutUser } from '../AuthSlice.js';
import LoginPage from './LoginPage.jsx';
import Navigation from '../../Navigation/Navigation.jsx';
import DashboardPage from '../../Dashboard/DashboardPage.jsx';
import SchedulePage from '../../Schedule/SchedulePage.jsx';
import SettingsPage from '../../Settings/SettingsPage.jsx';
import DiagnosticsPage from '../../Diagnostics/DiagnosticsPage.jsx';
import { fetchDiagnostics } from '../../Diagnostics/DiagnosticsSlice.js';
import RingyLogo from '../../../components/RingyLogo.jsx';
import useTheme from '../../../hooks/useTheme.js';
import useLocale from '../../../hooks/useLocale.jsx';

const PAGES = {
  dashboard: DashboardPage,
  schedule: SchedulePage,
  settings: SettingsPage,
  diagnostics: DiagnosticsPage,
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
  const { t, locale, setLocale, toggleLocale } = useLocale();

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
            {t('auth.initConnection')}
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
            {user && <span className="welcome-text">{t('auth.welcome', { name: user.username || 'Admin' })}</span>}
            <HeaderHealthDot onClick={() => setActiveTab('diagnostics')} title={t('diag.openTitle')} />
            <div className="header-toggles">
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
              <button className="theme-toggle" onClick={toggleTheme} title={t('auth.toggleDarkMode')}>
                {theme === 'dark' ? '☀️' : '🌙'}
              </button>
            </div>
            <button className="logout-button" onClick={() => dispatch(logoutUser())}>{t('auth.logout')}</button>
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

/**
 * Small clickable health dot in the header. Polls /api/diagnostics
 * (lightly) via the Redux slice and shows a colored indicator:
 *   green  = healthy
 *   orange = degraded
 *   red    = critical
 * Hidden if no data is available yet.
 */
function HeaderHealthDot({ onClick, title }) {
  const dispatch = useDispatch();
  const health = useSelector((s) => s.diagnostics?.health);

  useEffect(() => {
    dispatch(fetchDiagnostics());
    const id = setInterval(() => dispatch(fetchDiagnostics()), 30000);
    return () => clearInterval(id);
  }, [dispatch]);

  if (!health) return null;
  const cls = health.critical ? 'critical' : health.degraded ? 'degraded' : 'ok';
  return (
    <button
      type="button"
      className={`header-health-dot ${cls}`}
      onClick={onClick}
      title={title}
      aria-label={title}
    />
  );
}