# ESP32 School Bell -REST API Specification

The React SPA is served from the ESP32-S3 itself (same origin), so all API calls use relative URLs. Authentication uses **HttpOnly session cookies**. CSRF protection is enforced on all mutating requests.

---

## Authentication

### POST /api/login
**Access:** Public

**Request:**
```json
{ "username": "school", "password": "changeme1" }
```
Headers: `Content-Type: application/json`, `X-Requested-With: XMLHttpRequest`

**Response 200:**
```
Set-Cookie: session=<32-hex-token>; HttpOnly; SameSite=Strict; Path=/
```
```json
{ "user": { "username": "school", "role": "client" }, "message": "Login successful" }
```
`role` is `"service"` or `"client"`. Service passwords are per-device -see firmware `tools/service_password.py`.

**Errors:** 400 (bad JSON), 401 (invalid credentials), 429 (rate limited -max 5/60s, shared with claim)

---

### GET /api/setup/claim-status
**Access:** Public

**Response 200:**
```json
{ "claimable": true }
```

---

### POST /api/setup/claim
**Access:** Public (CSRF + rate-limited)

**Request:**
```json
{ "username": "school", "password": "changeme1" }
```

Creates the client account only while none exists. Username must not equal the service username. Password min 8 chars.

**Response 200:** `{ "success": true, "message": "Account created" }`

**Errors:** 400, 403 (`Device already claimed`), 429

---

### POST /api/logout
**Access:** Authenticated

**Request:** `{}` (empty JSON body)
Headers: `Content-Type: application/json`, `X-Requested-With: XMLHttpRequest`

**Response 200:**
```
Set-Cookie: session=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0
```
```json
{ "success": true }
```

---

### GET /api/validate-token
**Access:** Authenticated

**Response 200:**
```json
{ "valid": true, "user": { "username": "admin", "role": "service" } }
```

**Errors:** 401 (no/expired session)

---

## System Endpoints

### GET /api/health
**Access:** Public

```json
{ "status": "healthy", "uptime": 3600 }
```

---

### GET /api/status
**Access:** Public

```json
{
  "device": "ESP32-S3",
  "version": "4.3.0",
  "wifi": { "connected": true, "ssid": "MyNetwork", "rssi": -45 },
  "time": "08:30:00",
  "date": "2026-05-09",
  "timeSynced": true,
  "lastSyncAgeSec": 120
}
```

---

### GET /api/system/info
**Access:** Authenticated

```json
{
  "uptime": 3600,
  "freeHeap": 220000,
  "totalHeap": 524288,
  "flashSize": 16777216,
  "idfVersion": "v5.4.0",
  "firmwareVersion": "4.3.0",
  "time": "08:30:00",
  "date": "2026-05-09",
  "timeSynced": true,
  "lastSyncAgeSec": 120
}
```

---

### POST /api/system/reboot
**Access:** Authenticated

**Request:** `{}`

**Response 200:** `{ "success": true }`

---

### POST /api/system/factory-reset
**Access:** Authenticated

**Request:** `{}`

Deletes schedules/settings defaults, resets PIN + setup wizard, **deletes the client account** (device becomes claimable again), invalidates sessions. Service account is retained.

**Response 200:** `{ "success": true }`

---

### POST /api/system/sync-time
**Access:** Authenticated

**Request:** `{}`

**Response 200:** `{ "success": true, "time": "08:30:00" }`

---

### GET /api/system/credentials
**Access:** Authenticated -**service role only**

```json
{ "clientExists": true, "clientUsername": "teacher" }
```

---

### POST /api/system/credentials
**Access:** Authenticated -**service role only**

**Request:**
```json
{ "username": "teacher", "password": "securepass" }
```

**Response 200:** `{ "success": true }`

---

### DELETE /api/system/credentials
**Access:** Authenticated -**service role only**

**Response 200:** `{ "success": true }`

---

### POST /api/system/pin
**Access:** Authenticated

**Request:**
```json
{ "pin": "1234" }
```

**Response 200:** `{ "success": true }`

---

## Bell Control

### GET /api/bell/status
**Access:** Authenticated

```json
{
  "state": "idle",
  "panicMode": false,
  "dayType": "working",
  "nextBell": { "hour": 8, "minute": 0, "label": "Час 1 начало", "inSeconds": 1800 }
}
```
`state` is `"idle"`, `"ringing"`, or `"panic"`.
`dayType` is `"working"`, `"off"`, `"exceptionDayOff"`, `"exceptionTemplate"`, or `"exceptionCustom"`.

---

### POST /api/bell/test
**Access:** Authenticated

**Request:**
```json
{ "durationSec": 5 }
```

**Response 200:** `{ "success": true }`

---

### POST /api/bell/panic
**Access:** Authenticated

**Request:**
```json
{ "panic": true }
```

**Response 200:** `{ "success": true, "panicMode": true }`

---

## Schedule Endpoints

All schedule data uses the **unified BellSet** model: `{ bells: [{ hour, minute, label }] }`.
No per-bell `durationSec` -ring duration is a global setting in `/api/schedule/settings`.

### GET /api/schedule/settings
**Access:** Authenticated

