# Authentication System Documentation

## Architecture Overview

The authentication system uses **HttpOnly session cookies** set by the ESP32 server. The client never sees or stores the actual session token — the browser manages it automatically. A `sessionStorage` metadata record tracks the *fact* of authentication for UI purposes.

| Layer | File | Responsibility |
|-------|------|----------------|
| **UI** | `src/features/Auth/components/LoginPage.jsx` | User input, form validation, error display |
| **State** | `src/features/Auth/AuthSlice.js` | Redux state management (authenticated flag, user, flags) |
| **Service** | `src/services/AuthService.js` / `src/utils/HttpRequestAgent.js` | Business logic, credential validation |
| **HTTP** | `src/utils/HttpClient.js` | Cookie-based auth (`credentials: 'same-origin'`), CSRF headers, auth error detection |
| **Metadata** | `src/utils/TokenManager.js` | Client-side session metadata in `sessionStorage` (not the actual credential) |

Supporting files:

- `src/types/auth.js` — JSDoc type definitions (`AuthState`, `UserInfo`, `LoginCredentials`, `SessionMeta`, etc.)
- `src/config/apiConfig.js` — API endpoints, public endpoint list, error messages, request configuration
- `src/middleware/authMiddleware.js` — Redux middleware for auth error events and session expiration checks

---

## Cookie-Based Auth Model

The actual session credential is an **HttpOnly cookie** set by the server:

```
Set-Cookie: session=<opaque_token>; HttpOnly; SameSite=Strict; Path=/
```

| Property | Value | Purpose |
|----------|-------|---------|
| `HttpOnly` | *(flag)* | JavaScript cannot read the cookie — XSS cannot steal the credential |
| `SameSite=Strict` | *(flag)* | Cookie only sent on same-site requests — primary CSRF defense |
| `Path=/` | `/` | Cookie available to all API paths |
| `Expires/Max-Age` | *omitted* | Session cookie — automatically cleared when the browser closes |

The browser sends this cookie automatically on every same-origin `fetch()` call when `credentials: 'same-origin'` is set. The client-side code never reads, stores, or transmits the token itself.

---

## CSRF Protection

Because the browser sends the session cookie automatically, state-changing requests need CSRF protection. The system uses two complementary defenses:

### 1. Content-Type Enforcement

All POST/PUT/DELETE requests to protected endpoints must include:

```
Content-Type: application/json
```

HTML forms can only submit `application/x-www-form-urlencoded`, `multipart/form-data`, or `text/plain` — they cannot send `application/json`. The firmware rejects any mutating request without this header with **415 Unsupported Media Type**.

### 2. X-Requested-With Header

All POST/PUT/DELETE requests must include:

```
X-Requested-With: XMLHttpRequest
```

This is a custom header that HTML forms cannot set and that triggers a CORS preflight for cross-origin requests. The firmware rejects mutating requests without this header with **403 Forbidden**.

`HttpClient.request()` automatically adds `X-Requested-With: XMLHttpRequest` to all non-GET/HEAD/OPTIONS requests.

---

## Login Flow (Step by Step)

```
User enters credentials
  │
  ▼
LoginPage.jsx: handleSubmit()
  │  dispatch(loginUser({ username, password }))
  ▼
AuthSlice.js: loginUser thunk
  │  HttpRequestAgent.login(credentials)
  ▼
HttpRequestAgent.login()
  │  HttpClient.post('/api/login', credentials, { skipAuth: true })
  ▼
HttpClient.request()
  │  skipAuth=true → no auth session check
  │  POST /api/login  { username, password }
  │  headers: Content-Type: application/json, X-Requested-With: XMLHttpRequest
  │  credentials: 'same-origin'
  ▼
ESP32 Server responds
  │  Set-Cookie: session=<opaque_token>; HttpOnly; SameSite=Strict; Path=/
  │  Body: { user: { username, role }, message: "Login successful" }
  ▼
HttpRequestAgent.login()
  │  Validates response (user must exist)
  │  TokenManager.markAuthenticated()
  ▼
TokenManager.markAuthenticated()
  │  sessionStorage['esp32_auth_meta'] = JSON.stringify({ authenticated: true, timestamp: Date.now() })
  ▼
AuthSlice: loginUser.fulfilled
  │  state.isAuthenticated = true
  │  state.user = { username, role }
  ▼
AuthGuard.jsx re-renders
  │  isAuthenticated === true → show main app
  ▼
User sees Dashboard
```

### On Failure

- `HttpRequestAgent.login()` **always** calls `TokenManager.clearAuthSession()` on any error to ensure clean state.
- The error propagates through the Redux thunk to `loginUser.rejected`, which resets `isAuthenticated` and `user` to `false`/`null`.
- `LoginPage.jsx` reads the `error` from Redux state and displays it to the user.

