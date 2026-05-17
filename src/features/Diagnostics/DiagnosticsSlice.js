import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import DiagnosticsService from '../../services/DiagnosticsService.js';

const initialState = {
  health: null,        // null until first fetch; see DiagnosticsService for shape
  events: [],          // newest-first display order (we reverse the server's oldest-first array)
  bootId: 0,
  uptimeSec: 0,
  loading: false,
  refreshing: false,   // background refresh (don't hide UI)
  clearing: false,
  error: null,
  clearError: null,
  lastFetchAt: 0,
};

export const fetchDiagnostics = createAsyncThunk(
  'diagnostics/fetch',
  async (_, { signal }) => DiagnosticsService.get(signal),
);

export const clearDiagnostics = createAsyncThunk(
  'diagnostics/clear',
  async (_, { signal, rejectWithValue }) => {
    try {
      await DiagnosticsService.clear(signal);
      return await DiagnosticsService.get(signal);
    } catch (e) {
      return rejectWithValue({
        message: e?.message || 'Clear failed',
        status: e?.status,
      });
    }
  },
);

const diagnosticsSlice = createSlice({
  name: 'diagnostics',
  initialState,
  reducers: {
    clearErrors: (s) => { s.error = null; s.clearError = null; },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchDiagnostics.pending, (s) => {
        if (s.health) s.refreshing = true; else s.loading = true;
        s.error = null;
      })
      .addCase(fetchDiagnostics.fulfilled, (s, a) => {
        s.loading = false;
        s.refreshing = false;
        s.health = a.payload?.health || null;
        // server returns oldest-first; show newest first in UI
        const evs = Array.isArray(a.payload?.events) ? [...a.payload.events] : [];
        s.events = evs.reverse();
        s.bootId = a.payload?.bootId || 0;
        s.uptimeSec = a.payload?.uptimeSec || 0;
        s.lastFetchAt = Date.now();
      })
      .addCase(fetchDiagnostics.rejected, (s, a) => {
        s.loading = false;
        s.refreshing = false;
        s.error = a.error?.message || 'Failed to load diagnostics';
      })

      .addCase(clearDiagnostics.pending, (s) => {
        s.clearing = true;
        s.clearError = null;
      })
      .addCase(clearDiagnostics.fulfilled, (s, a) => {
        s.clearing = false;
        s.health = a.payload?.health || s.health;
        const evs = Array.isArray(a.payload?.events) ? [...a.payload.events] : [];
        s.events = evs.reverse();
        s.bootId = a.payload?.bootId || s.bootId;
        s.uptimeSec = a.payload?.uptimeSec || s.uptimeSec;
        s.lastFetchAt = Date.now();
      })
      .addCase(clearDiagnostics.rejected, (s, a) => {
        s.clearing = false;
        s.clearError = a.payload?.message || a.error?.message || 'Clear failed';
      });
  },
});

export const { clearErrors } = diagnosticsSlice.actions;
export default diagnosticsSlice.reducer;
