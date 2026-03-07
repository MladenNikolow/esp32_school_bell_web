import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import httpRequestAgent from '../../utils/HttpRequestAgent.js';
import { API_CONFIG } from '../../config/apiConfig.js';

export const checkWifiMode = createAsyncThunk(
  'wifiConfig/checkWifiMode',
  async (_, { rejectWithValue }) => {
    try {
      const data = await httpRequestAgent.get(API_CONFIG.ENDPOINTS.WIFI_STATUS);
      return data;
    } catch {
      // 404 in STA mode is expected — not an error
      return rejectWithValue('sta');
    }
  }
);

export const fetchNetworks = createAsyncThunk(
  'wifiConfig/fetchNetworks',
  async () => {
    const data = await httpRequestAgent.get(API_CONFIG.ENDPOINTS.WIFI_NETWORKS);
    return data.networks;
  }
);

export const saveWifiConfig = createAsyncThunk(
  'wifiConfig/saveWifiConfig',
  async ({ ssid, password }) => {
    const data = await httpRequestAgent.post(API_CONFIG.ENDPOINTS.WIFI_CONFIG, { ssid, password });
    return data;
  }
);

const wifiConfigSlice = createSlice({
  name: 'wifiConfig',
  initialState: {
    isApMode: false,
    wifiModeChecked: false,
    apSsid: '',
    networks: [],
    networksLoading: false,
    networksError: null,
    saving: false,
    saveError: null,
    saved: false,
  },
  reducers: {
    clearNetworksError(state) {
      state.networksError = null;
    },
    clearSaveError(state) {
      state.saveError = null;
    },
  },
  extraReducers: (builder) => {
    builder
      // checkWifiMode
      .addCase(checkWifiMode.fulfilled, (state, action) => {
        state.wifiModeChecked = true;
        if (action.payload && action.payload.mode === 'AP') {
          state.isApMode = true;
          state.apSsid = action.payload.ap_ssid || '';
        } else {
          state.isApMode = false;
        }
      })
      .addCase(checkWifiMode.rejected, (state) => {
        state.wifiModeChecked = true;
        state.isApMode = false;
      })
      // fetchNetworks
      .addCase(fetchNetworks.pending, (state) => {
        state.networksLoading = true;
        state.networksError = null;
      })
      .addCase(fetchNetworks.fulfilled, (state, action) => {
        state.networksLoading = false;
        state.networks = action.payload;
      })
      .addCase(fetchNetworks.rejected, (state, action) => {
        state.networksLoading = false;
        state.networksError = action.error.message || 'Failed to scan networks';
      })
      // saveWifiConfig
      .addCase(saveWifiConfig.pending, (state) => {
        state.saving = true;
        state.saveError = null;
      })
      .addCase(saveWifiConfig.fulfilled, (state) => {
        state.saving = false;
        state.saved = true;
      })
      .addCase(saveWifiConfig.rejected, (state, action) => {
        state.saving = false;
        state.saveError = action.error.message || 'Failed to save WiFi configuration';
      });
  },
});

export const { clearNetworksError, clearSaveError } = wifiConfigSlice.actions;
export default wifiConfigSlice.reducer;
