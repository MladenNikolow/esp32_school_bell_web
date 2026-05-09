import HttpRequestAgent from '../utils/HttpRequestAgent.js';
import { API_CONFIG } from '../config/apiConfig.js';

const agent = HttpRequestAgent;

const ScheduleService = {
  // Settings (includes timezone, workingDays, ringDurationSec)
  getSettings: (signal) =>
    agent.get(API_CONFIG.ENDPOINTS.SCHEDULE_SETTINGS, signal),

  saveSettings: (data, signal) =>
    agent.post(API_CONFIG.ENDPOINTS.SCHEDULE_SETTINGS, data, signal),

  // Default BellSet
  getDefault: (signal) =>
    agent.get(API_CONFIG.ENDPOINTS.SCHEDULE_DEFAULT, signal),

  saveDefault: (bells, signal) =>
    agent.post(API_CONFIG.ENDPOINTS.SCHEDULE_DEFAULT, { bells }, signal),

  // Today's effective schedule
  getToday: (signal) =>
    agent.get(API_CONFIG.ENDPOINTS.SCHEDULE_TODAY, signal),

  saveToday: (payload, signal) =>
    agent.post(API_CONFIG.ENDPOINTS.SCHEDULE_TODAY, payload, signal),

  // Exceptions
  getExceptions: (signal) =>
    agent.get(API_CONFIG.ENDPOINTS.SCHEDULE_EXCEPTIONS, signal),

  saveExceptions: (exceptions, signal) =>
    agent.post(API_CONFIG.ENDPOINTS.SCHEDULE_EXCEPTIONS, { exceptions }, signal),

  // Templates
  getTemplates: (signal) =>
    agent.get(API_CONFIG.ENDPOINTS.SCHEDULE_TEMPLATES, signal),

  saveTemplates: (templates, signal) =>
    agent.post(API_CONFIG.ENDPOINTS.SCHEDULE_TEMPLATES, { templates }, signal),

  // Bell status & panic
  getBellStatus: (signal) =>
    agent.get(API_CONFIG.ENDPOINTS.BELL_STATUS, signal),

  setPanic: (enabled, signal) =>
    agent.post(API_CONFIG.ENDPOINTS.BELL_PANIC, { enabled }, signal),

  // Test bell
  testBell: (durationSec, signal) =>
    agent.post(API_CONFIG.ENDPOINTS.BELL_TEST, { durationSec }, signal),

  // System time
  getSystemTime: (signal) =>
    agent.get(API_CONFIG.ENDPOINTS.SYSTEM_TIME, signal),

  // System info
  getSystemInfo: (signal) =>
    agent.get(API_CONFIG.ENDPOINTS.SYSTEM_INFO, signal),

  // System reboot
  reboot: (signal) =>
    agent.post(API_CONFIG.ENDPOINTS.SYSTEM_REBOOT, {}, signal),

  // Factory reset
  factoryReset: (signal) =>
    agent.post(API_CONFIG.ENDPOINTS.SYSTEM_FACTORY_RESET, {}, signal),

  // Force NTP time sync
  syncTime: (signal) =>
    agent.post(API_CONFIG.ENDPOINTS.SYSTEM_SYNC_TIME, {}, signal),

  // Defaults
  getDefaults: (signal) =>
    agent.get(API_CONFIG.ENDPOINTS.SCHEDULE_DEFAULTS, signal),
};

export default ScheduleService;
