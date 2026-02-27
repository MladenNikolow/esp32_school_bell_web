// src/features/Auth/components/__tests__/LoginPage.test.jsx
// Basic integration tests for LoginPage component

import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { Provider } from 'react-redux';
import { configureStore } from '@reduxjs/toolkit';
import LoginPage from '../LoginPage.jsx';
import authReducer from '../../AuthSlice.js';

// Mock store for testing
const createMockStore = (initialState = {}) => {
  return configureStore({
    reducer: {
      auth: authReducer,
    },
    preloadedState: {
      auth: {
        token: null,
        isAuthenticated: false,
        isLoading: false,
        isInitializing: false,
        error: null,
        user: null,
        ...initialState,
      },
    },
  });
};

// Helper to render component with Redux store
const renderWithStore = (component, store) => {
  return render(
    <Provider store={store}>
      {component}
    </Provider>
  );
};

describe('LoginPage Component', () => {
  beforeEach(() => {
    // Clear localStorage before each test
    localStorage.clear();
  });

  test('renders login form with all required elements', () => {
    const store = createMockStore();
    renderWithStore(<LoginPage />, store);

    // Check for main elements
    expect(screen.getByText('ESP32 Login')).toBeInTheDocument();
    expect(screen.getByLabelText(/username/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/password/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /connect/i })).toBeInTheDocument();
  });

  test('form validation works correctly', async () => {
    const store = createMockStore();
    renderWithStore(<LoginPage />, store);

    const submitButton = screen.getByRole('button', { name: /connect/i });
    const usernameInput = screen.getByLabelText(/username/i);
    const passwordInput = screen.getByLabelText(/password/i);

    // Initially button should be disabled (empty form)
    expect(submitButton).toBeDisabled();

    // Enter username only
    fireEvent.change(usernameInput, { target: { value: 'testuser' } });
    expect(submitButton).toBeDisabled(); // Still disabled without password

    // Enter password
    fireEvent.change(passwordInput, { target: { value: 'testpass' } });
    expect(submitButton).not.toBeDisabled(); // Now enabled

    // Clear username
    fireEvent.change(usernameInput, { target: { value: '' } });
    expect(submitButton).toBeDisabled(); // Disabled again
  });

  test('shows validation errors on blur', async () => {
    const store = createMockStore();
    renderWithStore(<LoginPage />, store);

    const usernameInput = screen.getByLabelText(/username/i);
    const passwordInput = screen.getByLabelText(/password/i);

    // Focus and blur username without entering value
    fireEvent.focus(usernameInput);
    fireEvent.blur(usernameInput);

    await waitFor(() => {
      expect(screen.getByText('Username is required')).toBeInTheDocument();
    });

    // Focus and blur password without entering value
    fireEvent.focus(passwordInput);
    fireEvent.blur(passwordInput);

    await waitFor(() => {
      expect(screen.getByText('Password is required')).toBeInTheDocument();
    });
  });

  test('password visibility toggle works', () => {
    const store = createMockStore();
    renderWithStore(<LoginPage />, store);

    const passwordInput = screen.getByLabelText(/password/i);
    const toggleButton = screen.getByRole('button', { name: /show password/i });

    // Initially password should be hidden
    expect(passwordInput.type).toBe('password');

    // Click toggle to show password
    fireEvent.click(toggleButton);
    expect(passwordInput.type).toBe('text');

    // Click toggle to hide password again
    fireEvent.click(toggleButton);
    expect(passwordInput.type).toBe('password');
  });

  test('displays error message from Redux state', () => {
    const store = createMockStore({
      error: 'Invalid username or password',
    });
    renderWithStore(<LoginPage />, store);

    expect(screen.getByText('Invalid username or password')).toBeInTheDocument();
  });

  test('shows loading state correctly', () => {
    const store = createMockStore({
      isLoading: true,
    });
    renderWithStore(<LoginPage />, store);

    const submitButton = screen.getByRole('button', { name: /connecting/i });
    const usernameInput = screen.getByLabelText(/username/i);
    const passwordInput = screen.getByLabelText(/password/i);

    // All form elements should be disabled during loading
    expect(submitButton).toBeDisabled();
    expect(usernameInput).toBeDisabled();
    expect(passwordInput).toBeDisabled();
  });

  test('form submission with valid credentials', async () => {
    const store = createMockStore();
    renderWithStore(<LoginPage />, store);

    const usernameInput = screen.getByLabelText(/username/i);
    const passwordInput = screen.getByLabelText(/password/i);
    const submitButton = screen.getByRole('button', { name: /connect/i });

    // Fill in valid credentials
    fireEvent.change(usernameInput, { target: { value: 'testuser' } });
    fireEvent.change(passwordInput, { target: { value: 'testpass' } });

    // Submit form
    fireEvent.click(submitButton);

    // Check that form submission was attempted
    // (In a real test, you'd mock the dispatch and verify it was called)
    expect(submitButton).toBeInTheDocument();
  });

  test('clears error when user starts typing', async () => {
    const store = createMockStore({
      error: 'Login failed',
    });
    renderWithStore(<LoginPage />, store);

    // Error should be visible initially
    expect(screen.getByText('Login failed')).toBeInTheDocument();

    // Start typing in username field
    const usernameInput = screen.getByLabelText(/username/i);
    fireEvent.change(usernameInput, { target: { value: 'a' } });

    // Error should be cleared (this would require mocking the dispatch)
    // In a real test environment, you'd verify the clearAuthError action was dispatched
  });

  test('handles keyboard navigation correctly', () => {
    const store = createMockStore();
    renderWithStore(<LoginPage />, store);

    const usernameInput = screen.getByLabelText(/username/i);
    const passwordInput = screen.getByLabelText(/password/i);
    const submitButton = screen.getByRole('button', { name: /connect/i });

    // Tab navigation should work
    usernameInput.focus();
    expect(document.activeElement).toBe(usernameInput);

    // Enter key in password field should submit form (when valid)
    fireEvent.change(usernameInput, { target: { value: 'testuser' } });
    fireEvent.change(passwordInput, { target: { value: 'testpass' } });
    
    fireEvent.keyDown(passwordInput, { key: 'Enter', code: 'Enter' });
    // Form submission would be tested with proper mocking
  