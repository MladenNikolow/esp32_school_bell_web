import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import ScheduleService from '../../services/ScheduleService.js';

export const fetchSystemInfo = createAsyncThunk(
  'settings/fetchSystemInfo',
  async (_, { signal }) => ScheduleService.getSystemInfo(signal)
);

export const testBell = createAsyncThunk(
  'settings/testBell',
  async (durationSec) => ScheduleService.testBell(durationSec)
);

export const rebootDevice = createAsyncThunk(
  'settings/rebootDevice',
  async () => ScheduleService.reboot()
);

export const factoryReset = createAsyncThunk(
  'settings/factoryReset',
  async () => ScheduleService.factoryReset()
);

const settingsSlice = createSlice({
  name: 'settings',
  initialState: {
    systemInfo: null,
    loading: false,
    testingBell: false,
    rebooting: false,
    resetting: false,
    error: null,
    actionSuccess: null,
  },
  reducers: {
    clearError: (state) => { state.error = null; },
    clearActionSuccess: (state) => { state.actionSuccess = null; },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchSystemInfo.pending, (state) => { state.loading = true; })
      .addCase(fetchSystemInfo.fulfilled, (state, { payload }) => {
        state.loading = false;
        state.error = null;
        state.systemInfo = payload;
      })
      .addCase(fetchSystemInfo.rejected, (state, { error }) => {
        state.loading = false;
        if (error.name !== 'AbortError') state.error = error.message;
      })
      .addCase(testBell.pending, (state) => { state.testingBell = true; })
      .addCase(testBell.fulfilled, (state) => {
        state.testingBell = false;
        state.actionSuccess = 'Bell test started';
      })
      .addCase(testBell.rejected, (state, { error }) => {
        state.testingBell = false;
        state.error = error.message;
      })
      .addCase(rebootDevice.pending, (state) => { state.rebooting = true; })
      .addCase(rebootDevice.fulfilled, (state) => {
        state.rebooting = true;
        state.actionSuccess = 'Device is rebooting… You will be redirected to login shortly.';
      })
      .addCase(rebootDevice.rejected, (state, { error }) => {
        state.rebooting = false;
        state.error = error.message;
      })
      .addCase(factoryReset.pending, (state) => { state.resetting = true; })
      .addCase(factoryReset.fulfilled, (state) => {
        state.resetting = false;
        state.actionSuccess = 'Factory defaults restored. Reload the page to see changes.';
      })
      .addCase(factoryReset.rejected, (state, { error }) => {
        state.resetting = false;
        state.error = error.message;
      });
  },
});

export const { clearError, clearActionSuccess } = settingsSlice.actions;
export default settingsSlice.reducer;
