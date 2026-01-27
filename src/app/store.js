// src/store.js
import { configureStore } from '@reduxjs/toolkit';
import modeReducer from '../features/App/AppSlice'
import authReducer from '../features/Auth/AuthSlice'
import { authMiddleware, tokenValidationMiddleware } from '../middleware/authMiddleware.js';

export const store = configureStore({
  reducer: {
    mode: modeReducer,
    auth: authReducer,
  },
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware({
      serializableCheck: {
        // Ignore these action types for serializable check
        ignoredActions: ['persist/PERSIST', 'persist/REHYDRATE'],
      },
    }).concat(authMiddleware, tokenValidationMiddleware),
});