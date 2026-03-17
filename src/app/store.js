// src/store.js
import { configureStore } from '@reduxjs/toolkit';
import modeReducer from '../features/App/AppSlice'
import authReducer from '../features/Auth/AuthSlice'
import wifiConfigReducer from '../features/WiFiConfig/WiFiConfigSlice.js'
import dashboardReducer from '../features/Dashboard/DashboardSlice.js'
import scheduleReducer from '../features/Schedule/ScheduleSlice.js'
import calendarReducer from '../features/Calendar/CalendarSlice.js'
import settingsReducer from '../features/Settings/SettingsSlice.js'
import { authMiddleware, tokenValidationMiddleware } from '../middleware/authMiddleware.js';

export const store = configureStore({
  reducer: {
    mode: modeReducer,
    auth: authReducer,
    wifiConfig: wifiConfigReducer,
    dashboard: dashboardReducer,
    schedule: scheduleReducer,
    calendar: calendarReducer,
    settings: settingsReducer,
  },
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware({
      serializableCheck: {
        // Ignore these action types for serializable check
        ignoredActions: ['persist/PERSIST', 'persist/REHYDRATE'],
      },
    }).concat(authMiddleware, tokenValidationMiddleware),
});