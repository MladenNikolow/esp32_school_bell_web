import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import ScheduleService from '../../services/ScheduleService.js';

/* Hardcoded fallback if the server can't provide /api/schedule/defaults */
const CLIENT_DEFAULTS = {
  firstShift: {
    enabled: true,
    bells: [
      { hour:  8, minute:  0, durationSec: 3, label: "Class 1 start" },
      { hour:  8, minute: 45, durationSec: 3, label: "Class 1 end" },
      { hour:  8, minute: 55, durationSec: 3, label: "Class 2 start" },
      { hour:  9, minute: 40, durationSec: 3, label: "Class 2 end" },
      { hour:  9, minute: 50, durationSec: 3, label: "Class 3 start" },
      { hour: 10, minute: 35, durationSec: 3, label: "Class 3 end" },
      { hour: 11, minute: 10, durationSec: 3, label: "Class 4 start" },
      { hour: 11, minute: 55, durationSec: 3, label: "Class 4 end" },
      { hour: 12, minute:  5, durationSec: 3, label: "Class 5 start" },
      { hour: 12, minute: 50, durationSec: 3, label: "Class 5 end" },
      { hour: 13, minute:  0, durationSec: 3, label: "Class 6 start" },
      { hour: 13, minute: 45, durationSec: 3, label: "Class 6 end" },
    ],
  },
  secondShift: {
    enabled: true,
    bells: [
      { hour: 14, minute:  0, durationSec: 3, label: "Class 7 start" },
      { hour: 14, minute: 45, durationSec: 3, label: "Class 7 end" },
      { hour: 14, minute: 55, durationSec: 3, label: "Class 8 start" },
      { hour: 15, minute: 40, durationSec: 3, label: "Class 8 end" },
    ],
  },
};

export const fetchSettings = createAsyncThunk(
  'schedule/fetchSettings',
  async (_, { signal }) => ScheduleService.getSettings(signal)
);

export const saveSettings = createAsyncThunk(
  'schedule/saveSettings',
  async (data) => {
    await ScheduleService.saveSettings(data);
    return data;
  }
);

export const fetchBells = createAsyncThunk(
  'schedule/fetchBells',
  async (_, { signal }) => ScheduleService.getBells(signal)
);

export const saveBells = createAsyncThunk(
  'schedule/saveBells',
  async ({ firstShift, secondShift }) => {
    await ScheduleService.saveBells(firstShift, secondShift);
    return { firstShift, secondShift };
  }
);

export const fetchDefaults = createAsyncThunk(
  'schedule/fetchDefaults',
  async (_, { signal }) => {
    try {
      return await ScheduleService.getDefaults(signal);
    } catch (err) {
      if (err.name === 'AbortError') throw err;
      console.warn('Server defaults unavailable, using client fallback:', err.message);
      return CLIENT_DEFAULTS;
    }
  }
);

const scheduleSlice = createSlice({
  name: 'schedule',
  initialState: {
    timezone: '',
    workingDays: [1, 2, 3, 4, 5],
    firstShift: { enabled: true, bells: [] },
    secondShift: { enabled: false, bells: [] },
    loading: false,
    saving: false,
    error: null,
    saveSuccess: false,
  },
  reducers: {
    clearError: (state) => { state.error = null; },
    clearSaveSuccess: (state) => { state.saveSuccess = false; },
    setFirstShift: (state, { payload }) => { state.firstShift = payload; },
    setSecondShift: (state, { payload }) => { state.secondShift = payload; },
    setWorkingDays: (state, { payload }) => { state.workingDays = payload; },
    setTimezone: (state, { payload }) => { state.timezone = payload; },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchSettings.pending, (state) => { state.loading = true; })
      .addCase(fetchSettings.fulfilled, (state, { payload }) => {
        state.loading = false;
        state.error = null;
        state.timezone = payload.timezone || '';
        state.workingDays = payload.workingDays || [];
      })
      .addCase(fetchSettings.rejected, (state, { error }) => {
        state.loading = false;
        if (error.name !== 'AbortError') state.error = error.message;
      })
      .addCase(saveSettings.pending, (state) => { state.saving = true; state.saveSuccess = false; })
      .addCase(saveSettings.fulfilled, (state) => {
        state.saving = false;
        state.saveSuccess = true;
      })
      .addCase(saveSettings.rejected, (state, { error }) => {
        state.saving = false;
        state.error = error.message;
      })
      .addCase(fetchBells.pending, (state) => { state.loading = true; })
      .addCase(fetchBells.fulfilled, (state, { payload }) => {
        state.loading = false;
        state.error = null;
        if (payload.firstShift) {
          state.firstShift = {
            enabled: payload.firstShift.enabled !== false,
            bells: payload.firstShift.bells || [],
          };
        }
        if (payload.secondShift) {
          state.secondShift = {
            enabled: payload.secondShift.enabled === true,
            bells: payload.secondShift.bells || [],
          };
        }
      })
      .addCase(fetchBells.rejected, (state, { error }) => {
        state.loading = false;
        if (error.name !== 'AbortError') state.error = error.message;
      })
      .addCase(saveBells.pending, (state) => { state.saving = true; state.saveSuccess = false; })
      .addCase(saveBells.fulfilled, (state) => {
        state.saving = false;
        state.saveSuccess = true;
      })
      .addCase(saveBells.rejected, (state, { error }) => {
        state.saving = false;
        state.error = error.message;
      })
      .addCase(fetchDefaults.fulfilled, (state, { payload }) => {
        if (payload.firstShift) {
          state.firstShift = {
            enabled: payload.firstShift.enabled !== false,
            bells: payload.firstShift.bells || [],
          };
        }
        if (payload.secondShift) {
          state.secondShift = {
            enabled: payload.secondShift.enabled === true,
            bells: payload.secondShift.bells || [],
          };
        }
      })
      .addCase(fetchDefaults.rejected, (state, { error }) => {
        if (error.name !== 'AbortError') state.error = error.message;
      });
  },
});

export const { clearError, clearSaveSuccess, setFirstShift, setSecondShift, setWorkingDays, setTimezone } = scheduleSlice.actions;
export default scheduleSlice.reducer;
