import React, { useState, useRef, useEffect, useCallback } from 'react';
import useLocale from '../../hooks/useLocale.jsx';

const TIMEZONE_OPTIONS = [
  { label: 'UTC (GMT+0)',                           value: 'GMT0' },
  { label: 'London (GMT / BST)',                     value: 'GMT0BST,M3.5.0/1,M10.5.0' },
  { label: 'Paris / Berlin / Rome (CET / CEST)',     value: 'CET-1CEST,M3.5.0,M10.5.0/3' },
  { label: 'Helsinki / Sofia / Athens (EET / EEST)', value: 'EET-2EEST,M3.5.0/3,M10.5.0/4' },
  { label: 'Moscow (MSK)',                           value: 'MSK-3' },
  { label: 'Dubai (GST, +4)',                        value: 'GST-4' },
  { label: 'Karachi (PKT, +5)',                      value: 'PKT-5' },
  { label: 'Kolkata (IST, +5:30)',                   value: 'IST-5:30' },
  { label: 'Bangkok (ICT, +7)',                      value: 'ICT-7' },
  { label: 'Singapore / Beijing (CST, +8)',          value: 'CST-8' },
  { label: 'Tokyo / Seoul (JST, +9)',                value: 'JST-9' },
  { label: 'Sydney (AEST / AEDT)',                   value: 'AEST-10AEDT,M10.1.0,M4.1.0/3' },
  { label: 'US Eastern (EST / EDT)',                 value: 'EST5EDT,M3.2.0,M11.1.0' },
  { label: 'US Central (CST / CDT)',                 value: 'CST6CDT,M3.2.0,M11.1.0' },
  { label: 'US Mountain (MST / MDT)',                value: 'MST7MDT,M3.2.0,M11.1.0' },
  { label: 'US Pacific (PST / PDT)',                 value: 'PST8PDT,M3.2.0,M11.1.0' },
  { label: 'São Paulo (BRT, -3)',                    value: 'BRT3' },
];

export { TIMEZONE_OPTIONS };

export default function TimezonePicker({ value, onChange }) {
  const { t } = useLocale();
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [customMode, setCustomMode] = useState(false);
  const [customValue, setCustomValue] = useState('');
  const [highlightIdx, setHighlightIdx] = useState(-1);
  const wrapperRef = useRef(null);
  const inputRef = useRef(null);
  const listRef = useRef(null);

  const selectedPreset = TIMEZONE_OPTIONS.find((o) => o.value === value);
  const isCustom = value && !selectedPreset;

  useEffect(() => {
    if (isCustom && !customMode) {
      setCustomValue(value);
    }
  }, [value, isCustom, customMode]);

  const filtered = TIMEZONE_OPTIONS.filter((o) => {
    const q = search.toLowerCase();
    return o.label.toLowerCase().includes(q) || o.value.toLowerCase().includes(q);
  });

  const handleSelect = useCallback((tz) => {
    onChange(tz);
    setOpen(false);
    setSearch('');
    setCustomMode(false);
    setHighlightIdx(-1);
  }, [onChange]);

  const handleCustomApply = () => {
    if (customValue.trim()) {
      onChange(customValue.trim());
      setCustomMode(false);
      setOpen(false);
      setSearch('');
    }
  };

  /* Close on outside click */
  useEffect(() => {
    const handler = (e) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target)) {
        setOpen(false);
        setSearch('');
        setHighlightIdx(-1);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  /* Scroll highlighted item into view */
  useEffect(() => {
    if (highlightIdx >= 0 && listRef.current) {
      const items = listRef.current.querySelectorAll('.tz-option');
      if (items[highlightIdx]) {
        items[highlightIdx].scrollIntoView({ block: 'nearest' });
      }
    }
  }, [highlightIdx]);

  const handleKeyDown = (e) => {
    if (!open) {
      if (e.key === 'ArrowDown' || e.key === 'Enter') {
        setOpen(true);
        e.preventDefault();
      }
      return;
    }

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setHighlightIdx((prev) => Math.min(prev + 1, filtered.length - 1));
        break;
      case 'ArrowUp':
        e.preventDefault();
        setHighlightIdx((prev) => Math.max(prev - 1, 0));
        break;
      case 'Enter':
        e.preventDefault();
        if (highlightIdx >= 0 && highlightIdx < filtered.length) {
          handleSelect(filtered[highlightIdx].value);
        }
        break;
      case 'Escape':
        setOpen(false);
        setSearch('');
        setHighlightIdx(-1);
        break;
    }
  };

  if (customMode) {
    return (
      <div className="tz-picker-wrapper" ref={wrapperRef}>
        <div className="tz-custom-row">
          <input
            className="form-input timezone-input"
            value={customValue}
            onChange={(e) => setCustomValue(e.target.value)}
            placeholder="e.g. CET-1CEST,M3.5.0,M10.5.0/3"
            onKeyDown={(e) => e.key === 'Enter' && handleCustomApply()}
          />
          <button className="tz-preset-btn" onClick={handleCustomApply}>{t('tz.apply')}</button>
          <button className="tz-preset-btn" onClick={() => setCustomMode(false)}>{t('tz.presets')}</button>
        </div>
        <span className="field-hint">{t('tz.posixHint')}</span>
      </div>
    );
  }

  return (
    <div className="tz-picker-wrapper" ref={wrapperRef}>
      <div
        className={`tz-picker-trigger ${open ? 'tz-picker-open' : ''}`}
        onClick={() => { setOpen(!open); setTimeout(() => inputRef.current?.focus(), 0); }}
        tabIndex={0}
        onKeyDown={handleKeyDown}
        role="combobox"
        aria-expanded={open}
        aria-haspopup="listbox"
      >
        <span className="tz-picker-value">
          {selectedPreset ? selectedPreset.label : isCustom ? t('tz.custom', { value }) : t('tz.selectTimezone')}
        </span>
        <span className="tz-picker-arrow">{open ? '▲' : '▼'}</span>
      </div>

      {open && (
        <div className="tz-picker-dropdown">
          <input
            ref={inputRef}
            className="tz-picker-search"
            type="text"
            value={search}
            onChange={(e) => { setSearch(e.target.value); setHighlightIdx(0); }}
            onKeyDown={handleKeyDown}
            placeholder={t('tz.searchPlaceholder')}
            autoFocus
          />
          <ul className="tz-picker-list" ref={listRef} role="listbox">
            {filtered.map((tz, i) => (
              <li
                key={tz.value}
                className={`tz-option ${tz.value === value ? 'tz-option-selected' : ''} ${i === highlightIdx ? 'tz-option-highlight' : ''}`}
                onClick={() => handleSelect(tz.value)}
                role="option"
                aria-selected={tz.value === value}
              >
                <span className="tz-option-label">{tz.label}</span>
                <span className="tz-option-posix">{tz.value}</span>
              </li>
            ))}
            {filtered.length === 0 && (
              <li className="tz-option tz-option-empty">{t('tz.noMatch')}</li>
            )}
          </ul>
          <button
            className="tz-custom-btn"
            onClick={() => { setCustomMode(true); setCustomValue(value || ''); setOpen(false); setSearch(''); }}
          >
            {t('tz.enterCustom')}
          </button>
        </div>
      )}
    </div>
  );
}
