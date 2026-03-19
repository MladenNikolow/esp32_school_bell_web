// src/features/Schedule/components/BellStatusPanel.jsx
import React from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { setPanic } from '../ScheduleSlice.js';
import useLocale from '../../../hooks/useLocale.jsx';

export default function BellStatusPanel() {
  const dispatch = useDispatch();
  const { t } = useLocale();
  const { bellStatus, systemTime } = useSelector((state) => state.schedule);

  const stateClass =
    bellStatus.bellState === 'panic'
      ? 'status-panic'
      : bellStatus.bellState === 'ringing'
        ? 'status-ringing'
        : 'status-idle';

  const handlePanicToggle = () => {
    dispatch(setPanic(!bellStatus.panicMode));
  };

  return (
    <div className={`bell-status-panel ${stateClass}`}>
      <div className="status-row">
        <div className="status-item">
          <span className="status-label">{t('statusPanel.bellState')}</span>
          <span className="status-value">{t(`bellState.${bellStatus.bellState}`) || bellStatus.bellState}</span>
        </div>
        <div className="status-item">
          <span className="status-label">{t('statusPanel.dayType')}</span>
          <span className="status-value">{t(`dayType.${bellStatus.dayType}`) || bellStatus.dayType}</span>
        </div>
        <div className="status-item">
          <span className="status-label">{t('statusPanel.deviceTime')}</span>
          <span className="status-value">{systemTime?.time || '--:--:--'}</span>
        </div>
        {bellStatus.nextBell && (
          <div className="status-item">
            <span className="status-label">{t('statusPanel.nextBell')}</span>
            <span className="status-value">
              {bellStatus.nextBell.time}
              {bellStatus.nextBell.label ? ` (${bellStatus.nextBell.label})` : ''}
            </span>
          </div>
        )}
      </div>
      <div className="panic-control">
        <button
          className={`panic-button ${bellStatus.panicMode ? 'panic-active' : ''}`}
          onClick={handlePanicToggle}
        >
          {bellStatus.panicMode ? t('statusPanel.stopPanic') : t('statusPanel.panic')}
        </button>
      </div>
    </div>
  );
}