---

## App Startup / Session Restoration

When the app first loads, `AuthGuard.jsx` dispatches `initializeAuth()`:

1. A loading spinner is shown while `isInitializing` is `true` (message: "Initializing ESP32 Connection...").
2. `TokenManager.hasAuthSession()` checks if session metadata exists in `sessionStorage`.
3. If metadata exists → `HttpRequestAgent.validateToken()` sends `GET /api/validate-token` (the browser sends the HttpOnly cookie automatically).
4. If the server confirms validity → Redux state is restored (`isAuthenticated = true`, user info populated).
5. If invalid or network error → session metadata is cleared from `sessionStorage`, user sees the login page.
6. `isInitializing` transitions from `true` → `false`.

> **Note**: Since the cookie has no `Expires`/`Max-Age`, it is a session cookie. If the user closes the browser entirely, both the cookie and `sessionStorage` are cleared automatically.

```
App Mount
  │
  ▼
AuthGuard.jsx: useEffect → dispatch(initializeAuth())
  │  Show loading spinner
  ▼
initializeAuth thunk
  │  HttpRequestAgent.validateToken()
  ▼
Has auth session metadata?
  ├─ NO  → return { authenticated: false, user: null } → show LoginPage
  ├─ YES → GET /api/validate-token  (cookie sent automatically)
  │          ├─ 200 OK   → return { authenticated: true, user } → show main app
  │          └─ Error/401 → clearAuthSession() → show LoginPage
```

---

## Subsequent API Requests

Every HTTP request goes through `HttpClient.request()`:

1. Checks if the request requires auth (`skipAuth` is not set).
2. Checks `TokenManager.hasAuthSession()` — verifies the client-side metadata exists.
3. If auth is required but no session metadata → throws `Authentication required`.
4. Sets `credentials: 'same-origin'` — the browser automatically attaches the HttpOnly session cookie.
5. For POST/PUT/DELETE: automatically adds `X-Requested-With: XMLHttpRequest` (CSRF defense).
6. If the response status is `401` or `403`:
   - Clears session metadata from `sessionStorage`.
   - Dispatches a `CustomEvent('auth-error')` on `window`.
   - Throws an `Authentication failed` error.

The **authMiddleware** (Redux middleware) listens for the `auth-error` window event and dispatches `clearAuthToken()` to reset Redux state, forcing the user back to the login page.

```
Any API call (e.g., GET /api/schedule/settings)
  │
  ▼
HttpClient.request()
  │  hasAuthSession() → true
  │  credentials: 'same-origin' (browser sends HttpOnly cookie)
  │  GET → no extra headers
  │  POST/PUT/DELETE → adds X-Requested-With: XMLHttpRequest
  ▼
fetch(url, { credentials: 'same-origin', headers })
  │
  ├─ 200 OK → return response data
  │
  └─ 401/403
       │  TokenManager.clearAuthSession()
       │  window.dispatchEvent('auth-error')
       ▼
     authMiddleware catches event
       │  dispatch(clearAuthToken())
       ▼
     AuthGuard re-renders → show LoginPage
```

---

## Logout Flow

1. User clicks logout → dispatches `logoutUser()` thunk.
2. `HttpRequestAgent.logout()` attempts `POST /api/logout` (best effort, 5s timeout). The server clears the cookie via `Set-Cookie: session=; Max-Age=0`.
3. **Regardless of server response**, `TokenManager.clearAuthSession()` removes session metadata from `sessionStorage`.
4. Redux state is reset: `isAuthenticated = false`, `user = null`.
5. AuthGuard re-renders → shows `LoginPage`.

Even if `logoutUser` is rejected (server error), the Redux reducer still clears all local auth state.

---

## Public vs Protected Endpoints

Defined in `src/config/apiConfig.js`:

| Public (no cookie needed) | Protected (cookie required) |
|---|---|
| `/api/login` | `/api/schedule/*` |
| `/api/health` | `/api/bell/*` |
| `/api/status` | `/api/system/*` |
| `/api/wifi/status` | `/api/logout` |
| `/api/wifi/networks` | `/api/validate-token` |
| `/api/wifi/config` | `/api/refresh-token` |

**CSRF headers required**: All POST/PUT/DELETE requests to protected endpoints must include `Content-Type: application/json` and `X-Requested-With: XMLHttpRequest`.

---

## TokenManager — Detailed Reference

**File**: `src/utils/TokenManager.js`  
**Storage key**: `esp32_auth_meta` (in `sessionStorage`)  
**Singleton**: Exported as a single instance (`export default new TokenManager()`)

### Storage Format

Session metadata is stored in `sessionStorage` as a JSON string:

```json
{
  "authenticated": true,
  "timestamp": 1709011200000
}
```

