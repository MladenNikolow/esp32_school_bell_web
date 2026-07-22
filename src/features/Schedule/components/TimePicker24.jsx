import React, { useId, useState, useEffect } from 'react';

/**
 * 24-hour time picker with HH/MM steppers + numeric text entry.
 *
 * Props:
 *   value    -{ hour: 0-23, minute: 0-59 }
 *   onChange -({ hour, minute }) => void
 *   id       -optional base id for accessibility
 *   disabled -boolean
 */
export default function TimePicker24({ value, onChange, id: baseId, disabled }) {
  const genId = useId();
  const id = baseId || genId;

  const { hour = 0, minute = 0 } = value || {};

  // Draft strings -allow free typing; committed on blur
  const [hourDraft, setHourDraft] = useState(String(hour).padStart(2, '0'));
  const [minuteDraft, setMinuteDraft] = useState(String(minute).padStart(2, '0'));

  // Sync drafts when props change externally (e.g. stepper, apply template)
  useEffect(() => { setHourDraft(String(hour).padStart(2, '0')); }, [hour]);
  useEffect(() => { setMinuteDraft(String(minute).padStart(2, '0')); }, [minute]);

  const clamp = (v, min, max) => Math.min(max, Math.max(min, v));

  // Steppers operate on committed value
  const stepHour = (delta) => onChange({ hour: clamp((hour + delta + 24) % 24, 0, 23), minute });
  const stepMinute = (delta) => onChange({ hour, minute: clamp((minute + delta + 60) % 60, 0, 59) });

  // Text input handlers -digits only, allow empty during typing
  const handleHourChange = (e) => {
    setHourDraft(e.target.value.replace(/\D/g, '').slice(0, 2));
  };
  const handleMinuteChange = (e) => {
    setMinuteDraft(e.target.value.replace(/\D/g, '').slice(0, 2));
  };

  // Commit on blur -parse, clamp, emit; empty reverts to last valid
  const commitHour = () => {
    const v = parseInt(hourDraft, 10);
    const committed = isNaN(v) ? hour : clamp(v, 0, 23);
    setHourDraft(String(committed).padStart(2, '0'));
    if (committed !== hour) onChange({ hour: committed, minute });
  };
  const commitMinute = () => {
    const v = parseInt(minuteDraft, 10);
    const committed = isNaN(v) ? minute : clamp(v, 0, 59);
    setMinuteDraft(String(committed).padStart(2, '0'));
    if (committed !== minute) onChange({ hour, minute: committed });
  };

  // Arrow key support in inputs
  const handleHourKey = (e) => {
    if (e.key === 'ArrowUp')   { e.preventDefault(); stepHour(1); }
    if (e.key === 'ArrowDown') { e.preventDefault(); stepHour(-1); }
  };
  const handleMinuteKey = (e) => {
    if (e.key === 'ArrowUp')   { e.preventDefault(); stepMinute(1); }
    if (e.key === 'ArrowDown') { e.preventDefault(); stepMinute(-1); }
  };

  return (
    <div className="timepicker24" role="group" aria-label="Time">
      <div className="timepicker24-field">
        <button
          type="button"
          className="tp-step tp-step-up"
          onClick={() => stepHour(1)}
          tabIndex={-1}
          disabled={disabled}
          aria-label="Increase hour"
        >▲</button>
        <input
          id={`${id}-h`}
          type="text"
          inputMode="numeric"
          pattern="[0-9]*"
          maxLength={2}
          className="tp-input"
          value={hourDraft}
          onChange={handleHourChange}
          onBlur={commitHour}
          onKeyDown={handleHourKey}
          disabled={disabled}
          aria-label="Hour"
        />
        <button
          type="button"
          className="tp-step tp-step-dn"
          onClick={() => stepHour(-1)}
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
          onClick={() => stepMinute(1)}
          tabIndex={-1}
          disabled={disabled}
          aria-label="Increase minute"
        >▲</button>
        <input
          id={`${id}-m`}
          type="text"
          inputMode="numeric"
          pattern="[0-9]*"
          maxLength={2}
          className="tp-input"
          value={minuteDraft}
          onChange={handleMinuteChange}
          onBlur={commitMinute}
          onKeyDown={handleMinuteKey}
          disabled={disabled}
          aria-label="Minute"
        />
        <button
          type="button"
          className="tp-step tp-step-dn"
          onClick={() => stepMinute(-1)}
          tabIndex={-1}
          disabled={disabled}
          aria-label="Decrease minute"
        >▼</button>
      </div>
    </div>
  );
}
