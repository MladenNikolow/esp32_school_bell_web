import React, { useState, useEffect, useRef, memo } from 'react';
import useLocale from '../../hooks/useLocale.jsx';

function DeviceClock({ serverTime, serverDate, timeSynced, lastSyncAgeSec, dayOfWeek, dayType, dayTypeLabel }) {
  const { t } = useLocale();

  function formatDateLong(dateStr, dow) {
    if (!dateStr || !/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return dateStr || '';
    const [y, m, d] = dateStr.split('-').map(Number);
    const month = t(`clock.months.${m - 1}`);
    return dow
      ? `${dow}, ${d} ${month} ${y}`
      : `${d} ${month} ${y}`;
  }
  const [display, setDisplay] = useState({ time: serverTime, date: serverDate });
  const baseRef = useRef(null);

  useEffect(() => {
    if (!serverTime || serverTime === '--:--:--') {
      setDisplay({ time: serverTime || '--:--:--', date: serverDate || '' });
      baseRef.current = null;
      return;
    }
    const parts = serverTime.split(':').map(Number);
    if (parts.length < 3) return;
    baseRef.current = {
      epoch: Date.now(),
      h: parts[0],
      m: parts[1],
      s: parts[2],
      date: serverDate || '',
    };
    setDisplay({ time: serverTime, date: serverDate });
  }, [serverTime, serverDate]);

  useEffect(() => {
    const id = setInterval(() => {
      const base = baseRef.current;
      if (!base) return;

      const elapsed = Math.floor((Date.now() - base.epoch) / 1000);
      let totalSec = base.h * 3600 + base.m * 60 + base.s + elapsed;

      let dateStr = base.date;
      if (totalSec >= 86400) {
        totalSec %= 86400;
        if (/^\d{4}-\d{2}-\d{2}$/.test(base.date)) {
          const d = new Date(base.date + 'T00:00:00');
          d.setDate(d.getDate() + 1);
          dateStr = d.toISOString().slice(0, 10);
        }
      }

      const hh = String(Math.floor(totalSec / 3600) % 24).padStart(2, '0');
      const mm = String(Math.floor((totalSec % 3600) / 60)).padStart(2, '0');
      const ss = String(totalSec % 60).padStart(2, '0');

      setDisplay({ time: `${hh}:${mm}:${ss}`, date: dateStr });
    }, 1000);

    return () => clearInterval(id);
  }, []);

  const formattedDate = formatDateLong(display.date, dayOfWeek);

  return (
    <div className="dash-card dash-card-today">
      <div className="today-top-row">
        <div className="today-date-full">{formattedDate || '—'}</div>
        <div className={`sync-indicator ${timeSynced ? 'synced' : 'not-synced'}`}>
          <span className="sync-dot"></span>
          {timeSynced
            ? (lastSyncAgeSec != null && lastSyncAgeSec < 4294967295
                ? t('clock.syncedAgo', { minutes: Math.floor(lastSyncAgeSec / 60) })
                : t('clock.synced'))
            : t('clock.notSynced')}
        </div>
      </div>
      <div className="today-clock">{display.time}</div>
      <div className="today-bottom-row">
        <div className={`day-type-badge day-${dayType}`}>
          {dayTypeLabel}
        </div>
      </div>
    </div>
  );
}

export default memo(DeviceClock);
