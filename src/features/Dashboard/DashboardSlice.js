import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import ScheduleService from '../../services/ScheduleService.js';

export const fetchBellStatus = createAsyncThunk(
  'dashboard/fetchBellStatus',
  async (_, { signal }) => ScheduleService.getBellStatus(signal)
);

export const fetchSystemTime = createAsyncThunk(
  'dashboard/fetchSystemTime',
  async (_, { signal }) => ScheduleService.getSystemTime(signal)
);

export const togglePanic = createAsyncThunk(
  'dashboard/togglePanic',
  async (enabled) => ScheduleService.setPanic(enabled)
);

const dashboardSlice = createSlice({
  name: 'dashboard',
  initialState: {
    bellState: 'idle',
    panicMode: false,
    dayType: 'off',
    timeSynced: false,
    currentTime: '--:--:--',
    currentDate: '',
    nextBell: null,
    timezone: '',
    error: null,
  },
  reducers: {
    clearError: (state) => { state.error = null; },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchBellStatus.fulfilled, (state, { payload }) => {
        state.error = null;
        state.bellState = payload.bellState;
        state.panicMode = payload.panicMode;
        state.dayType = payload.dayType;
        state.timeSynced = payload.timeSynced;
        state.currentTime = payload.currentTime;
        state.currentDate = payload.currentDate;
        state.nextBell = payload.nextBell;
      })
      .addCase(fetchBellStatus.rejected, (state, { error }) => {
        if (error.name !== 'AbortError') state.error = error.message;
      })
      .addCase(fetchSystemTime.fulfilled, (state, { payload }) => {
        state.currentTime = payload.time;
        state.currentDate = payload.date;
        state.timeSynced = payload.synced;
        state.timezone = payload.timezone;
      })
      .addCase(togglePanic.fulfilled, (state, { payload }) => {
        state.panicMode = payload.panicMode;
        state.bellState = payload.panicMode ? 'panic' : 'idle';
      })
      .addCase(togglePanic.rejected, (state, { error }) => {
        state.error = error.message;
      });
  },
});

export const { clearError } = dashboardSlice.actions;
export default dashboardSlice.reducer;
