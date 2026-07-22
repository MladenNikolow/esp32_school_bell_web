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

  /** POST /api/schedule/today/cancel -remove today's ad-hoc override (if any) */
  cancelToday: (signal) =>
    agent.post(API_CONFIG.ENDPOINTS.SCHEDULE_TODAY_CANCEL, {}, signal),

  // Weekday plan map -{ weekdayPlans: [-1..4 x7], workingDays: [...] }
  getWeek: (signal) =>
    agent.get(API_CONFIG.ENDPOINTS.SCHEDULE_WEEK, signal),

  saveWeek: (payload, signal) =>
    agent.post(API_CONFIG.ENDPOINTS.SCHEDULE_WEEK, payload, signal),

  /** POST /api/schedule/weekday -set a single weekday's plan atomically.
   *  payload: { day: 0..6, action: 'default'|'template'|'custom',
   *             templateIdx?, customBells?: { bells: [...] } } */
  saveWeekday: (payload, signal) =>
    agent.post(API_CONFIG.ENDPOINTS.SCHEDULE_WEEKDAY, payload, signal),

  // Exceptions -granular CRUD + paginated list
  /** GET /api/schedule/exceptions?offset=&limit=&from=&to= */
  getExceptions: ({ offset = 0, limit = 10, from, to } = {}, signal) => {
    let url = `${API_CONFIG.ENDPOINTS.SCHEDULE_EXCEPTIONS}?offset=${offset}&limit=${limit}`;
    if (from) url += `&from=${encodeURIComponent(from)}`;
    if (to)   url += `&to=${encodeURIComponent(to)}`;
    return agent.get(url, signal);
  },

  /** GET /api/schedule/exceptions/:id */
  getExceptionById: (id, signal) =>
    agent.get(`${API_CONFIG.ENDPOINTS.SCHEDULE_EXCEPTIONS}/${id}`, signal),

  /** POST /api/schedule/exceptions → 201 { status, id } */
  createException: (exceptionData, signal) =>
    agent.post(API_CONFIG.ENDPOINTS.SCHEDULE_EXCEPTIONS, exceptionData, signal),

  /** PUT /api/schedule/exceptions/:id */
  updateException: (id, exceptionData, signal) =>
    agent.put(`${API_CONFIG.ENDPOINTS.SCHEDULE_EXCEPTIONS}/${id}`, exceptionData, signal),

  /** DELETE /api/schedule/exceptions/:id */
  deleteException: (id, signal) =>
    agent.delete(`${API_CONFIG.ENDPOINTS.SCHEDULE_EXCEPTIONS}/${id}`, signal),
  /** DELETE /api/schedule/exceptions  -clear-all */
  deleteAllExceptions: (signal) =>
    agent.delete(API_CONFIG.ENDPOINTS.SCHEDULE_EXCEPTIONS, signal),

  // Holiday import (OpenHolidays -Bulgaria)

  /** GET /api/schedule/holidays/preview?year=YYYY&lang=BG|EN
   *  `lang` is optional; firmware defaults to BG when missing/invalid. */
  previewHolidays: (year, lang, signal) => {
    const qs = `year=${encodeURIComponent(year)}`
      + (lang ? `&lang=${encodeURIComponent(lang)}` : '');
    return agent.get(
      `${API_CONFIG.ENDPOINTS.SCHEDULE_HOLIDAYS_PREVIEW}?${qs}`,
      signal,
    );
  },

  /** POST /api/schedule/holidays/apply */
  applyHolidays: (payload, signal) =>
    agent.post(API_CONFIG.ENDPOINTS.SCHEDULE_HOLIDAYS_APPLY, payload, signal),

  /** GET /api/schedule/holidays/pending → null on 204 */
  getPendingHolidays: (signal) =>
    agent.get(API_CONFIG.ENDPOINTS.SCHEDULE_HOLIDAYS_PENDING, {
      signal,
      priority: 'background',
    }),

  /** DELETE /api/schedule/holidays/pending */
  dismissPendingHolidays: (signal) =>
    agent.delete(API_CONFIG.ENDPOINTS.SCHEDULE_HOLIDAYS_PENDING, signal),

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
