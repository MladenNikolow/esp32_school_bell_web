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

// Async thunk for checking stored token on app initialization
export const initializeAuth = createAsyncThunk(
  'auth/initializeAuth',
  async (_, { rejectWithValue }) => {
    try {
      const result = await HttpRequestAgent.validateToken();
      return result.valid ? 
        { token: TokenManager.getStoredToken(), user: result.user } :
        { token: null, user: null };
    } catch (err) {
      // On error, clear stored token and return unauthenticated state
      TokenManager.clearStoredToken();
      return { token: null, user: null };
    }
  }
);

// Helper function to get stored token
export const getStoredToken = () => {
  return TokenManager.getStoredToken();
};

const initialState = {
  token: null,           // Bearer or session token from server
  isAuthenticated: false, // Computed from token presence
  isLoading: false,      // For login/logout operations
  isInitializing: true,  // For app startup token check
  error: null,           // Authentication error messages
  user: null             // User information from login response
};

const authSlice = createSlice({
  name: 'auth',
  initialState,
  reducers: {
    // Clear authentication error
    clearAuthError(state) {
      state.error = null;
    },
    
    // Clear stored token (for server auth errors)
    clearAuthToken(state) {
      state.token = null;
      state.isAuthenticated = false;
      state.user = null;
      TokenManager.clearStoredToken();
    },
    
    // Set authentication from external source (e.g., HTTP interceptor)
    setAuthFromToken(state, action) {
      const { token, user } = action.payload;
      state.token = token;
      state.isAuthenticated = !!token;
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
        state.token = action.payload.token;
        state.isAuthenticated = true;
        state.user = action.payload.user || null;
        state.error = null;
      })
      .addCase(loginUser.rejected, (state, action) => {
        state.isLoading = false;
        state.token = null;
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
        state.token = null;
        state.isAuthenticated = false;
        state.user = null;
        state.error = null;
      })
      .addCase(logoutUser.rejected, (state, action) => {
        state.isLoading = false;
        // Even if logout fails, clear local state
        state.token = null;
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
        state.token = action.payload.token;
        state.isAuthenticated = !!action.payload.token;
        state.user = action.payload.user;
        state.error = null;
      })
      .addCase(initializeAuth.rejected, (state, action) => {
        state.isInitializing = false;
        state.token = null;
        state.isAuthenticated = false;
        state.user = null;
        state.error = action.payload || 'Initialization failed';
      });
  },
});

export const { clearAuthError, clearAuthToken, setAuthFromToken } = authSlice.actions;
export default authSlice.reducer;