- `authenticated` — Always `true` when present; the record's existence indicates an active session.
- `timestamp` — `Date.now()` at the moment of login, used for client-side session age checks.

> **Important**: This is *metadata only*. The actual session credential is the HttpOnly cookie managed by the browser — JavaScript never sees it.

### Primary Methods

| Method | Signature | Returns | Description |
|--------|-----------|---------|-------------|
| **markAuthenticated** | `markAuthenticated()` | `boolean` | Stores `{ authenticated: true, timestamp: Date.now() }` in `sessionStorage`. Returns `false` on failure. |
| **hasAuthSession** | `hasAuthSession()` | `boolean` | Returns `true` if valid session metadata exists in `sessionStorage`. |
| **clearAuthSession** | `clearAuthSession()` | `boolean` | Removes the `esp32_auth_meta` key from `sessionStorage`. Returns `false` if removal fails. |
| **getSessionAge** | `getSessionAge()` | `number \| null` | Returns `Date.now() - timestamp` in milliseconds, or `null` if no session metadata exists. |
| **isSessionExpired** | `isSessionExpired(maxAge: number)` | `boolean` | Returns `true` if `getSessionAge() > maxAge`. Used by `tokenValidationMiddleware` with 24h max age. |
| **isStorageAvailable** | `isStorageAvailable()` | `boolean` | Tests `sessionStorage` read/write with a temporary key. |

### Legacy Shim Methods

These methods exist for backward compatibility. They delegate to the primary methods above:

| Method | Delegates to | Notes |
|--------|-------------|-------|
| `storeToken(token)` | `markAuthenticated()` | Ignores the `token` argument |
| `getStoredToken()` | `hasAuthSession()` | Returns `'__httponly__'` (truthy placeholder) or `null` |
| `clearStoredToken()` | `clearAuthSession()` | — |
| `hasStoredToken()` | `hasAuthSession()` | — |
| `getTokenAge()` | `getSessionAge()` | — |
| `isTokenExpired(maxAge)` | `isSessionExpired(maxAge)` | — |

### Error Resilience

| Scenario | Behavior |
|----------|----------|
| Invalid JSON in `sessionStorage` | Caught by `JSON.parse`, metadata is auto-cleared, returns `null`/`false` |
| Missing `authenticated` field | Treated as invalid, auto-cleared |
| `sessionStorage` unavailable | `isStorageAvailable()` returns `false`; all operations fail gracefully |
| Browser closed | `sessionStorage` is cleared automatically (session scope) |

### Session Lifecycle

```
Login success
  └─→ markAuthenticated()             — stores { authenticated: true, timestamp }

Every API request
  └─→ hasAuthSession()                — checks if client believes it's authenticated
  └─→ browser sends HttpOnly cookie automatically (credentials: 'same-origin')

401/403 response
  └─→ clearAuthSession()              — removes metadata from sessionStorage

App startup
  └─→ hasAuthSession()                — checks for existing session metadata
  └─→ server validates via GET /api/validate-token (cookie sent automatically)

Session age check (middleware)
  └─→ isSessionExpired(86400000)      — 24-hour client-side expiration check

Logout
  └─→ clearAuthSession()              — always clears, even if server logout fails

Browser closed
  └─→ sessionStorage cleared           — metadata gone
  └─→ session cookie cleared           — credential gone (no Expires/Max-Age)
```

---

## Redux Auth State

### State Shape (`src/features/Auth/AuthSlice.js`)

```javascript
{
  isAuthenticated: false,   // Whether the user has an active session
  isLoading: false,         // True during login/logout API calls
  isInitializing: true,     // True during app startup session validation
  error: null,              // Error message string or null
  user: null                // { username, email?, role?, displayName? }
}
```

> **Note**: There is no `token` field in state. The session credential lives in the HttpOnly cookie, not in Redux.

### Async Thunks

| Thunk | Trigger | Success | Failure |
|-------|---------|---------|---------|
| `loginUser(credentials)` | Login form submit | Sets user, `isAuthenticated = true` | Clears all auth state, sets `error` |
| `logoutUser()` | Logout button click | Clears all auth state | Clears all auth state + sets `error` |
| `initializeAuth()` | App mount (`AuthGuard`) | Restores user if session valid | Clears all auth state |

### Synchronous Reducers

| Reducer | Purpose |
|---------|---------|
| `clearAuthError()` | Clears the `error` field |
| `clearAuthToken()` | Resets `isAuthenticated`, `user` and calls `TokenManager.clearAuthSession()` |

---

## Redux Middleware

Two middlewares registered in `src/app/store.js`:

### 1. `authMiddleware`

Listens for `auth-error` `CustomEvent` on `window` (dispatched by `HttpClient` on 401/403). On receiving the event, dispatches `clearAuthToken()` to force a full logout in Redux state. The listener is set up only once (guarded by `window.__authErrorListenerSet`).

