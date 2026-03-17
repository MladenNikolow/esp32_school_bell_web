import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import ScheduleService from '../../services/ScheduleService.js';

export const fetchHolidays = createAsyncThunk(
  'calendar/fetchHolidays',
  async (_, { signal }) => ScheduleService.getHolidays(signal)
);

export const saveHolidays = createAsyncThunk(
  'calendar/saveHolidays',
  async (holidays) => {
    await ScheduleService.saveHolidays(holidays);
    return holidays;
  }
);

export const fetchExceptions = createAsyncThunk(
  'calendar/fetchExceptions',
  async (_, { signal }) => ScheduleService.getExceptions(signal)
);

export const saveExceptions = createAsyncThunk(
  'calendar/saveExceptions',
  async (data) => {
    await ScheduleService.saveExceptions(data);
    return data;
  }
);

const calendarSlice = createSlice({
  name: 'calendar',
  initialState: {
    holidays: [],
    exceptionWorking: [],
    exceptionHoliday: [],
    loading: false,
    saving: false,
    error: null,
    saveSuccess: false,
  },
  reducers: {
    clearError: (state) => { state.error = null; },
    clearSaveSuccess: (state) => { state.saveSuccess = false; },
    setHolidays: (state, { payload }) => { state.holidays = payload; },
    setExceptionWorking: (state, { payload }) => { state.exceptionWorking = payload; },
    setExceptionHoliday: (state, { payload }) => { state.exceptionHoliday = payload; },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchHolidays.pending, (state) => { state.loading = true; })
      .addCase(fetchHolidays.fulfilled, (state, { payload }) => {
        state.loading = false;
        state.error = null;
        state.holidays = payload.holidays || [];
      })
      .addCase(fetchHolidays.rejected, (state, { error }) => {
        state.loading = false;
        if (error.name !== 'AbortError') state.error = error.message;
      })
      .addCase(saveHolidays.pending, (state) => { state.saving = true; state.saveSuccess = false; })
      .addCase(saveHolidays.fulfilled, (state) => {
        state.saving = false;
        state.saveSuccess = true;
      })
      .addCase(saveHolidays.rejected, (state, { error }) => {
        state.saving = false;
        state.error = error.message;
      })
      .addCase(fetchExceptions.pending, (state) => { state.loading = true; })
      .addCase(fetchExceptions.fulfilled, (state, { payload }) => {
        state.loading = false;
        state.error = null;
        state.exceptionWorking = payload.exceptionWorking || [];
        state.exceptionHoliday = payload.exceptionHoliday || [];
      })
      .addCase(fetchExceptions.rejected, (state, { error }) => {
        state.loading = false;
        if (error.name !== 'AbortError') state.error = error.message;
      })
      .addCase(saveExceptions.pending, (state) => { state.saving = true; state.saveSuccess = false; })
      .addCase(saveExceptions.fulfilled, (state) => {
        state.saving = false;
        state.saveSuccess = true;
      })
      .addCase(saveExceptions.rejected, (state, { error }) => {
        state.saving = false;
        state.error = error.message;
      });
  },
});

export const { clearError, clearSaveSuccess, setHolidays, setExceptionWorking, setExceptionHoliday } = calendarSlice.actions;
export default calendarSlice.reducer;
