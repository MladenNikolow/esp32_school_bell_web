import React, { useEffect, useState } from 'react';
import { useDispatch } from 'react-redux';
import useLocale from '../../hooks/useLocale.jsx';
import TodayTab from './subtabs/TodayTab.jsx';
import DefaultTab from './subtabs/DefaultTab.jsx';
import TemplatesTab from './subtabs/TemplatesTab.jsx';
import ExceptionsTab from './subtabs/ExceptionsTab.jsx';
import HolidayPendingBanner from './components/HolidayPendingBanner.jsx';
import { fetchToday, fetchTemplates } from './ScheduleSlice.js';

const SUBTABS = ['today', 'default', 'templates', 'exceptions'];

export default function SchedulePage() {
  const { t } = useLocale();
  const dispatch = useDispatch();
  const [activeSubTab, setActiveSubTab] = useState('today');
  const [pendingReady, setPendingReady] = useState(false);

  useEffect(() => {
    let mounted = true;
    Promise.race([dispatch(fetchToday()), dispatch(fetchTemplates())]).finally(() => {
      if (mounted) setPendingReady(true);
    });
    return () => { mounted = false; };
  }, [dispatch]);

  const SubTabComponent = {
    today: TodayTab,
    default: DefaultTab,
    templates: TemplatesTab,
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
