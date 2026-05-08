# ESP32 School Bell — Web Frontend Project Structure

## Tech Stack

- **React 18** + **Redux Toolkit** (RTK) — component UI and state management
- **Vite** — build tool; output to `dist/` then bundled into FatFS partition
- **CSS** — all styles in `src/styles/app.css` (no CSS modules)
- **i18n** — plain JS object dictionaries (`en.js` / `bg.js`), accessed via `useLocale` hook

---

## File Tree

```
src/
├── app/
│   └── store.js                     Redux store — slices: mode, auth, wifiConfig, dashboard, schedule, settings
│
├── components/
│   └── RingyLogo.jsx                Shared logo component
│
├── config/
│   └── apiConfig.js                 All API endpoint paths + public-endpoint list
│
├── features/
│   ├── App/
│   │   ├── App.jsx                  Root component; chooses between AuthGuard / WiFiConfigPage
│   │   └── AppSlice.jsx             mode slice (device mode control)
│   │
│   ├── Auth/
│   │   ├── AuthSlice.js             auth slice — loginUser, logoutUser, initializeAuth thunks
│   │   └── components/
│   │       ├── AuthGuard.jsx        Session validation on startup; renders nav + active tab page
│   │       ├── LoginPage.jsx        Login form
│   │       └── __tests__/
│   │           └── LoginPage.test.jsx
│   │
│   ├── Dashboard/
│   │   ├── DashboardPage.jsx        Live clock, bell status, test bell, panic toggle
│   │   ├── DashboardSlice.js        dashboard slice — fetchBellStatus, togglePanic
│   │   └── DeviceClock.jsx          Clock polling /api/status
│   │
│   ├── Navigation/
│   │   └── Navigation.jsx           Top tab bar — tabs: dashboard | schedule | settings
│   │
│   ├── Schedule/
│   │   ├── SchedulePage.jsx         Sub-tab container (Today / Default / Templates / Exceptions)
│   │   ├── ScheduleSlice.js         Unified schedule + settings slice (see State Shape below)
│   │   ├── TimezonePicker.jsx       Timezone picker with POSIX presets + custom input
│   │   ├── components/
│   │   │   ├── BellSetEditor.jsx    Reusable bell-set editor (manual / applyTpl / auto-generate)
│   │   │   ├── TimePicker24.jsx     24h HH:MM picker with step buttons
│   │   │   │
│   │   │   │ ── DEAD CODE (Phase 5 replaced these) ──
│   │   │   ├── BellTimesEditor.jsx
│   │   │   ├── HolidaysEditor.jsx
│   │   │   ├── ExceptionsEditor.jsx
│   │   │   ├── SettingsEditor.jsx
│   │   │   ├── ScheduleDashboard.jsx
│   │   │   └── BellStatusPanel.jsx
│   │   │
│   │   ├── subtabs/
│   │   │   ├── TodayTab.jsx         Today's effective schedule (read-only + edit mode + split-exception warning)
│   │   │   ├── DefaultTab.jsx       Default week schedule editor + Reset to Defaults
│   │   │   ├── TemplatesTab.jsx     3 custom template slots + read-only built-in templates
│   │   │   └── ExceptionsTab.jsx    Exception CRUD (dayOff / template / custom)
│   │   │
│   │   └── BellScheduleEditor.jsx   DEAD CODE — replaced by BellSetEditor.jsx
│   │
│   ├── Settings/
│   │   ├── SettingsPage.jsx         General (workingDays, timezone, ringDurationSec), PIN,
│   │   │                            user management, WiFi, time sync, system actions, system info
│   │   └── SettingsSlice.js         settings slice — WiFi scan/save, PIN, system info, reboot,
│   │                                factory reset, syncTime, testBell
│   │
│   ├── WiFiConfig/
│   │   ├── WiFiConfigSlice.js       Initial WiFi setup wizard state
│   │   └── components/
│   │       └── WiFiConfigPage.jsx   Setup wizard (shown when no WiFi credentials on device)
│   │
│   ├── Calendar/                    DEAD CODE — removed from store and navigation in Phase 5
│   │   ├── CalendarPage.jsx
│   │   └── CalendarSlice.js
│   │
│   └── Home/
│       └── HomePage.jsx             DEAD CODE — replaced by Dashboard + Schedule + Settings
│
├── hooks/
│   ├── useLocale.jsx                t(key), lang, setLang — i18n lookup hook
│   └── useTheme.js                  Dark/light theme toggle
│
├── i18n/
│   ├── en.js                        English strings
│   └── bg.js                        Bulgarian strings (default locale)
│
├── middleware/
│   └── authMiddleware.js            Listens for auth-error DOM events → dispatches logoutUser
│
├── services/
│   ├── AuthService.js               login(), logout(), validateToken()
│   ├── CredentialService.js         getCredentials(), saveCredentials(), deleteCredentials()
│   ├── ErrorHandlingService.js      User-facing error message formatting
│   ├── ScheduleService.js           getSettings/saveSettings, getToday/saveToday,
│   │                                getDefault/saveDefault, getTemplates/saveTemplates,
│   │                                getExceptions/saveExceptions, getDefaults
│   └── __tests__/
│       └── AuthService.test.js
│
├── styles/
│   └── app.css                      Global stylesheet — all component and page styles
│
├── types/
│   └── auth.js                      JSDoc types: AuthState, UserInfo, LoginCredentials
│
├── utils/
│   ├── HttpClient.js                Low-level fetch wrapper; fires auth-error events on 401/403
│   ├── HttpRequestAgent.js          Singleton API client: get/post/put/delete + login/logout
│   ├── TokenManager.js              Session-alive timestamp tracker (legacy; no token storage)
│   ├── authUtils.js                 Auth helper functions
│   ├── formValidation.js            Form input validation
│   └── __tests__/
│       └── integration.test.js
│
└── main.jsx                         Entry point — <Provider store> → <App>
```

