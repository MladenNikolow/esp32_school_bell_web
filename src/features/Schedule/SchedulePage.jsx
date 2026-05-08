import React, { useState } from 'react';
import useLocale from '../../hooks/useLocale.jsx';
import TodayTab from './subtabs/TodayTab.jsx';
import DefaultTab from './subtabs/DefaultTab.jsx';
import TemplatesTab from './subtabs/TemplatesTab.jsx';
import ExceptionsTab from './subtabs/ExceptionsTab.jsx';

const SUBTABS = ['today', 'default', 'templates', 'exceptions'];

export default function SchedulePage() {
  const { t } = useLocale();
  const [activeSubTab, setActiveSubTab] = useState('today');

  const SubTabComponent = {
    today: TodayTab,
    default: DefaultTab,
    templates: TemplatesTab,
    exceptions: ExceptionsTab,
  }[activeSubTab];

  return (
    <div className="schedule-page">
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