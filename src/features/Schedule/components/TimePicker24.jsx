import React, { useId } from 'react';

/**
 * 24-hour time picker with HH/MM steppers + numeric entry.
 *
 * Props:
 *   value   — { hour: 0-23, minute: 0-59 }
 *   onChange — ({ hour, minute }) => void
 *   id      — optional base id for accessibility
 *   disabled — boolean
 */
export default function TimePicker24({ value, onChange, id: baseId, disabled }) {
  const genId = useId();
  const id = baseId || genId;

  const { hour = 0, minute = 0 } = value || {};

  const clamp = (v, min, max) => Math.min(max, Math.max(min, v));

  const setHour = (v) => onChange({ hour: clamp(Math.round(v), 0, 23), minute });
  const setMinute = (v) => onChange({ hour, minute: clamp(Math.round(v), 0, 59) });

  const handleHourInput = (e) => {
    const v = parseInt(e.target.value, 10);
    if (!isNaN(v)) setHour(v);
    else if (e.target.value === '') onChange({ hour: 0, minute });
  };

  const handleMinuteInput = (e) => {
    const v = parseInt(e.target.value, 10);
    if (!isNaN(v)) setMinute(v);
    else if (e.target.value === '') onChange({ hour, minute: 0 });
  };

  return (
    <div className="timepicker24" role="group" aria-label="Time">
      <div className="timepicker24-field">
        <button
          type="button"
          className="tp-step tp-step-up"
          onClick={() => setHour((hour + 1) % 24)}
          tabIndex={-1}
          disabled={disabled}
          aria-label="Increase hour"
        >▲</button>
        <input
          id={`${id}-h`}
          type="number"
          className="tp-input"
          min={0}
          max={23}
          value={String(hour).padStart(2, '0')}
          onChange={handleHourInput}
          disabled={disabled}
          aria-label="Hour"
        />
        <button
          type="button"
          className="tp-step tp-step-dn"
          onClick={() => setHour((hour + 23) % 24)}
          tabIndex={-1}
          disabled={disabled}
          aria-label="Decrease hour"
        >▼</button>
      </div>
      <span className="tp-colon">:</span>
      <div className="timepicker24-field">
        <button
          type="button"
          className="tp-step tp-step-up"
          onClick={() => setMinute((minute + 1) % 60)}
          tabIndex={-1}
          disabled={disabled}
          aria-label="Increase minute"
        >▲</button>
        <input
          id={`${id}-m`}
          type="number"
          className="tp-input"
          min={0}
          max={59}
          value={String(minute).padStart(2, '0')}
          onChange={handleMinuteInput}
          disabled={disabled}
          aria-label="Minute"
        />
        <button
          type="button"
          className="tp-step tp-step-dn"
          onClick={() => setMinute((minute + 59) % 60)}
          tabIndex={-1}
          disabled={disabled}
          aria-label="Decrease minute"
        >▼</button>
      </div>
    </div>
  );
}
