// src/features/Auth/AuthSlice.js
import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import HttpRequestAgent from '../../utils/HttpRequestAgent.js';
import TokenManager from '../../utils/TokenManager.js';

// Async thunk for login
export const loginUser = createAsyncThunk(
  'auth/loginUser',
  async (credentials, { rejectWithValue }) => {
    try {
      const data = await HttpRequestAgent.login(credentials);
      return data;
    } catch (err) {
      return rejectWithValue(err.message || 'Login failed');
    }
  }
);

// Async thunk for logout
export const logoutUser = createAsyncThunk(
  'auth/logoutUser',
  async (_, { rejectWithValue }) => {
    try {
      await HttpRequestAgent.logout();
      return {};
    } catch (err) {
      return rejectWithValue(err.message || 'Logout failed');
    }
  }
);

// Async thunk for checking stored session on app initialization
export const initializeAuth = createAsyncThunk(
  'auth/initializeAuth',
  async (_, { rejectWithValue }) => {
    try {
      const result = await HttpRequestAgent.validateToken();
      return result.valid ? 
        { authenticated: true, user: result.user } :
        { authenticated: false, user: null };
    } catch (err) {
      // On error, clear auth metadata and return unauthenticated state
      TokenManager.clearAuthSession();
      return { authenticated: false, user: null };
    }
  }
);

const initialState = {
  isAuthenticated: false, // Driven by server session cookie validation
  isLoading: false,       // For login/logout operations
  isInitializing: true,   // For app startup session check
  error: null,            // Authentication error messages
  user: null              // User information from login response
};

const authSlice = createSlice({
  name: 'auth',
  initialState,
  reducers: {
    // Clear authentication error
    clearAuthError(state) {
      state.error = null;
    },
    
    // Clear authentication state (for server auth errors)
    clearAuthToken(state) {
      state.isAuthenticated = false;
      state.user = null;
      TokenManager.clearAuthSession();
    },
    
    // Set authentication from external source
    setAuthFromToken(state, action) {
      const { user } = action.payload;
      state.isAuthenticated = true;
      state.user = user || null;
    }
  },
  extraReducers: (builder) => {
    builder
      // loginUser
      .addCase(loginUser.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(loginUser.fulfilled, (state, action) => {
        state.isLoading = false;
        state.isAuthenticated = true;
        state.user = action.payload.user || null;
        state.error = null;
      })
      .addCase(loginUser.rejected, (state, action) => {
        state.isLoading = false;
        state.isAuthenticated = false;
        state.user = null;
        state.error = action.payload || 'Login failed';
      })

      // logoutUser
      .addCase(logoutUser.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(logoutUser.fulfilled, (state) => {
        state.isLoading = false;
        state.isAuthenticated = false;
        state.user = null;
        state.error = null;
      })
      .addCase(logoutUser.rejected, (state, action) => {
        state.isLoading = false;
        // Even if logout fails, clear local state
        state.isAuthenticated = false;
        state.user = null;
        state.error = action.payload || 'Logout failed';
      })

      // initializeAuth
      .addCase(initializeAuth.pending, (state) => {
        state.isInitializing = true;
        state.error = null;
      })
      .addCase(initializeAuth.fulfilled, (state, action) => {
        state.isInitializing = false;
        state.isAuthenticated = action.payload.authenticated;
        state.user = action.payload.user;
        state.error = null;
      })
      .addCase(initializeAuth.rejected, (state, action) => {
        state.isInitializing = false;
        state.isAuthenticated = false;
        state.user = null;
        state.error = action.payload || 'Initialization failed';
      });
  },
});

export const { clearAuthError, clearAuthToken, setAuthFromToken } = authSlice.actions;
export default authSlice.reducer;