---

## Redux State Shape

```js
{
  mode:      { value, loading, error },           // device mode
  auth:      { user, authenticated, loading, error },
  wifiConfig:{ /* WiFi setup wizard state */ },
  dashboard: { bellState, panicMode, dayType, timeSynced, lastSyncAgeSec,
               currentTime, currentDate, nextBell, loading, error },
  schedule:  {
    today:          { bells, dayType, source, multiDayException },
    default:        { bells },
    templates:      [null|{name,bells}, null|{...}, null|{...}],  // 3 custom slots
    builtins:       [{name, bells}, ...],                          // read-only from server
    exceptions:     [{ startDate, endDate, label, action, ... }, ...],
    timezone:       '',
    workingDays:    [1,2,3,4,5],
    ringDurationSec: 3,
    loading, saving, error, saveSuccess,
  },
  settings:  { systemInfo, wifiNetworks, syncing, testingBell, rebooting, resetting,
               loading, saving, error, saveSuccess },
}
```

---

## Unified BellSet Model

All schedule data uses the same shape:
```js
{ bells: [{ hour: 8, minute: 0, label: "Час 1 начало" }, ...] }
```
No `durationSec` per bell. Ring duration is a single global setting (`ringDurationSec`) in `ScheduleSlice`.

---

## Data Flow

```
AuthGuard (validates session on startup)
    │
    ├─ Not authenticated → LoginPage
    └─ Authenticated ───→ Navigation + Page tabs
                                 │
                    ┌────────────┼───────────────┐
                    ▼            ▼               ▼
              DashboardPage  SchedulePage   SettingsPage
                    │            │               │
                    │      ┌─────┴─────┐         │
                    │      ▼           │         │
                    │  TodayTab        │         │
                    │  DefaultTab      │         │
                    │  TemplatesTab    │         │
                    │  ExceptionsTab   │         │
                    └────────────┴─────┴─────────┘
                                 │
                         Redux dispatch
                                 │
                    ┌────────────┴───────────┐
                    ▼                        ▼
              ScheduleService          SettingsSlice
              (ScheduleSlice thunks)   thunks
                    │
                    ▼
              HttpRequestAgent → ESP32 REST API
```

---

## API Endpoints Used

| Service / Slice     | Endpoint                       | Method    |
|---------------------|--------------------------------|-----------|
| AuthService         | `/api/login`                   | POST      |
| AuthService         | `/api/logout`                  | POST      |
| AuthService         | `/api/validate-token`          | GET       |
| ScheduleService     | `/api/schedule/settings`       | GET / POST|
| ScheduleService     | `/api/schedule/today`          | GET / POST|
| ScheduleService     | `/api/schedule/default`        | GET / POST|
| ScheduleService     | `/api/schedule/templates`      | GET / POST|
| ScheduleService     | `/api/schedule/exceptions`     | GET / POST|
| ScheduleService     | `/api/schedule/defaults`       | GET       |
| DashboardSlice      | `/api/bell/status`             | GET       |
| DashboardSlice      | `/api/bell/panic`              | POST      |
| SettingsSlice       | `/api/bell/test`               | POST      |
| SettingsSlice       | `/api/wifi/scan`               | GET       |
| SettingsSlice       | `/api/wifi/credentials`        | POST      |
| SettingsSlice       | `/api/system/pin`              | POST      |
| SettingsSlice       | `/api/system/info`             | GET       |
| SettingsSlice       | `/api/system/reboot`           | POST      |
| SettingsSlice       | `/api/system/factory-reset`    | POST      |
| SettingsSlice       | `/api/system/sync-time`        | POST      |
| CredentialService   | `/api/system/credentials`      | GET/POST/DELETE |
| WiFiConfigSlice     | `/api/wifi/*`                  | various   |

---

## Build

```bash
npm run build       # Vite production build → dist/
```

Output is then embedded into the ESP32 firmware's FatFS flash partition (`/react/`).
