import React from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { logoutUser } from '../Auth/AuthSlice.js';
import ScheduleDashboard from '../Schedule/components/ScheduleDashboard.jsx';

export default function HomePage() {
  const dispatch = useDispatch();
  const { user, isLoading: authLoading } = useSelector((state) => state.auth);

  const handleLogout = async () => {
    try {
      await dispatch(logoutUser()).unwrap();
    } catch (error) {
      console.warn('Logout failed:', error);
    }
  };

  return (
    <div className="home-container">
      <div className="home-header">
        <div className="header-content">
          <h1>ESP32 School Bell</h1>
          <div className="user-info">
            <span className="welcome-text">
              Welcome, {user?.username || 'User'}
            </span>
            <button 
              className="logout-button"
              onClick={handleLogout}
              disabled={authLoading}
            >
              {authLoading ? 'Logging out...' : 'Logout'}
            </button>
          </div>
        </div>
      </div>

      <div className="home-content">
        <ScheduleDashboard />
      </div>

      <div className="home-footer">
        <div className="footer-text">
          ESP32 School Bell - Schedule Management
        </div>
      </div>
    </div>
  );
}
