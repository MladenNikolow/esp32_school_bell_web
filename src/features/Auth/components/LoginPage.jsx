// src/features/Auth/components/LoginPage.jsx
import React, { useState, useEffect } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { loginUser, clearAuthError } from '../AuthSlice.js';
import useTheme from '../../../hooks/useTheme.js';
import useLocale from '../../../hooks/useLocale.jsx';
import RingyLogo from '../../../components/RingyLogo.jsx';

export default function LoginPage() {
  const dispatch = useDispatch();
  const { isLoading, error } = useSelector((state) => state.auth);
  const { theme, toggleTheme } = useTheme();
  const { t, locale, setLocale, toggleLocale } = useLocale();
  
  const [credentials, setCredentials] = useState({
    username: '',
    password: ''
  });
  
  const [showPassword, setShowPassword] = useState(false);
  const [touched, setTouched] = useState({
    username: false,
    password: false
  });

  // Clear error when component mounts or credentials change
  useEffect(() => {
    if (error) {
      dispatch(clearAuthError());
    }
  }, [credentials.username, credentials.password, dispatch]);

  const handleInputChange = (field, value) => {
    setCredentials(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const handleInputBlur = (field) => {
    setTouched(prev => ({
      ...prev,
      [field]: true
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    // Mark all fields as touched
    setTouched({ username: true, password: true });
    
    // Validate form
    if (!credentials.username.trim() || !credentials.password) {
      return;
    }

    try {
      await dispatch(loginUser(credentials)).unwrap();
      // Navigation will be handled by auth state change
    } catch (error) {
      // Error is handled by Redux state
      console.warn('Login failed:', error);
    }
  };

  const isFormValid = credentials.username.trim() && credentials.password;
  const showUsernameError = touched.username && !credentials.username.trim();
  const showPasswordError = touched.password && !credentials.password;

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
        <form onSubmit={handleSubmit} className="login-form" autoComplete="off">
          {error && (
            <div className="error-message">
              {error}
            </div>
          )}
          
          <div className="form-group">
            <label htmlFor="username" className="form-label">
              {t('auth.username')}
            </label>
            <input
              id="username"
              type="text"
              className={`form-input ${showUsernameError ? 'error' : ''}`}
              value={credentials.username}
              onChange={(e) => handleInputChange('username', e.target.value)}
              onBlur={() => handleInputBlur('username')}
              placeholder={t('auth.enterUsername')}
              disabled={isLoading}
              autoComplete="off"
              autoCapitalize="none"
              autoCorrect="off"
            />
            {showUsernameError && (
              <div className="field-error">{t('auth.usernameRequired')}</div>
            )}
          </div>

          <div className="form-group">
            <label htmlFor="password" className="form-label">
              {t('auth.password')}
            </label>
            <div className="password-input-container">
              <input
                id="password"
                type={showPassword ? 'text' : 'password'}
                className={`form-input ${showPasswordError ? 'error' : ''}`}
                value={credentials.password}
                onChange={(e) => handleInputChange('password', e.target.value)}
                onBlur={() => handleInputBlur('password')}
                placeholder={t('auth.enterPassword')}
                disabled={isLoading}
                autoComplete="off"
              />
              <button
                type="button"
                className="password-toggle"
                onClick={() => setShowPassword(!showPassword)}
                disabled={isLoading}
                aria-label={showPassword ? t('auth.hidePassword') : t('auth.showPassword')}
              >
                {showPassword ? (
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
                    <circle cx="12" cy="12" r="3"/>
                  </svg>
                ) : (
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"/>
                    <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/>
                    <path d="M14.12 14.12a3 3 0 1 1-4.24-4.24"/>
                    <line x1="1" y1="1" x2="23" y2="23"/>
                  </svg>
                )}
              </button>
            </div>
            {showPasswordError && (
              <div className="field-error">{t('auth.passwordRequired')}</div>
            )}
          </div>

          <div className="form-actions">
            <button
              type="submit"
              className={`login-button${isLoading ? ' loading' : ''}`}
              disabled={!isFormValid || isLoading}
            >
              {isLoading ? t('auth.connecting') : t('auth.connect')}
            </button>
          </div>
        </form>

        <div className="login-footer">
          <div className="device-info">
            {t('auth.footer')}
          </div>
        </div>
      </div>
    </div>
  );
}