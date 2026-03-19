import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import ScheduleService from '../../services/ScheduleService.js';

/* Hardcoded fallback if the server can't provide /api/schedule/defaults */
const CLIENT_DEFAULTS = {
  firstShift: {
    enabled: true,
    bells: [
      { hour:  8, minute:  0, durationSec: 3, label: "Час 1 начало" },
      { hour:  8, minute: 45, durationSec: 3, label: "Час 1 край" },
      { hour:  8, minute: 55, durationSec: 3, label: "Час 2 начало" },
      { hour:  9, minute: 40, durationSec: 3, label: "Час 2 край" },
      { hour:  9, minute: 50, durationSec: 3, label: "Час 3 начало" },
      { hour: 10, minute: 35, durationSec: 3, label: "Час 3 край" },
      { hour: 11, minute: 10, durationSec: 3, label: "Час 4 начало" },
      { hour: 11, minute: 55, durationSec: 3, label: "Час 4 край" },
      { hour: 12, minute:  5, durationSec: 3, label: "Час 5 начало" },
      { hour: 12, minute: 50, durationSec: 3, label: "Час 5 край" },
      { hour: 13, minute:  0, durationSec: 3, label: "Час 6 начало" },
      { hour: 13, minute: 45, durationSec: 3, label: "Час 6 край" },
    ],
  },
  secondShift: {
    enabled: true,
    bells: [
      { hour: 14, minute:  0, durationSec: 3, label: "Час 7 начало" },
      { hour: 14, minute: 45, durationSec: 3, label: "Час 7 край" },
      { hour: 14, minute: 55, durationSec: 3, label: "Час 8 начало" },
      { hour: 15, minute: 40, durationSec: 3, label: "Час 8 край" },
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
