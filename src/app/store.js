// src/store.js
import { configureStore } from '@reduxjs/toolkit';
import authReducer from '../features/Auth/AuthSlice'
import wifiConfigReducer from '../features/WiFiConfig/WiFiConfigSlice.js'
import { authMiddleware, tokenValidationMiddleware } from '../middleware/authMiddleware.js';

export const store = configureStore({
  reducer: {
    auth: authReducer,
    wifiConfig: wifiConfigReducer,
  },
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware({
      serializableCheck: {
        // Ignore these action types for serializable check
        ignoredActions: ['persist/PERSIST', 'persist/REHYDRATE'],
      },
    }).concat(authMiddleware, tokenValidationMiddleware),
});