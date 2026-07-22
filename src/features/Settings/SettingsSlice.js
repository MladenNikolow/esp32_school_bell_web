import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import ScheduleService from '../../services/ScheduleService.js';
import CredentialService from '../../services/CredentialService.js';
import httpRequestAgent from '../../utils/HttpRequestAgent.js';
import { API_CONFIG } from '../../config/apiConfig.js';

export const fetchSettingsCore = createAsyncThunk(
  'settings/fetchSettingsCore',
  async (_, { signal }) => httpRequestAgent.get(
    API_CONFIG.ENDPOINTS.UI_SETTINGS_CORE,
    { signal, priority: 'visible' },
  ),
  { condition: (arg, { getState }) => arg?.force || Date.now() - getState().settings.resources.core.loadedAt >= 60000 },
);

export const fetchSettingsAccess = createAsyncThunk(
  'settings/fetchSettingsAccess',
  async (_, { signal }) => httpRequestAgent.get(
    API_CONFIG.ENDPOINTS.UI_SETTINGS_ACCESS,
    { signal, priority: 'supporting' },
  ),
  { condition: (arg, { getState }) => arg?.force || Date.now() - getState().settings.resources.access.loadedAt >= 60000 },
);

export const fetchSettingsMaintenance = createAsyncThunk(
  'settings/fetchSettingsMaintenance',
  async (_, { signal }) => httpRequestAgent.get(
    API_CONFIG.ENDPOINTS.UI_SETTINGS_MAINTENANCE,
    { signal, priority: 'supporting' },
  ),
  { condition: (arg, { getState }) => arg?.force || Date.now() - getState().settings.resources.maintenance.loadedAt >= 60000 },
);

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

export const syncTime = createAsyncThunk(
  'settings/syncTime',
  async () => ScheduleService.syncTime()
);

export const savePin = createAsyncThunk(
  'settings/savePin',
  async (pin) => {
    /* Response is status-only; never echo or retain the PIN client-side. */
    await httpRequestAgent.post(API_CONFIG.ENDPOINTS.SYSTEM_PIN, { pin });
    return true;
  }
);

export const fetchCredentials = createAsyncThunk(
  'settings/fetchCredentials',
  async () => {
    return CredentialService.getCredentials();
  }
);

export const saveCredentials = createAsyncThunk(
  'settings/saveCredentials',
  async ({ username, password }, { rejectWithValue }) => {
    try {
      return await CredentialService.saveCredentials(username, password);
    } catch (err) {
      return rejectWithValue(err.message || 'Failed to save credentials');
    }
  }
);

