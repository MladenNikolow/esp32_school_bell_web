import HttpRequestAgent from '../utils/HttpRequestAgent.js';
import { API_CONFIG } from '../config/apiConfig.js';

const agent = HttpRequestAgent;

const ScheduleService = {
  // Settings
  getSettings: (signal) =>
    agent.get(API_CONFIG.ENDPOINTS.SCHEDULE_SETTINGS, signal),

  saveSettings: (data, signal) =>
    agent.post(API_CONFIG.ENDPOINTS.SCHEDULE_SETTINGS, data, signal),

  // Bells (two shifts)
  getBells: (signal) =>
    agent.get(API_CONFIG.ENDPOINTS.SCHEDULE_BELLS, signal),

  saveBells: (firstShift, secondShift, signal) =>
    agent.post(API_CONFIG.ENDPOINTS.SCHEDULE_BELLS, { firstShift, secondShift }, signal),

  // Holidays
  getHolidays: (signal) =>
    agent.get(API_CONFIG.ENDPOINTS.SCHEDULE_HOLIDAYS, signal),

  saveHolidays: (holidays, signal) =>
    agent.post(API_CONFIG.ENDPOINTS.SCHEDULE_HOLIDAYS, { holidays }, signal),

  // Exceptions
  getExceptions: (signal) =>
    agent.get(API_CONFIG.ENDPOINTS.SCHEDULE_EXCEPTIONS, signal),

  saveExceptions: (data, signal) =>
    agent.post(API_CONFIG.ENDPOINTS.SCHEDULE_EXCEPTIONS, data, signal),

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

  // Defaults
  getDefaults: (signal) =>
    agent.get(API_CONFIG.ENDPOINTS.SCHEDULE_DEFAULTS, signal),
};

export default ScheduleService;
