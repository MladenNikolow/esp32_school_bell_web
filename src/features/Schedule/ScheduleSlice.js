import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import ScheduleService from '../../services/ScheduleService.js';

const sortBells = (bells) =>
  [...bells].sort((a, b) => (a.hour * 60 + a.minute) - (b.hour * 60 + b.minute));

const CLIENT_DEFAULTS = {
  bells: [
    { hour:  8, minute:  0, label: 'Час 1 начало' },
    { hour:  8, minute: 45, label: 'Час 1 край'   },
    { hour:  8, minute: 55, label: 'Час 2 начало' },
    { hour:  9, minute: 40, label: 'Час 2 край'   },
    { hour:  9, minute: 50, label: 'Час 3 начало' },
    { hour: 10, minute: 35, label: 'Час 3 край'   },
    { hour: 11, minute: 10, label: 'Час 4 начало' },
    { hour: 11, minute: 55, label: 'Час 4 край'   },
    { hour: 12, minute:  5, label: 'Час 5 начало' },
    { hour: 12, minute: 50, label: 'Час 5 край'   },
    { hour: 13, minute:  0, label: 'Час 6 начало' },
    { hour: 13, minute: 45, label: 'Час 6 край'   },
  ],
};

const initialState = {
  today: { bells: [], dayType: null, source: null, multiDayException: false },
  default: { bells: [] },
  templates: [null, null, null],
  builtins: [],
  exceptions: [],
  timezone: '',
  workingDays: [1, 2, 3, 4, 5],
  ringDurationSec: 3,
  loading: false,
  saving: false,
  error: null,
  saveSuccess: false,
};

export const fetchSettings = createAsyncThunk('schedule/fetchSettings', async (_, { signal }) => ScheduleService.getSettings(signal));
export const saveSettings  = createAsyncThunk('schedule/saveSettings',  async (payload, { signal }) => ScheduleService.saveSettings(payload, signal));
export const fetchToday    = createAsyncThunk('schedule/fetchToday',    async (_, { signal }) => ScheduleService.getToday(signal));
export const saveToday     = createAsyncThunk('schedule/saveToday',     async (bells, { signal }) => ScheduleService.saveToday(bells, signal));
export const fetchDefault  = createAsyncThunk('schedule/fetchDefault',  async (_, { signal }) => ScheduleService.getDefault(signal));
export const saveDefault   = createAsyncThunk('schedule/saveDefault',   async (bells, { signal }) => ScheduleService.saveDefault(bells, signal));
export const fetchTemplates= createAsyncThunk('schedule/fetchTemplates',async (_, { signal }) => ScheduleService.getTemplates(signal));
export const saveTemplates = createAsyncThunk('schedule/saveTemplates', async (templates, { signal }) => ScheduleService.saveTemplates(templates, signal));
export const fetchExceptions=createAsyncThunk('schedule/fetchExceptions',async (_, { signal }) => ScheduleService.getExceptions(signal));
export const saveExceptions= createAsyncThunk('schedule/saveExceptions',async (exceptions, { signal }) => ScheduleService.saveExceptions(exceptions, signal));
export const fetchDefaults = createAsyncThunk('schedule/fetchDefaults', async (_, { signal }) => {
  try { return await ScheduleService.getDefaults(signal); } catch { return CLIENT_DEFAULTS; }
});

const ap = (builder, thunk, field, mapFulfilled) => {
  builder
    .addCase(thunk.pending,   (s) => { s.loading = true;  s.error = null; })
    .addCase(thunk.fulfilled, (s, { payload }) => { s.loading = false; mapFulfilled && mapFulfilled(s, payload); })
    .addCase(thunk.rejected,  (s, { error }) => { s.loading = false; s.error = error.message; });
};
const apSave = (builder, thunk, mapFulfilled) => {
  builder
    .addCase(thunk.pending,   (s) => { s.saving = true;  s.error = null; })
    .addCase(thunk.fulfilled, (s, { payload }) => { s.saving = false; s.saveSuccess = true; mapFulfilled && mapFulfilled(s, payload); })
    .addCase(thunk.rejected,  (s, { error }) => { s.saving = false; s.error = error.message; });
};

const scheduleSlice = createSlice({
  name: 'schedule',
  initialState,
  reducers: {
    clearError(state)      { state.error = null; },
    clearSaveSuccess(state){ state.saveSuccess = false; },
    setWorkingDays(state, { payload }) { state.workingDays = payload; },
    setTimezone(state, { payload })    { state.timezone = payload; },
    setRingDurationSec(state, { payload }) {
      const v = parseInt(payload, 10);
      state.ringDurationSec = Number.isFinite(v) ? Math.min(300, Math.max(1, v)) : 1;
    },
    setTodayBells(state, { payload })   { state.today.bells = payload; },
    setDefaultBells(state, { payload }) { state.default.bells = payload; },
    setTemplates(state, { payload })    { state.templates = payload; },
    setExceptions(state, { payload })   { state.exceptions = payload; },
  },
  extraReducers: (builder) => {
    ap(builder, fetchSettings, null, (s, p) => {
      if (p?.timezone !== undefined) s.timezone = p.timezone;
      if (p?.workingDays !== undefined) s.workingDays = p.workingDays;
      if (p?.ringDurationSec !== undefined) s.ringDurationSec = p.ringDurationSec;
    });
    apSave(builder, saveSettings, (s, p) => {
      if (p?.timezone !== undefined) s.timezone = p.timezone;
      if (p?.workingDays !== undefined) s.workingDays = p.workingDays;
      if (p?.ringDurationSec !== undefined) s.ringDurationSec = p.ringDurationSec;
    });
    ap(builder, fetchToday, null, (s, p) => {
      s.today.bells            = sortBells(p?.bells ?? []);
      s.today.dayType          = p?.dayType ?? null;
      s.today.source           = p?.source ?? null;
      s.today.multiDayException= p?.multiDayException ?? false;
    });
    apSave(builder, saveToday, (s, p) => { if (p?.bells) s.today.bells = sortBells(p.bells); });
    ap(builder, fetchDefault, null, (s, p) => { s.default.bells = sortBells(p?.bells ?? []); });
    apSave(builder, saveDefault, (s, p) => { if (p?.bells) s.default.bells = sortBells(p.bells); });
    ap(builder, fetchTemplates, null, (s, p) => {
      s.templates = p?.templates ?? [null, null, null];
      s.builtins  = p?.builtins ?? [];
    });
    apSave(builder, saveTemplates, (s, p) => {
      if (p?.templates) s.templates = p.templates;
      if (p?.builtins)  s.builtins  = p.builtins;
    });
    ap(builder, fetchExceptions, null, (s, p) => { s.exceptions = p?.exceptions ?? []; });
    apSave(builder, saveExceptions, (s, p) => { if (p?.exceptions) s.exceptions = p.exceptions; });
    builder.addCase(fetchDefaults.fulfilled, (s, { payload }) => {
      if (payload?.bells) s.default.bells = sortBells(payload.bells);
    });
  },
});

export const {
  clearError, clearSaveSuccess,
  setWorkingDays, setTimezone, setRingDurationSec,
  setTodayBells, setDefaultBells, setTemplates, setExceptions,
} = scheduleSlice.actions;

export default scheduleSlice.reducer;
