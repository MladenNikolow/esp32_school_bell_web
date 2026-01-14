// src/store.js
import { configureStore } from '@reduxjs/toolkit';
import modeReducer from '../features/App/AppSlice'

export const store = configureStore({
  reducer: {
    mode: modeReducer,
  },
});