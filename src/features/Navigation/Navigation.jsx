import React from 'react';
import useLocale from '../../hooks/useLocale.jsx';

const TAB_IDS = ['dashboard', 'schedule', 'calendar', 'settings'];

export default function Navigation({ activeTab, onTabChange }) {
  const { t } = useLocale();
  return (
    <nav className="tab-nav">
      {TAB_IDS.map((id) => (
        <button
          key={id}
          className={`tab-btn${activeTab === id ? ' active' : ''}`}
          onClick={() => onTabChange(id)}
        >
          {t(`nav.${id}`)}
        </button>
      ))}
    </nav>
  );
}
