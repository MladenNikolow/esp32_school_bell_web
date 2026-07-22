// src/features/Auth/components/LoginPage.jsx
import React, { useState, useEffect } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { loginUser, claimAccount, clearAuthError } from '../AuthSlice.js';
import AuthService from '../../../services/AuthService.js';
import useTheme from '../../../hooks/useTheme.js';
import useLocale from '../../../hooks/useLocale.jsx';
import RingyLogo from '../../../components/RingyLogo.jsx';

function passwordStrength(password) {
  if (!password) return 0;
  if (password.length < 8) return 1;
  if (password.length < 12) return 2;
  return 3;
}

export default function LoginPage() {
  const dispatch = useDispatch();
  const { isLoading, error } = useSelector((state) => state.auth);
  const { theme, toggleTheme } = useTheme();
  const { t, locale, setLocale } = useLocale();

  const [mode, setMode] = useState('login'); // 'login' | 'signup'
  const [claimable, setClaimable] = useState(false);
  const [claimStatusLoaded, setClaimStatusLoaded] = useState(false);

  const [credentials, setCredentials] = useState({
    username: '',
    password: '',
    confirmPassword: ''
  });

  const [showPassword, setShowPassword] = useState(false);
  const [touched, setTouched] = useState({
    username: false,
    password: false,
    confirmPassword: false
  });

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const status = await AuthService.getClaimStatus();
      if (!cancelled) {
        setClaimable(!!status.claimable);
        setClaimStatusLoaded(true);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  // Clear error when component mounts or credentials/mode change
  useEffect(() => {
    if (error) {
      dispatch(clearAuthError());
    }
  }, [credentials.username, credentials.password, credentials.confirmPassword, mode, dispatch]);

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

  const switchToSignup = () => {
    setMode('signup');
    setTouched({ username: false, password: false, confirmPassword: false });
    dispatch(clearAuthError());
  };

  const switchToLogin = () => {
    setMode('login');
    setCredentials(prev => ({ ...prev, confirmPassword: '' }));
    setTouched({ username: false, password: false, confirmPassword: false });
    dispatch(clearAuthError());
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (mode === 'signup') {
      setTouched({ username: true, password: true, confirmPassword: true });
      if (!credentials.username.trim() || !credentials.password) {
        return;
      }
      if (credentials.password.length < 8) {
        return;
      }
      if (credentials.password !== credentials.confirmPassword) {
        return;
      }

      try {
        await dispatch(claimAccount({
          username: credentials.username.trim(),
          password: credentials.password
        })).unwrap();
      } catch (err) {
        console.warn('Claim failed:', err);
        // If already claimed, hide signup permanently
        if (typeof err === 'string' && /already claimed/i.test(err)) {
          setClaimable(false);
          setMode('login');
        }
      }
      return;
    }

    setTouched({ username: true, password: true, confirmPassword: false });

    if (!credentials.username.trim() || !credentials.password) {
      return;
    }

    try {
      await dispatch(loginUser({
        username: credentials.username.trim(),
        password: credentials.password
      })).unwrap();
    } catch (err) {
      console.warn('Login failed:', err);
    }
  };

  const strength = passwordStrength(credentials.password);
  const passwordTooShort = mode === 'signup' && touched.password && credentials.password.length > 0
    && credentials.password.length < 8;
  const passwordsMismatch = mode === 'signup' && touched.confirmPassword
    && credentials.confirmPassword.length > 0
    && credentials.password !== credentials.confirmPassword;

  const isFormValid = mode === 'signup'
    ? (credentials.username.trim()
        && credentials.password.length >= 8
        && credentials.password === credentials.confirmPassword)
    : (credentials.username.trim() && credentials.password);

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
        <form
          onSubmit={handleSubmit}
          className={`login-form${mode === 'signup' ? ' login-form--signup' : ''}`}
          autoComplete="off"
        >
          {mode === 'signup' && (
            <div className="login-signup-header">
              <button
                type="button"
                className="login-back-button"
                onClick={switchToLogin}
                disabled={isLoading}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <polyline points="15 18 9 12 15 6" />
                </svg>
                {t('auth.backToLogin')}
              </button>
              <div className="login-signup-badge">{t('auth.createAccountTitle')}</div>
              <p className="login-signup-subtitle">{t('auth.createAccountSubtitle')}</p>
            </div>
          )}

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
              maxLength={31}
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
                className={`form-input ${showPasswordError || passwordTooShort ? 'error' : ''}`}
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
            {passwordTooShort && (
              <div className="field-error">{t('auth.passwordMinLength')}</div>
            )}
            {mode === 'signup' && credentials.password.length > 0 && !passwordTooShort && (
              <div className="login-password-meter" aria-hidden="true">
                <div className="login-password-meter-track">
                  <span className={`login-password-meter-bar strength-${strength}`} />
                </div>
                <span className="login-password-meter-hint">{t('auth.passwordHint')}</span>
              </div>
            )}
          </div>

          {mode === 'signup' && (
            <div className="form-group">
              <label htmlFor="confirmPassword" className="form-label">
                {t('auth.confirmPassword')}
              </label>
              <input
                id="confirmPassword"
                type={showPassword ? 'text' : 'password'}
                className={`form-input ${passwordsMismatch ? 'error' : ''}`}
                value={credentials.confirmPassword}
                onChange={(e) => handleInputChange('confirmPassword', e.target.value)}
                onBlur={() => handleInputBlur('confirmPassword')}
                placeholder={t('auth.enterConfirmPassword')}
                disabled={isLoading}
                autoComplete="off"
              />
              {passwordsMismatch && (
                <div className="field-error">{t('auth.passwordMismatch')}</div>
              )}
            </div>
          )}

          <div className="form-actions">
            <button
              type="submit"
              className={`login-button${isLoading ? ' loading' : ''}`}
              disabled={!isFormValid || isLoading}
            >
              {isLoading
                ? (mode === 'signup' ? t('auth.creatingAccount') : t('auth.connecting'))
                : (mode === 'signup' ? t('auth.createAccount') : t('auth.connect'))}
            </button>
          </div>

          {claimStatusLoaded && claimable && mode === 'login' && (
            <div className="login-setup-panel">
              <div className="login-or-divider" role="separator">
                <span>{t('auth.orDivider')}</span>
              </div>
              <button
                type="button"
                className="login-secondary-button"
                onClick={switchToSignup}
                disabled={isLoading}
              >
                {t('auth.createAccountLink')}
              </button>
            </div>
          )}
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