### 2. `tokenValidationMiddleware`

Runs after `loginUser/fulfilled` and `initializeAuth/fulfilled` actions. Checks `TokenManager.isSessionExpired(24 * 60 * 60 * 1000)` — if the session metadata is older than 24 hours, dispatches `clearAuthToken()` to force re-authentication.

> This is a client-side hint only. The server independently tracks session expiration and will return 401 for expired sessions regardless of the client-side check.

---

## AuthGuard — Route Protection

**File**: `src/features/Auth/components/AuthGuard.jsx`

```
Component Mount
  │
  ├─ isInitializing === true  → Show loading spinner
  │    dispatch(initializeAuth())
  │
  ├─ isAuthenticated === false → Render <LoginPage />
  │
  └─ isAuthenticated === true  → Render <Navigation /> + app content
```

AuthGuard wraps the entire application. No protected route is accessible without a valid session confirmed by the server.

---

## Security Summary

| Threat | Defense | Layer |
|--------|---------|-------|
| **XSS token theft** | HttpOnly cookie — JS cannot read the credential | Server (Set-Cookie) |
| **CSRF (form-based)** | `SameSite=Strict` cookie + `Content-Type: application/json` enforcement | Server |
| **CSRF (XHR-based)** | `X-Requested-With: XMLHttpRequest` required header | Client + Server |
| **Session persistence after browser close** | Session cookie (no Expires) + `sessionStorage` metadata | Browser |
| **Clickjacking** | `X-Frame-Options: DENY` response header | Server |
| **MIME sniffing** | `X-Content-Type-Options: nosniff` response header | Server |
| **Response caching** | `Cache-Control: no-store` response header | Server |

---

## Error Handling Summary

| Layer | Mechanism | Action |
|-------|-----------|--------|
| `HttpClient` | Detects 401/403 response status | Clears token, dispatches `auth-error` event, throws error |
| `authMiddleware` | Listens for `auth-error` window event | Dispatches `clearAuthToken()` to Redux |
| `tokenValidationMiddleware` | Checks token age on auth-related actions | Clears auth if token > 24 hours old |
| `HttpRequestAgent.login()` | Catches any login error | Always clears token for clean state |
| `AuthSlice` rejected reducers | Redux state update on thunk failure | Resets `token`, `isAuthenticated`, `user` |
| `LoginPage` | Reads `error` from Redux state | Displays user-friendly error message |
| `ErrorHandlingService` | Maps HTTP status codes to messages | `401/403` → "Invalid username or password", network error → "Unable to connect to ESP32 device", `429` → "Too many requests", `500` → "ESP32 server error" |

---

## API Endpoints

| Endpoint | Method | Auth Required | Purpose |
|----------|--------|:---:|---------|
| `/api/login` | POST | No | Authenticate user, return JWT + user info |
| `/api/logout` | POST | Yes | Invalidate server session |
| `/api/validate-token` | GET | Yes | Validate stored token, return user info |
| `/api/refresh-token` | POST | Yes | Refresh an expiring token |
| `/api/status` | GET | No | System status |
| `/api/health` | GET | No | Health check |

### Login Request / Response

```
POST /api/login
Content-Type: application/json

{
  "username": "admin",
  "password": "password123"
}
```

**Success (200)**:
```json
{
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": { "username": "admin", "role": "admin" },
  "message": "Login successful"
}
```

**Failure**: `400` / `401` / `429` / `500` with error detail.

---

## i18n Strings (Authentication)

| Key | English Value |
|-----|---------------|
| `auth.username` | Username |
| `auth.password` | Password |
| `auth.connect` | Connect |
| `auth.connecting` | Connecting... |
| `auth.logout` | Logout |
| `auth.usernameRequired` | Username is required |
| `auth.passwordRequired` | Password is required |
| `auth.welcome` | Hi, {name} |
| `auth.initConnection` | Initializing ESP32 Connection... |
| `auth.toggleDarkMode` | Toggle dark mode |
| `auth.showPassword` | Show password |
| `auth.hidePassword` | Hide password |

---

## Security Patterns

- **Token injection**: Only on non-public endpoints; login requests use `skipAuth: true`
- **Clean state on failure**: Token is always cleared from `localStorage` on login failure, 401/403, or logout
- **JSON structure validation**: `getStoredToken()` validates parsed object has a `token` field; corrupted data is auto-cleared
- **Multi-layer auth error handling**: HTTP layer → window event → Redux middleware → UI update
- **Best-effort logout**: Server is notified with a 5-second timeout, but local cleanup always runs
- **Token age tracking**: Timestamp stored alongside token enables client-side expiration checks (24-hour max)
- **No sensitive data in errors**: Error messages are user-friendly, no token/credential leaks