```json
{
  "timezone": "EET-2EEST,M3.5.0/3,M10.5.0/4",
  "workingDays": [1, 2, 3, 4, 5],
  "ringDurationSec": 5
}
```

---

### POST /api/schedule/settings
**Access:** Authenticated

**Request:**
```json
{
  "timezone": "EET-2EEST,M3.5.0/3,M10.5.0/4",
  "workingDays": [1, 2, 3, 4, 5],
  "ringDurationSec": 5
}
```

**Response 200:** Same shape as GET.

---

### GET /api/schedule/today
**Access:** Authenticated

Returns the effective bell schedule for today, resolved by the scheduler (exception → template → default).

```json
{
  "bells": [
    { "hour": 8, "minute": 0,  "label": "Час 1 начало" },
    { "hour": 8, "minute": 45, "label": "Час 1 край"   }
  ],
  "dayType": "working",
  "source": "default",
  "multiDayException": false
}
```
`source` is `"default"`, `"exception"`, or `"template"`.
`multiDayException: true` means a multi-day exception covers today -saving will split it.

---

### POST /api/schedule/today
**Access:** Authenticated

Saves a single-day override for today. If a multi-day exception covers today the server splits it automatically.

**Request:**
```json
{ "bells": [{ "hour": 8, "minute": 0, "label": "Час 1 начало" }] }
```

**Response 200:** Same shape as GET.

---

### GET /api/schedule/default
**Access:** Authenticated

```json
{ "bells": [{ "hour": 8, "minute": 0, "label": "Час 1 начало" }, ...] }
```

---

### POST /api/schedule/default
**Access:** Authenticated

**Request:** `{ "bells": [...] }`

**Response 200:** `{ "bells": [...] }`

---

### GET /api/schedule/defaults
**Access:** Authenticated

Returns the factory-default bell set (read-only reference, never overwritten by user saves).

```json
{ "bells": [{ "hour": 8, "minute": 0, "label": "Час 1 начало" }, ...] }
```

---

### GET /api/schedule/templates
**Access:** Authenticated

```json
{
  "templates": [
    { "name": "Зимно", "bells": [...] },
    null,
    null
  ],
  "builtins": [
    { "name": "Стандартно", "bells": [...] }
  ]
}
```
`templates` always has exactly 3 slots; a slot is `null` if empty.
`builtins` are read-only server-defined templates.

---

### POST /api/schedule/templates
**Access:** Authenticated

**Request:**
```json
{
  "templates": [
    { "name": "Зимно", "bells": [...] },
    null,
    null
  ]
}
```

**Response 200:** Same shape as GET (server may update `builtins`).

---

### GET /api/schedule/exceptions
**Access:** Authenticated

```json
{
  "exceptions": [
    {
      "startDate": "2026-06-01",
      "endDate":   "2026-06-01",
      "label":     "Детски ден",
      "action":    "dayOff"
    },
    {
      "startDate":     "2026-09-15",
      "endDate":       "2026-09-15",
      "label":         "Съкратен ден",
      "action":        "template",
      "templateIdx":   0,
      "timeOffsetMin": -30
    },
    {
      "startDate": "2026-10-01",
      "endDate":   "2026-10-01",
      "label":     "Ден на отворени врати",
      "action":    "custom",
      "bells":     [{ "hour": 9, "minute": 0, "label": "Начало" }]
    }
  ]
}
```

**Exception actions:**
| `action`   | Extra fields                                |
|------------|---------------------------------------------|
| `dayOff`   | -                                          |
| `template` | `templateIdx` (0–2 custom or builtin index), `timeOffsetMin` |
| `custom`   | `bells`, optional `timeOffsetMin`           |

---

### POST /api/schedule/exceptions
**Access:** Authenticated

**Request:** `{ "exceptions": [...] }` (full list -server replaces entirely)

**Response 200:** `{ "exceptions": [...] }`

---

## WiFi

### GET /api/wifi/scan
**Access:** Public or Authenticated (used in both setup wizard and settings)

```json
{
  "networks": [
    { "ssid": "MyNetwork", "rssi": -45, "secured": true, "bssid": "AA:BB:CC:DD:EE:FF" }
  ]
}
```

---

### POST /api/wifi/credentials
**Access:** Public (used in setup wizard before login exists)

**Request:**
```json
{ "ssid": "MyNetwork", "password": "secret", "bssid": "AA:BB:CC:DD:EE:FF" }
```

**Response 200:** `{ "success": true }`

---

## Security

### CSRF Protection
All POST / PUT / DELETE endpoints **require**:
```
Content-Type: application/json
X-Requested-With: XMLHttpRequest
```
Missing either header → **403 Forbidden** or **415 Unsupported Media Type**.

### Security Response Headers (all responses)
```
X-Content-Type-Options: nosniff
X-Frame-Options: DENY
Cache-Control: no-store
```

### Session Properties
- Token: 32-char hex from `esp_random()`
- Expiry: 1 hour
- Max concurrent sessions: 1
- Stored in RAM (cleared on reboot)
- Rate limiting on `/api/login`: max 5 attempts per 60-second window
