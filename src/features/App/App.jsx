import React, { useEffect } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { loadMode, updateMode, setModeLocal, clearError } from './AppSlice';

export default function App() {
  const dispatch = useDispatch();
  const { value: mode, connected, loading, saving, error } = useSelector((s) => s.mode);

  // Attempt to fetch once on mount
  useEffect(() => {
    dispatch(loadMode());
  }, [dispatch]);

  const onSave = () => {
    dispatch(updateMode(mode));
  };

  const onRetry = () => {
    dispatch(loadMode());
  };

  return (
    <div style={{ padding: 20, fontFamily: 'Arial' }}>
      <h1>ESP32 Mode Control</h1>

      <div style={{ marginBottom: 10 }}>
        <strong>Status:</strong>{' '}
        {loading ? (
          <span>Checking device…</span>
        ) : connected ? (
          <span style={{ color: 'green' }}>Connected</span>
        ) : (
          <span style={{ color: 'crimson' }}>Disconnected</span>
        )}
      </div>

      {error && (
        <div style={{ color: 'crimson', marginBottom: 10 }}>
          {error}{' '}
          <button onClick={() => dispatch(clearError())} style={{ marginLeft: 8 }}>
            Dismiss
          </button>
        </div>
      )}

      <label>
        Mode:
        <input
          value={mode}
          onChange={(e) => dispatch(setModeLocal(e.target.value))}
          style={{ marginLeft: 10 }}
          aria-label="mode-input"
        />
      </label>

      <button onClick={onSave} style={{ marginLeft: 10 }} disabled={saving}>
        {saving ? 'Saving...' : 'Save'}
      </button>

      <button onClick={onRetry} style={{ marginLeft: 8 }} disabled={loading}>
        {loading ? 'Refreshing…' : 'Retry'}
      </button>

      <div style={{ marginTop: 12, color: '#666' }}>
        The field is always editable locally. If the ESP32 is reachable the component will fetch and populate the value; otherwise you can edit and save when the device becomes available.
      </div>
    </div>
  );
}