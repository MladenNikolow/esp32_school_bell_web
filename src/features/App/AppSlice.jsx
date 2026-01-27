// src/features/mode/modeSlice.js
import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import HttpRequestAgent from '../../utils/HttpRequestAgent.js';

// Async thunk to load mode from ESP32
export const loadMode = createAsyncThunk(
  'mode/loadMode',
  async (_, { rejectWithValue, signal }) => {
    try {
      const data = await HttpRequestAgent.get('/api/mode', signal);
      return data.mode ?? '';
    } catch (err) {
      return rejectWithValue(err.message ?? 'Failed to load');
    }
  }
);

// Async thunk to update mode on ESP32
export const updateMode = createAsyncThunk(
  'mode/updateMode',
  async (modeValue, { rejectWithValue }) => {
    try {
      const data = await HttpRequestAgent.post('/api/mode', { mode: modeValue });
      return { mode: modeValue, response: data };
    } catch (err) {
      return rejectWithValue(err.message ?? 'Failed to save');
    }
  }
);

const initialState = {
  value: '',        // the mode string
  connected: false, // whether ESP32 responded
  loading: false,   // loadMode pending
  saving: false,    // updateMode pending
  error: null,      // last error message
};

const modeSlice = createSlice({
  name: 'mode',
  initialState,
  reducers: {
    // local update of the input (keeps input editable even when disconnected)
    setModeLocal(state, action) {
      state.value = action.payload;
    },
    // optional: clear error
    clearError(state) {
      state.error = null;
    },
  },
  extraReducers: (builder) => {
    builder
      // loadMode
      .addCase(loadMode.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(loadMode.fulfilled, (state, action) => {
        state.loading = false;
        state.value = action.payload;
        state.connected = true;
        state.error = null;
      })
      .addCase(loadMode.rejected, (state, action) => {
        state.loading = false;
        state.connected = false;
        state.error = action.payload || 'Unable to reach device';
      })

      // updateMode
      .addCase(updateMode.pending, (state) => {
        state.saving = true;
        state.error = null;
      })
      .addCase(updateMode.fulfilled, (state, action) => {
        state.saving = false;
        state.value = action.payload.mode;
        state.connected = true;
        state.error = null;
      })
      .addCase(updateMode.rejected, (state, action) => {
        state.saving = false;
        state.connected = false;
        state.error = action.payload || 'Failed to save to device';
      });
  },
});

export const { setModeLocal, clearError } = modeSlice.actions;
export default modeSlice.reducer;