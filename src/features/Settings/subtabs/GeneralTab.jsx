import React from 'react';
import { useDispatch, useSelector } from 'react-redux';
import {
  saveSettings,
  setWorkingDays, setTimezone, setRingDurationSec,
} from '../../Schedule/ScheduleSlice.js';
import TimezonePicker from '../../Schedule/TimezonePicker.jsx';
import useLocale from '../../../hooks/useLocale.jsx';

const ORDERED_DAYS = [1, 2, 3, 4, 5, 6, 0];

export default function GeneralTab() {
  const dispatch = useDispatch();
  const { t } = useLocale();
  const { timezone, workingDays, ringDurationSec, saving: savingSchedule } =
    useSelector((s) => s.schedule);

  const toggleDay = (d) => {
    const next = workingDays.includes(d)
      ? workingDays.filter((x) => x !== d)
      : [...workingDays, d].sort();
    dispatch(setWorkingDays(next));
  };

  return (
    <div className="sched-card">
      <h3>{t('settings.generalSettings')}</h3>

      <div className="settings-section">
        <h4>{t('settings.workingDays')}</h4>
        <p className="card-desc">{t('settings.workingDaysDesc')}</p>

        <div className="day-picker">
          {ORDERED_DAYS.map((idx) => (
            <button
              key={idx}
              type="button"
              className={`day-btn ${workingDays.includes(idx) ? 'active' : ''}`}
              onClick={() => toggleDay(idx)}
            >
              {t(`settings.days.${idx}`)}
            </button>
          ))}
        </div>

        <div className="day-legend">
          <span className="legend-item">
            <span className="legend-swatch legend-active" /> {t('settings.legendWorking')}
          </span>
          <span className="legend-item">
            <span className="legend-swatch legend-inactive" /> {t('settings.legendOff')}
          </span>
        </div>
      </div>

      <div className="settings-section">
        <h4>{t('settings.timezone')}</h4>
        <p className="card-desc">{t('settings.timezoneHint')}</p>
        <div className="settings-row">
          <TimezonePicker
            value={timezone}
            onChange={(tz) => dispatch(setTimezone(tz))}
          />
        </div>
      </div>

      <div className="settings-section">
        <h4>{t('settings.ringDuration')}</h4>
        <p className="card-desc">{t('settings.ringDurationDesc')}</p>
        <div className="settings-row">
          <label className="form-label" htmlFor="ring-dur">{t('settings.ringDurationSec')}</label>
          <div className="duration-picker">
            <input
              type="range"
              className="duration-slider"
              id="ring-dur"
              min={1}
              max={30}
              value={ringDurationSec}
              onChange={(e) => dispatch(setRingDurationSec(parseInt(e.target.value, 10) || 1))}
            />
            <div className="duration-value-row">
              <input
                type="number"
                className="duration-input"
                min={1}
                max={30}
                value={ringDurationSec}
                onChange={(e) => dispatch(setRingDurationSec(parseInt(e.target.value, 10) || 1))}
              />
              <span className="duration-display">{ringDurationSec}s</span>
            </div>
          </div>
        </div>
      </div>

      <button
        type="button"
        className={`save-button${savingSchedule ? ' loading' : ''}`}
        onClick={() => dispatch(saveSettings({ timezone, workingDays, ringDurationSec }))}
        disabled={savingSchedule}
      >
        {savingSchedule ? t('settings.saving') : t('settings.saveSettings')}
      </button>
    </div>
  );
}
