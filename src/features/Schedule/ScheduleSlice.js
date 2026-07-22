import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import ScheduleService from '../../services/ScheduleService.js';

const TEMPLATE_COUNT = 5;

const sortBells = (bells) =>
  [...bells].sort((a, b) => (a.hour * 60 + a.minute) - (b.hour * 60 + b.minute));

let _idSeq = 0;
const assignIds = (bells) => (bells || []).map((b) => ({ ...b, _id: `s-${++_idSeq}` }));
const stripIds  = (bells) => (bells || []).map(({ _id, ...rest }) => rest);
const sortAndStrip = (bells) => sortBells(stripIds(bells));

export const CLIENT_DEFAULTS = {
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

/** Heuristic used by the Week tab's first-run guidance card: true when the
 *  default schedule still matches the factory bell set exactly. */
export function isFactoryDefaultBells(bells) {
  const list = bells || [];
  if (list.length !== CLIENT_DEFAULTS.bells.length) return false;
  return list.every((b, i) => {
    const ref = CLIENT_DEFAULTS.bells[i];
    return b.hour === ref.hour && b.minute === ref.minute && (b.label || '') === ref.label;
  });
}

const initialState = {
  today: { bells: [], dayType: null, exception: null, planIdx: null, planName: null },
  default: { bells: [] },
  templates: Array.from({ length: TEMPLATE_COUNT }, () => null),
  builtins: [],
  weekdayPlans: [-1, -1, -1, -1, -1, -1, -1],
  /** Per-weekday inline custom bell sets (used when weekdayPlans[d] === -2). */
  weekdayCustom: Array.from({ length: 7 }, () => ({ bells: [] })),
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
  // Generic saving/error/success -used by saveSettings only.
  saving: false,
  error: null,
  saveSuccess: false,
  // Per-area save status -avoids one tab's spinner/error bleeding into another.
  savingToday: false,     errorToday: null,     saveSuccessToday: false,
  savingDefault: false,   errorDefault: null,   saveSuccessDefault: false,
  savingTemplates: false, errorTemplates: null, saveSuccessTemplates: false,
  savingWeek: false,      errorWeek: null,      saveSuccessWeek: false,
  savingExceptions: false, errorExceptions: null, saveSuccessExceptions: false,
  loadedAt: { settings: 0, today: 0, default: 0, templates: 0, exceptions: 0, week: 0 },
};

export const fetchSettings = createAsyncThunk('schedule/fetchSettings', async (_, { signal }) => ScheduleService.getSettings(signal));
export const saveSettings  = createAsyncThunk('schedule/saveSettings',  async (payload, { signal }) => ScheduleService.saveSettings(payload, signal));
export const fetchToday = createAsyncThunk(
  'schedule/fetchToday',
  async (_, { signal }) => ScheduleService.getToday({ signal, priority: 'visible' }),
  { condition: (_, { getState }) => Date.now() - getState().schedule.loadedAt.today >= 10000 },
);
export const saveToday = createAsyncThunk('schedule/saveToday', async (payload, { signal }) => {
  const cleaned = payload?.customBells?.bells
    ? { ...payload, customBells: { ...payload.customBells, bells: sortAndStrip(payload.customBells.bells) } }
    : payload;
  return ScheduleService.saveToday(cleaned, signal);
});
export const cancelToday = createAsyncThunk(
  'schedule/cancelToday',
  async (_, { signal }) => ScheduleService.cancelToday(signal),
);
export const fetchDefault = createAsyncThunk(
  'schedule/fetchDefault',
  async (_, { signal }) => ScheduleService.getDefault({ signal, priority: 'visible' }),
  { condition: (_, { getState }) => Date.now() - getState().schedule.loadedAt.default >= 60000 },
);
export const saveDefault   = createAsyncThunk('schedule/saveDefault',   async (bells, { signal }) => ScheduleService.saveDefault(sortAndStrip(bells), signal));
export const fetchTemplates = createAsyncThunk(
  'schedule/fetchTemplates',
  async (_, { signal }) => ScheduleService.getTemplates({ signal, priority: 'supporting' }),
  { condition: (_, { getState }) => Date.now() - getState().schedule.loadedAt.templates >= 60000 },
);
export const saveTemplates = createAsyncThunk('schedule/saveTemplates', async (templates, { signal }) => {
  const cleaned = templates.map((tpl) => tpl ? { ...tpl, bells: sortAndStrip(tpl.bells) } : null);
  return ScheduleService.saveTemplates(cleaned, signal);
});
export const fetchWeek = createAsyncThunk(
  'schedule/fetchWeek',
  async (_, { signal }) => ScheduleService.getWeek({ signal, priority: 'supporting' }),
  { condition: (_, { getState }) => Date.now() - getState().schedule.loadedAt.week >= 60000 },
);
export const saveWeek = createAsyncThunk('schedule/saveWeek', async (payload, { signal }) => ScheduleService.saveWeek(payload, signal));

/** Save one weekday atomically (default / template / custom). Payload:
 *  { day: 0..6, action: 'default'|'template'|'custom', templateIdx?, customBells? } */
export const saveWeekday = createAsyncThunk('schedule/saveWeekday', async (payload, { signal }) => {
  const cleaned = payload?.customBells?.bells
    ? { ...payload, customBells: { ...payload.customBells, bells: sortAndStrip(payload.customBells.bells) } }
    : payload;
  await ScheduleService.saveWeekday(cleaned, signal);
  return cleaned;
});

/** Persist the week map: write each Custom day's bells first (so bulk -2 is
 *  valid), then one bulk /week save for the full plan map.
 *  Avoids 7 flash writes and reduces partial-save windows. */
export const saveWeekFull = createAsyncThunk(
  'schedule/saveWeekFull',
  async ({ weekdayPlans, weekdayCustom }, { signal }) => {
    const plans = weekdayPlans || [];
    for (let day = 0; day < 7; day++) {
      if ((plans[day] ?? -1) !== -2) continue;
      const bells = weekdayCustom?.[day]?.bells || [];
      if (!bells.length) {
        throw new Error('Custom weekday requires at least one bell');
      }
      await ScheduleService.saveWeekday({
        day,
        action: 'custom',
        customBells: { bells: sortAndStrip(bells) },
      }, signal);
    }
    await ScheduleService.saveWeek({ weekdayPlans: plans }, signal);
    return { weekdayPlans: plans, weekdayCustom };
  },
);

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
export const deleteAllExceptions = createAsyncThunk(
  'schedule/deleteAllExceptions',
  async (_, { signal }) => ScheduleService.deleteAllExceptions(signal)
);
export const fetchDefaults = createAsyncThunk('schedule/fetchDefaults', async (_, { signal }) => {
  try { return await ScheduleService.getDefaults(signal); } catch { return CLIENT_DEFAULTS; }
});

const ap = (builder, thunk, mapFulfilled) => {
  builder
    .addCase(thunk.pending,   (s) => { s.loading = true;  s.error = null; })
    .addCase(thunk.fulfilled, (s, action) => { s.loading = false; mapFulfilled && mapFulfilled(s, action); })
    .addCase(thunk.rejected,  (s, { error }) => { s.loading = false; s.error = error.message; });
};

/** Per-area save lifecycle. `savingKey`/`errorKey`/`successKey` are the state
 *  field names (e.g. 'savingToday'); `mapFulfilled(state, action)` may apply
 *  the *sent* payload (action.meta.arg) to local state and/or invalidate a
 *  loadedAt cache entry so the next fetch re-syncs authoritative data. */
const apSave = (builder, thunk, savingKey, errorKey, successKey, mapFulfilled) => {
  builder
    .addCase(thunk.pending,   (s) => { s[savingKey] = true;  s[errorKey] = null; })
    .addCase(thunk.fulfilled, (s, action) => { s[savingKey] = false; s[successKey] = true; mapFulfilled && mapFulfilled(s, action); })
    .addCase(thunk.rejected,  (s, { error }) => { s[savingKey] = false; s[errorKey] = error.message; });
};

const scheduleSlice = createSlice({
  name: 'schedule',
  initialState,
  reducers: {
    clearError(state)      { state.error = null; },
    clearSaveSuccess(state){ state.saveSuccess = false; },
    clearErrorToday(state)      { state.errorToday = null; },
    clearSaveSuccessToday(state){ state.saveSuccessToday = false; },
    clearErrorDefault(state)      { state.errorDefault = null; },
    clearSaveSuccessDefault(state){ state.saveSuccessDefault = false; },
    clearErrorTemplates(state)      { state.errorTemplates = null; },
    clearSaveSuccessTemplates(state){ state.saveSuccessTemplates = false; },
    clearErrorWeek(state)      { state.errorWeek = null; },
    clearSaveSuccessWeek(state){ state.saveSuccessWeek = false; },
    clearErrorExceptions(state)      { state.errorExceptions = null; },
    clearSaveSuccessExceptions(state){ state.saveSuccessExceptions = false; },
    /** Clear all schedule tab banners (errors + success). Used on subtab change. */
    clearAllScheduleBanners(state) {
      state.error = null;
      state.saveSuccess = false;
      state.errorToday = null;
      state.saveSuccessToday = false;
      state.errorDefault = null;
      state.saveSuccessDefault = false;
      state.errorTemplates = null;
      state.saveSuccessTemplates = false;
      state.errorWeek = null;
      state.saveSuccessWeek = false;
      state.errorExceptions = null;
      state.saveSuccessExceptions = false;
    },
    setWorkingDays(state, { payload }) { state.workingDays = payload; },
    setTimezone(state, { payload })    { state.timezone = payload; },
    setRingDurationSec(state, { payload }) {
      const v = parseInt(payload, 10);
      state.ringDurationSec = Number.isFinite(v) ? Math.min(30, Math.max(1, v)) : 1;
    },
    setTodayBells(state, { payload })   { state.today.bells = payload; },
    setDefaultBells(state, { payload }) { state.default.bells = payload; },
    setTemplates(state, { payload })    { state.templates = payload; },
    setWeekdayPlans(state, { payload }) { state.weekdayPlans = payload; },
    setWeekdayCustom(state, { payload }) { state.weekdayCustom = payload; },
    clearExceptionDetail(state, { payload: id }) { delete state.exceptionDetail[id]; },
    hydrateSettings(state, { payload }) {
      if (payload?.timezone !== undefined) state.timezone = payload.timezone;
      if (payload?.workingDays !== undefined) state.workingDays = payload.workingDays;
      if (payload?.ringDurationSec !== undefined) state.ringDurationSec = payload.ringDurationSec;
      state.loadedAt.settings = Date.now();
    },
  },
  extraReducers: (builder) => {
    ap(builder, fetchSettings, (s, { payload: p }) => {
      if (p?.timezone !== undefined) s.timezone = p.timezone;
      if (p?.workingDays !== undefined) s.workingDays = p.workingDays;
      if (p?.ringDurationSec !== undefined) s.ringDurationSec = p.ringDurationSec;
    });
    apSave(builder, saveSettings, 'saving', 'error', 'saveSuccess', (s, { payload: p }) => {
      if (p?.timezone !== undefined) s.timezone = p.timezone;
      if (p?.workingDays !== undefined) s.workingDays = p.workingDays;
      if (p?.ringDurationSec !== undefined) s.ringDurationSec = p.ringDurationSec;
    });

    // ── Today ──────────────────────────────────────────────────────────
    ap(builder, fetchToday, (s, { payload: p }) => {
      s.loadedAt.today = Date.now();
      s.today.bells    = assignIds(sortBells(p?.bells ?? []));
      s.today.dayType  = p?.dayType ?? null;
      s.today.exception= p?.exception ?? null;
      s.today.planIdx  = p?.planIdx ?? null;
      s.today.planName = p?.planName ?? null;
    });
    apSave(builder, saveToday, 'savingToday', 'errorToday', 'saveSuccessToday', (s, { meta }) => {
      // The API only returns { status: "ok" } -apply what we sent so the UI
      // doesn't flash back to stale bells, then invalidate the cache so the
      // next fetchToday() re-syncs authoritative dayType/plan/exception info.
      const sent = meta.arg;
      if (sent?.action === 'custom' && sent.customBells?.bells) {
        s.today.bells = assignIds(sortBells(sent.customBells.bells));
      } else if (sent?.action === 'dayOff') {
        s.today.bells = [];
      }
      s.loadedAt.today = 0;
    });
    apSave(builder, cancelToday, 'savingToday', 'errorToday', 'saveSuccessToday', (s) => {
      s.loadedAt.today = 0;
    });

    // ── Default plan ─────────────────────────────────────────────────
    ap(builder, fetchDefault, (s, { payload: p }) => {
      s.default.bells = assignIds(sortBells(p?.bells ?? []));
      s.loadedAt.default = Date.now();
    });
    apSave(builder, saveDefault, 'savingDefault', 'errorDefault', 'saveSuccessDefault', (s, { meta }) => {
      s.default.bells = assignIds(sortBells(meta.arg ?? []));
      s.loadedAt.default = 0;
    });

    // ── Day-plan templates (5 slots) ─────────────────────────────────
    ap(builder, fetchTemplates, (s, { payload: p }) => {
      s.loadedAt.templates = Date.now();
      s.templates = (p?.templates ?? Array.from({ length: TEMPLATE_COUNT }, () => null)).map((tpl) =>
        tpl ? { ...tpl, bells: assignIds(tpl.bells || []) } : null
      );
      s.builtins  = p?.builtins ?? [];
    });
    apSave(builder, saveTemplates, 'savingTemplates', 'errorTemplates', 'saveSuccessTemplates', (s, { meta }) => {
      s.templates = (meta.arg ?? []).map((tpl) =>
        tpl ? { ...tpl, bells: assignIds(sortBells(tpl.bells || [])) } : null
      );
      s.loadedAt.templates = 0;
    });

    // ── Week map ──────────────────────────────────────────────────────
    ap(builder, fetchWeek, (s, { payload: p }) => {
      s.loadedAt.week = Date.now();
      s.weekdayPlans = p?.weekdayPlans ?? [-1, -1, -1, -1, -1, -1, -1];
      // API returns weekdayCustom as 7 raw bell arrays: [[{hour,minute,label},...], ...]
      const raw = Array.isArray(p?.weekdayCustom) ? p.weekdayCustom : [];
      s.weekdayCustom = Array.from({ length: 7 }, (_, i) => {
        const entry = raw[i];
        const bells = Array.isArray(entry)
          ? entry
          : (entry?.bells ?? []);
        return { bells: assignIds(sortBells(bells)) };
      });
      if (p?.workingDays !== undefined) s.workingDays = p.workingDays;
    });
    apSave(builder, saveWeek, 'savingWeek', 'errorWeek', 'saveSuccessWeek', (s, { meta }) => {
      const sent = meta.arg;
      if (sent?.weekdayPlans) s.weekdayPlans = sent.weekdayPlans;
      if (sent?.workingDays !== undefined) s.workingDays = sent.workingDays;
      s.loadedAt.week = 0;
    });
    apSave(builder, saveWeekday, 'savingWeek', 'errorWeek', 'saveSuccessWeek', (s, { meta }) => {
      const sent = meta.arg;
      if (sent?.day == null) return;
      const day = sent.day;
      if (sent.action === 'custom') {
        s.weekdayPlans[day] = -2;
        s.weekdayCustom[day] = {
          bells: assignIds(sortBells(sent.customBells?.bells ?? [])),
        };
      } else if (sent.action === 'template') {
        s.weekdayPlans[day] = sent.templateIdx;
      } else {
        s.weekdayPlans[day] = -1;
      }
      s.loadedAt.week = 0;
    });
    apSave(builder, saveWeekFull, 'savingWeek', 'errorWeek', 'saveSuccessWeek', (s, { meta }) => {
      const sent = meta.arg;
      if (sent?.weekdayPlans) s.weekdayPlans = sent.weekdayPlans;
      if (sent?.weekdayCustom) {
        s.weekdayCustom = Array.from({ length: 7 }, (_, i) => ({
          bells: assignIds(sortBells(sent.weekdayCustom[i]?.bells ?? [])),
        }));
      }
      s.loadedAt.week = 0;
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

    // Create exception -refresh the list
    apSave(builder, createException, 'savingExceptions', 'errorExceptions', 'saveSuccessExceptions');

    // Update exception
    apSave(builder, updateException, 'savingExceptions', 'errorExceptions', 'saveSuccessExceptions', (s, { meta: { arg: { id } } }) => {
      // Evict cached detail so next expand re-fetches
      delete s.exceptionDetail[id];
    });

    // Delete exception -evict from detail cache, refresh handled by component
    apSave(builder, deleteException, 'savingExceptions', 'errorExceptions', 'saveSuccessExceptions', (s, { meta: { arg: id } }) => {
      delete s.exceptionDetail[id];
    });

    // Delete-all -wipe list + detail cache immediately
    builder
      .addCase(deleteAllExceptions.pending,   (s) => { s.savingExceptions = true;  s.errorExceptions = null; })
      .addCase(deleteAllExceptions.rejected,  (s, { error }) => { s.savingExceptions = false; s.errorExceptions = error.message; })
      .addCase(deleteAllExceptions.fulfilled, (s) => {
        s.savingExceptions = false;
        s.exceptions.items   = [];
        s.exceptions.total   = 0;
        s.exceptions.offset  = 0;
        s.exceptions.hasMore = false;
        s.exceptionDetail    = {};
        s.saveSuccessExceptions = true;
      });
    builder.addCase(fetchDefaults.fulfilled, (s, { payload }) => {
      if (payload?.bells) s.default.bells = assignIds(sortBells(payload.bells));
    });
  },
});

export const {
  clearError, clearSaveSuccess,
  clearErrorToday, clearSaveSuccessToday,
  clearErrorDefault, clearSaveSuccessDefault,
  clearErrorTemplates, clearSaveSuccessTemplates,
  clearErrorWeek, clearSaveSuccessWeek,
  clearErrorExceptions, clearSaveSuccessExceptions,
  clearAllScheduleBanners,
  setWorkingDays, setTimezone, setRingDurationSec,
  setTodayBells, setDefaultBells, setTemplates, setWeekdayPlans, setWeekdayCustom,
  clearExceptionDetail, hydrateSettings,
} = scheduleSlice.actions;

export default scheduleSlice.reducer;
