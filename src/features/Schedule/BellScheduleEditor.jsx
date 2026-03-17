import React, { useState } from 'react';

function formatDuration(sec) {
  if (sec < 60) return `${sec}s`;
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return s > 0 ? `${m}m ${s}s` : `${m}m`;
}

/**
 * Reusable bell schedule editor with manual entry and auto-generate modes.
 *
 * @param {Object} props
 * @param {Array}  props.bells      - Array of { hour, minute, durationSec, label }
 * @param {Function} props.onChangeBells - Called with updated bells array
 * @param {string} [props.title]    - Optional header
 * @param {boolean} [props.compact] - Compact styling for embedded use
 * @param {Object} [props.autoDefaults] - Override auto-generate defaults
 */
export default function BellScheduleEditor({ bells, onChangeBells, title, compact, autoDefaults }) {
  const [mode, setMode] = useState('manual');
  const [autoConfig, setAutoConfig] = useState({
    startHour: 7,
    startMinute: 30,
    classDuration: 45,
    breakDuration: 5,
    bigBreakDuration: 15,
    bigBreakAfterClass: 3,
    classCount: 6,
    bellDuration: 3,
    ...autoDefaults,
  });

  const updateBell = (idx, field, value) => {
    onChangeBells(bells.map((b, i) => (i === idx ? { ...b, [field]: value } : b)));
  };

  const removeBell = (idx) => {
    onChangeBells(bells.filter((_, i) => i !== idx));
  };

  const addBell = () => {
    onChangeBells([...bells, { hour: 8, minute: 0, durationSec: 3, label: '' }]);
  };

  const generateBells = () => {
    const generated = [];
    let totalMinutes = autoConfig.startHour * 60 + autoConfig.startMinute;

    for (let i = 0; i < autoConfig.classCount; i++) {
      const hour = Math.floor(totalMinutes / 60) % 24;
      const minute = totalMinutes % 60;
      generated.push({
        hour,
        minute,
        durationSec: autoConfig.bellDuration,
        label: `Period ${i + 1}`,
      });
      const breakAfterThis = (i + 1 === autoConfig.bigBreakAfterClass)
        ? autoConfig.bigBreakDuration
        : autoConfig.breakDuration;
      totalMinutes += autoConfig.classDuration + breakAfterThis;
    }

    onChangeBells(generated);
    setMode('manual');
  };

  const updateAutoField = (field, value) => {
    setAutoConfig(prev => ({ ...prev, [field]: value }));
  };

  return (
    <div className={`bell-schedule-editor ${compact ? 'bell-editor-compact' : ''}`}>
      {title && <h4 className="bell-editor-title">{title}</h4>}

      <div className="mode-tabs">
        <button
          className={`mode-tab ${mode === 'manual' ? 'active' : ''}`}
          onClick={() => setMode('manual')}
        >
          Manual
        </button>
        <button
          className={`mode-tab ${mode === 'auto' ? 'active' : ''}`}
          onClick={() => setMode('auto')}
        >
          Auto Generate
        </button>
      </div>

      {mode === 'auto' && (
        <div className="auto-generate-form">
          <div className="auto-form-row">
            <label>Start Time</label>
            <input
              type="time"
              className="time-input"
              value={`${String(autoConfig.startHour).padStart(2, '0')}:${String(autoConfig.startMinute).padStart(2, '0')}`}
              onChange={(e) => {
                const [h, m] = e.target.value.split(':').map(Number);
                setAutoConfig(prev => ({ ...prev, startHour: h, startMinute: m }));
              }}
            />
          </div>
          <div className="auto-form-row">
            <label>Class Duration (min)</label>
            <input
              type="number"
              className="duration-input"
              min="5"
              max="120"
              value={autoConfig.classDuration}
              onChange={(e) => updateAutoField('classDuration', Math.max(1, parseInt(e.target.value) || 5))}
            />
          </div>
          <div className="auto-form-row">
            <label>Break Duration (min)</label>
            <input
              type="number"
              className="duration-input"
              min="0"
              max="60"
              value={autoConfig.breakDuration}
              onChange={(e) => updateAutoField('breakDuration', Math.max(0, parseInt(e.target.value) || 0))}
            />
          </div>
          <div className="auto-form-row">
            <label>Big Break Duration (min)</label>
            <input
              type="number"
              className="duration-input"
              min="0"
              max="60"
              value={autoConfig.bigBreakDuration}
              onChange={(e) => updateAutoField('bigBreakDuration', Math.max(0, parseInt(e.target.value) || 0))}
            />
          </div>
          <div className="auto-form-row">
            <label>Big Break After Class</label>
            <input
              type="number"
              className="duration-input"
              min="1"
              max={autoConfig.classCount - 1 || 1}
              value={autoConfig.bigBreakAfterClass}
              onChange={(e) => updateAutoField('bigBreakAfterClass', Math.min(Math.max(autoConfig.classCount - 1, 1), Math.max(1, parseInt(e.target.value) || 1)))}
            />
          </div>
          <div className="auto-form-row">
            <label>Number of Classes</label>
            <input
              type="number"
              className="duration-input"
              min="1"
              max="20"
              value={autoConfig.classCount}
              onChange={(e) => updateAutoField('classCount', Math.min(20, Math.max(1, parseInt(e.target.value) || 1)))}
            />
          </div>
          <div className="auto-form-row">
            <label>Bell Ring Duration (sec)</label>
            <input
              type="number"
              className="duration-input"
              min="1"
              max="300"
              value={autoConfig.bellDuration}
              onChange={(e) => updateAutoField('bellDuration', Math.min(300, Math.max(1, parseInt(e.target.value) || 1)))}
            />
          </div>
          <div className="auto-generate-preview">
            <span className="preview-label">Preview:</span>
            {(() => {
              let last = autoConfig.startHour * 60 + autoConfig.startMinute;
              for (let i = 0; i < autoConfig.classCount - 1; i++) {
                const brk = (i + 1 === autoConfig.bigBreakAfterClass)
                  ? autoConfig.bigBreakDuration : autoConfig.breakDuration;
                last += autoConfig.classDuration + brk;
              }
              const endH = Math.floor(last / 60) % 24;
              const endM = last % 60;
              return (
                <span>
                  {autoConfig.classCount} classes from{' '}
                  {String(autoConfig.startHour).padStart(2, '0')}:{String(autoConfig.startMinute).padStart(2, '0')}{' '}
                  to {String(endH).padStart(2, '0')}:{String(endM).padStart(2, '0')}
                </span>
              );
            })()}
          </div>
          <button className="add-btn generate-btn" onClick={generateBells}>
            Generate & Apply
          </button>
          <p className="auto-hint">This will replace all current bells.</p>
        </div>
      )}

      {mode === 'manual' && (
        <>
          {bells.length === 0 ? (
            <p className="empty-text">No bells configured. Add a bell to get started.</p>
          ) : (
            <div className="bell-table-wrap">
              <table className="bell-table">
                <thead>
                  <tr>
                    <th>Time</th>
                    <th>Duration (s)</th>
                    <th>Label</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {bells.map((b, i) => (
                    <tr key={i}>
                      <td>
                        <input
                          type="time"
                          className="time-input"
                          value={`${String(b.hour).padStart(2, '0')}:${String(b.minute).padStart(2, '0')}`}
                          onChange={(e) => {
                            const [h, m] = e.target.value.split(':').map(Number);
                            onChangeBells(bells.map((bell, idx) => (idx === i ? { ...bell, hour: h, minute: m } : bell)));
                          }}
                        />
                      </td>
                      <td>
                        <div className="duration-picker">
                          <input
                            type="range"
                            className="duration-slider"
                            min="1"
                            max="300"
                            value={b.durationSec}
                            onChange={(e) => updateBell(i, 'durationSec', parseInt(e.target.value) || 1)}
                          />
                          <div className="duration-value-row">
                            <input
                              type="number"
                              className="duration-input"
                              min="1"
                              max="300"
                              value={b.durationSec}
                              onChange={(e) => updateBell(i, 'durationSec', parseInt(e.target.value) || 1)}
                            />
                            <span className="duration-display">{formatDuration(b.durationSec)}</span>
                          </div>
                        </div>
                      </td>
                      <td>
                        <input
                          className="label-input"
                          value={b.label || ''}
                          onChange={(e) => updateBell(i, 'label', e.target.value)}
                          placeholder="e.g. Period 1"
                          maxLength={47}
                        />
                      </td>
                      <td>
                        <button className="delete-btn" onClick={() => removeBell(i)} title="Remove">×</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <div className="bell-actions">
            <button className="add-btn" onClick={addBell}>+ Add Bell</button>
          </div>
        </>
      )}
    </div>
  );
}
