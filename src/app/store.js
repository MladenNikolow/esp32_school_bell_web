// src/store.js
import { configureStore, combineReducers } from '@reduxjs/toolkit';
import modeReducer from '../features/App/AppSlice'
import authReducer from '../features/Auth/AuthSlice'
import dashboardReducer from '../features/Dashboard/DashboardSlice.js'
import scheduleReducer from '../features/Schedule/ScheduleSlice.js'
import settingsReducer from '../features/Settings/SettingsSlice.js'
import { authMiddleware, tokenValidationMiddleware } from '../middleware/authMiddleware.js';

const appReducer = combineReducers({
  mode: modeReducer,
  auth: authReducer,
  dashboard: dashboardReducer,
  schedule: scheduleReducer,
  settings: settingsReducer,
});

/*
 * Actions that change the authenticated identity. When any of these fire we
 * wipe the user-scoped data slices (settings, schedule, dashboard) so that
 * role-scoped, cached data from a previous session can never leak into the
 * next one. Without this, the settings slice keeps a cached
 * `clientCredentials` value (guarded by a 60s refetch condition), so an admin
 * who logs back in shortly after an account was created/claimed would still
 * see the stale "no client account" state.
 *
 * `auth` and `mode` are preserved so the triggering action (e.g. login) is
 * still processed normally by their reducers; the other slices reinitialise
 * from `undefined` and refetch on demand.
 */
const IDENTITY_CHANGE_ACTIONS = new Set([
  'auth/loginUser/fulfilled',
  'auth/claimAccount/fulfilled',
  'auth/logoutUser/fulfilled',
  'auth/logoutUser/rejected',
  'auth/clearAuthToken',
]);

const rootReducer = (state, action) => {
  if (state && IDENTITY_CHANGE_ACTIONS.has(action.type)) {
    state = { mode: state.mode, auth: state.auth };
  }
  return appReducer(state, action);
};

export const store = configureStore({
  reducer: rootReducer,
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware({
      serializableCheck: {
        // Ignore these action types for serializable check
        ignoredActions: ['persist/PERSIST', 'persist/REHYDRATE'],
      },
    }).concat(authMiddleware, tokenValidationMiddleware),
});