export const deleteCredentials = createAsyncThunk(
  'settings/deleteCredentials',
  async (_, { rejectWithValue }) => {
    try {
      return await CredentialService.deleteCredentials();
    } catch (err) {
      return rejectWithValue(err.message || 'Failed to delete credentials');
    }
  }
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
    syncing: false,
    pinSaving: false,
    clientCredentials: null,
    credentialsLoading: false,
    credentialsSaving: false,
    credentialsDeleting: false,
    firmwareInfo: null,
    tlsStatus: null,
    resources: {
      core: { status: 'idle', loadedAt: 0, error: null },
      access: { status: 'idle', loadedAt: 0, error: null },
      maintenance: { status: 'idle', loadedAt: 0, error: null },
    },
  },
  reducers: {
    clearError: (state) => { state.error = null; },
    clearActionSuccess: (state) => { state.actionSuccess = null; },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchSettingsCore.pending, (state) => {
        state.resources.core.status = 'loading';
        state.resources.core.error = null;
      })
      .addCase(fetchSettingsCore.fulfilled, (state, { payload }) => {
        state.resources.core = { status: 'ready', loadedAt: Date.now(), error: null };
        state.systemInfo = payload.systemInfo ?? state.systemInfo;
      })
      .addCase(fetchSettingsCore.rejected, (state, { error }) => {
        state.resources.core.status = 'error';
        state.resources.core.error = error.message;
        if (error.name !== 'AbortError') state.error = error.message;
      })
      .addCase(fetchSettingsAccess.pending, (state) => {
        state.resources.access.status = 'loading';
        state.resources.access.error = null;
        state.credentialsLoading = true;
      })
      .addCase(fetchSettingsAccess.fulfilled, (state, { payload }) => {
        state.resources.access = { status: 'ready', loadedAt: Date.now(), error: null };
        state.credentialsLoading = false;
        state.clientCredentials = payload.credentials;
      })
      .addCase(fetchSettingsAccess.rejected, (state, { error }) => {
        state.resources.access.status = 'error';
        state.resources.access.error = error.message;
        state.credentialsLoading = false;
        if (error.name !== 'AbortError') state.error = error.message;
      })
      .addCase(fetchSettingsMaintenance.pending, (state) => {
        state.resources.maintenance.status = 'loading';
        state.resources.maintenance.error = null;
      })
      .addCase(fetchSettingsMaintenance.fulfilled, (state, { payload }) => {
        state.resources.maintenance = { status: 'ready', loadedAt: Date.now(), error: null };
        state.firmwareInfo = payload.firmware ?? null;
        state.tlsStatus = payload.tls ?? null;
      })
      .addCase(fetchSettingsMaintenance.rejected, (state, { error }) => {
        state.resources.maintenance.status = 'error';
        state.resources.maintenance.error = error.message;
        if (error.name !== 'AbortError') state.error = error.message;
      })
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
      })
      .addCase(syncTime.pending, (state) => { state.syncing = true; })
      .addCase(syncTime.fulfilled, (state) => {
        state.syncing = false;
        state.actionSuccess = 'Time sync triggered';
      })
      .addCase(syncTime.rejected, (state, { error }) => {
        state.syncing = false;
        state.error = error.message;
      })
      .addCase(savePin.pending, (state) => { state.pinSaving = true; })
      .addCase(savePin.fulfilled, (state) => {
        state.pinSaving = false;
        state.resources.access.loadedAt = Date.now();
        state.actionSuccess = 'PIN updated successfully';
      })
      .addCase(savePin.rejected, (state, { error }) => {
        state.pinSaving = false;
        state.error = error.message;
      })
      .addCase(fetchCredentials.pending, (state) => {
        state.credentialsLoading = true;
      })
      .addCase(fetchCredentials.fulfilled, (state, { payload }) => {
        state.credentialsLoading = false;
        state.clientCredentials = payload;
      })
      .addCase(fetchCredentials.rejected, (state, { error }) => {
        state.credentialsLoading = false;
        if (error.name !== 'AbortError') state.error = error.message;
      })
      .addCase(saveCredentials.pending, (state) => {
        state.credentialsSaving = true;
      })
      .addCase(saveCredentials.fulfilled, (state, { payload, meta }) => {
        state.credentialsSaving = false;
        state.clientCredentials = payload?.credentials ?? {
          clientExists: true,
          clientUsername: payload?.clientUsername ?? meta.arg.username,
        };
        state.resources.access.loadedAt = Date.now();
        state.actionSuccess = 'Client account saved';
      })
      .addCase(saveCredentials.rejected, (state, action) => {
        state.credentialsSaving = false;
        state.error = action.payload || action.error.message;
      })
      .addCase(deleteCredentials.pending, (state) => {
        state.credentialsDeleting = true;
      })
      .addCase(deleteCredentials.fulfilled, (state) => {
        state.credentialsDeleting = false;
        state.clientCredentials = { clientExists: false, clientUsername: '' };
        state.actionSuccess = 'Client account deleted';
      })
      .addCase(deleteCredentials.rejected, (state, action) => {
        state.credentialsDeleting = false;
        state.error = action.payload || action.error.message;
      });
  },
});

export const { clearError, clearActionSuccess } = settingsSlice.actions;
export default settingsSlice.reducer;
