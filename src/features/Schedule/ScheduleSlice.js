import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import ScheduleService from '../../services/ScheduleService.js';

const sortBells = (bells) =>
  [...bells].sort((a, b) => (a.hour * 60 + a.minute) - (b.hour * 60 + b.minute));

let _idSeq = 0;
const assignIds = (bells) => (bells || []).map((b) => ({ ...b, _id: `s-${++_idSeq}` }));
const stripIds  = (bells) => (bells || []).map(({ _id, ...rest }) => rest);
const sortAndStrip = (bells) => sortBells(stripIds(bells));

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
  /** Paginated exception list (metadata only) */
  exceptions: {
    items: [],
    total: 0,
    offset: 0,
    limit: 10,
    hasMore: false,
    loading: false,
    error: null,
  },
  /** Full exception details keyed by id (loaded on expand) */
  exceptionDetail: {},
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
export const saveToday     = createAsyncThunk('schedule/saveToday',     async (payload, { signal }) => {
  const cleaned = payload?.customBells?.bells
    ? { ...payload, customBells: { ...payload.customBells, bells: sortAndStrip(payload.customBells.bells) } }
    : payload;
  return ScheduleService.saveToday(cleaned, signal);
});
export const fetchDefault  = createAsyncThunk('schedule/fetchDefault',  async (_, { signal }) => ScheduleService.getDefault(signal));
export const saveDefault   = createAsyncThunk('schedule/saveDefault',   async (bells, { signal }) => ScheduleService.saveDefault(sortAndStrip(bells), signal));
export const fetchTemplates= createAsyncThunk('schedule/fetchTemplates',async (_, { signal }) => ScheduleService.getTemplates(signal));
export const saveTemplates = createAsyncThunk('schedule/saveTemplates', async (templates, { signal }) => {
  const cleaned = templates.map((tpl) => tpl ? { ...tpl, bells: sortAndStrip(tpl.bells) } : null);
  return ScheduleService.saveTemplates(cleaned, signal);
});
export const fetchExceptions = createAsyncThunk(
  'schedule/fetchExceptions',
  async ({ offset = 0, limit = 10, from, to } = {}, { signal }) =>
    ScheduleService.getExceptions({ offset, limit, from, to }, signal)
);

export const fetchExceptionById = createAsyncThunk(
  'schedule/fetchExceptionById',
  async (id, { signal }) => ScheduleService.getExceptionById(id, signal)
);

export const createException = createAsyncThunk(
  'schedule/createException',
  async (data, { signal }) => ScheduleService.createException(data, signal)
);

export const updateException = createAsyncThunk(
  'schedule/updateException',
  async ({ id, data }, { signal }) => ScheduleService.updateException(id, data, signal)
);

export const deleteException = createAsyncThunk(
  'schedule/deleteException',
  async (id, { signal }) => ScheduleService.deleteException(id, signal)
);
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
    clearExceptionDetail(state, { payload: id }) { delete state.exceptionDetail[id]; },
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
      s.today.bells            = assignIds(sortBells(p?.bells ?? []));
      s.today.dayType          = p?.dayType ?? null;
      s.today.source           = p?.source ?? null;
      s.today.multiDayException= p?.multiDayException ?? false;
    });
    apSave(builder, saveToday, (s, p) => {
      if (p?.bells) {
        s.today.bells            = assignIds(sortBells(p.bells));
        s.today.dayType          = p.dayType ?? s.today.dayType;
        s.today.source           = p.source ?? s.today.source;
        s.today.multiDayException= p.multiDayException ?? false;
      }
    });
    ap(builder, fetchDefault, null, (s, p) => { s.default.bells = assignIds(sortBells(p?.bells ?? [])); });
    apSave(builder, saveDefault, (s, p) => { if (p?.bells) s.default.bells = assignIds(sortBells(p.bells)); });
    ap(builder, fetchTemplates, null, (s, p) => {
      s.templates = (p?.templates ?? [null, null, null]).map((tpl) =>
        tpl ? { ...tpl, bells: assignIds(tpl.bells || []) } : null
      );
      s.builtins  = p?.builtins ?? [];
    });
    apSave(builder, saveTemplates, (s, p) => {
      if (p?.templates) s.templates = p.templates.map((tpl) =>
        tpl ? { ...tpl, bells: assignIds(tpl.bells || []) } : null
      );
      if (p?.builtins)  s.builtins  = p.builtins;
    });
    // Exception list (paginated)
    builder
      .addCase(fetchExceptions.pending,   (s) => { s.exceptions.loading = true;  s.exceptions.error = null; })
      .addCase(fetchExceptions.rejected,  (s, { error }) => { s.exceptions.loading = false; s.exceptions.error = error.message; })
      .addCase(fetchExceptions.fulfilled, (s, { payload: p }) => {
        s.exceptions.loading = false;
        s.exceptions.items   = p?.items   ?? [];
        s.exceptions.total   = p?.total   ?? 0;
        s.exceptions.offset  = p?.offset  ?? 0;
        s.exceptions.limit   = p?.limit   ?? 10;
        s.exceptions.hasMore = p?.hasMore ?? false;
      });

    // Exception detail (fetched on expand)
    builder
      .addCase(fetchExceptionById.fulfilled, (s, { payload: p }) => {
        if (p?.id != null) {
          const bells = p.customBells?.bells ?? [];
          s.exceptionDetail[p.id] = {
            ...p,
            customBells: { bells: assignIds(sortBells(bells)) },
          };
        }
      });

    // Create exception — refresh the list
    builder
      .addCase(createException.pending,   (s) => { s.saving = true;  s.error = null; })
      .addCase(createException.rejected,  (s, { error }) => { s.saving = false; s.error = error.message; })
      .addCase(createException.fulfilled, (s) => { s.saving = false; s.saveSuccess = true; });

    // Update exception
    builder
      .addCase(updateException.pending,   (s) => { s.saving = true;  s.error = null; })
      .addCase(updateException.rejected,  (s, { error }) => { s.saving = false; s.error = error.message; })
      .addCase(updateException.fulfilled, (s, { meta: { arg: { id } } }) => {
        s.saving = false;
        s.saveSuccess = true;
        // Evict cached detail so next expand re-fetches
        delete s.exceptionDetail[id];
      });

    // Delete exception — evict from detail cache, refresh handled by component
    builder
      .addCase(deleteException.pending,   (s) => { s.saving = true;  s.error = null; })
      .addCase(deleteException.rejected,  (s, { error }) => { s.saving = false; s.error = error.message; })
      .addCase(deleteException.fulfilled, (s, { meta: { arg: id } }) => {
        s.saving = false;
        delete s.exceptionDetail[id];
      });
    builder.addCase(fetchDefaults.fulfilled, (s, { payload }) => {
      if (payload?.bells) s.default.bells = assignIds(sortBells(payload.bells));
    });
  },
});

export const {
  clearError, clearSaveSuccess,
  setWorkingDays, setTimezone, setRingDurationSec,
  setTodayBells, setDefaultBells, setTemplates, clearExceptionDetail,
} = scheduleSlice.actions;

export default scheduleSlice.reducer;
