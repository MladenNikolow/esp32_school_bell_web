// src/features/Auth/components/LoginPage.jsx
import React, { useState, useEffect } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { loginUser, clearAuthError } from '../AuthSlice.js';

export default function LoginPage() {
  const dispatch = useDispatch();
  const { isLoading, error } = useSelector((state) => state.auth);
  
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
        <h1>Ringy Login</h1>
      </div>
      
      <div className="login-content">
        <form onSubmit={handleSubmit} className="login-form">
          {error && (
            <div className="error-message">
              {error}
            </div>
          )}
          
          <div className="form-group">
            <label htmlFor="username" className="form-label">
              Username
            </label>
            <input
              id="username"
              type="text"
              className={`form-input ${showUsernameError ? 'error' : ''}`}
              value={credentials.username}
              onChange={(e) => handleInputChange('username', e.target.value)}
              onBlur={() => handleInputBlur('username')}
              placeholder="Enter username"
              disabled={isLoading}
              autoComplete="username"
              autoCapitalize="none"
              autoCorrect="off"
            />
            {showUsernameError && (
              <div className="field-error">Username is required</div>
            )}
          </div>

          <div className="form-group">
            <label htmlFor="password" className="form-label">
              Password
            </label>
            <div className="password-input-container">
              <input
                id="password"
                type={showPassword ? 'text' : 'password'}
                className={`form-input ${showPasswordError ? 'error' : ''}`}
                value={credentials.password}
                onChange={(e) => handleInputChange('password', e.target.value)}
                onBlur={() => handleInputBlur('password')}
                placeholder="Enter password"
                disabled={isLoading}
                autoComplete="current-password"
              />
              <button
                type="button"
                className="password-toggle"
                onClick={() => setShowPassword(!showPassword)}
                disabled={isLoading}
                aria-label={showPassword ? 'Hide password' : 'Show password'}
              >
                {showPassword ? '👁️' : '👁️‍🗨️'}
              </button>
            </div>
            {showPasswordError && (
              <div className="field-error">Password is required</div>
            )}
          </div>

          <div className="form-actions">
            <button
              type="submit"
              className="login-button"
              disabled={!isFormValid || isLoading}
            >
              {isLoading ? 'Connecting...' : 'Connect'}
            </button>
          </div>
        </form>

        <div className="login-footer">
          <div className="device-info">
            ESP32 Authentication System
          </div>
        </div>
      </div>
    </div>
  );
}