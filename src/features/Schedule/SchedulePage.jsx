import React, { useEffect, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import useLocale from '../../hooks/useLocale.jsx';
import TodayTab from './subtabs/TodayTab.jsx';
import WeekTab from './subtabs/WeekTab.jsx';
import DayPlansTab from './subtabs/DayPlansTab.jsx';
import ExceptionsTab from './subtabs/ExceptionsTab.jsx';
import HolidayPendingBanner from './components/HolidayPendingBanner.jsx';
import {
  fetchToday, fetchTemplates,
  clearAllScheduleBanners,
  clearErrorToday, clearErrorDefault, clearErrorTemplates,
  clearErrorWeek, clearErrorExceptions,
} from './ScheduleSlice.js';

const SUBTABS = ['today', 'week', 'dayPlans', 'exceptions'];
const BANNER_AUTO_DISMISS_MS = 4000;

export default function SchedulePage() {
  const { t } = useLocale();
  const dispatch = useDispatch();
  const [activeSubTab, setActiveSubTab] = useState('today');
  const [pendingReady, setPendingReady] = useState(false);

  const {
    errorToday, errorDefault, errorTemplates, errorWeek, errorExceptions,
  } = useSelector((s) => s.schedule);

  useEffect(() => {
    let mounted = true;
    Promise.race([dispatch(fetchToday()), dispatch(fetchTemplates())]).finally(() => {
      if (mounted) setPendingReady(true);
    });
    return () => { mounted = false; };
  }, [dispatch]);

  /* Leaving a subtab must not leave stale banners for when the user returns. */
  useEffect(() => {
    dispatch(clearAllScheduleBanners());
  }, [activeSubTab, dispatch]);

  /* Errors auto-dismiss; success toasts are still handled per-tab (shorter). */
  useEffect(() => {
    const timers = [];
    if (errorToday) timers.push(setTimeout(() => dispatch(clearErrorToday()), BANNER_AUTO_DISMISS_MS));
    if (errorDefault) timers.push(setTimeout(() => dispatch(clearErrorDefault()), BANNER_AUTO_DISMISS_MS));
    if (errorTemplates) timers.push(setTimeout(() => dispatch(clearErrorTemplates()), BANNER_AUTO_DISMISS_MS));
    if (errorWeek) timers.push(setTimeout(() => dispatch(clearErrorWeek()), BANNER_AUTO_DISMISS_MS));
    if (errorExceptions) timers.push(setTimeout(() => dispatch(clearErrorExceptions()), BANNER_AUTO_DISMISS_MS));
    return () => timers.forEach(clearTimeout);
  }, [errorToday, errorDefault, errorTemplates, errorWeek, errorExceptions, dispatch]);

  const SubTabComponent = {
    today: TodayTab,
    week: WeekTab,
    dayPlans: DayPlansTab,
    exceptions: ExceptionsTab,
  }[activeSubTab];

  return (
    <div className="schedule-page">
      {pendingReady && <HolidayPendingBanner />}
      <nav className="subtab-nav">
        {SUBTABS.map((id) => (
          <button
            key={id}
            className={`subtab-btn${activeSubTab === id ? ' active' : ''}`}
            onClick={() => setActiveSubTab(id)}
          >
            {t(`schedule.subtab.${id}`)}
          </button>
        ))}
      </nav>
      <div className="subtab-content">
        <SubTabComponent />
      </div>
    </div>
  );
}
