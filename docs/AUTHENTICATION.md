# Authentication System Documentation

## Architecture Overview

The authentication system is a **5-layer architecture**:

| Layer | File | Responsibility |
|-------|------|----------------|
| **UI** | `src/features/Auth/components/LoginPage.jsx` | User input, form validation, error display |
| **State** | `src/features/Auth/AuthSlice.js` | Redux state management (token, user, flags) |
| **Service** | `src/services/AuthService.js` / `src/utils/HttpRequestAgent.js` | Business logic, credential validation |
| **HTTP** | `src/utils/HttpClient.js` | Automatic token injection, auth error detection |
| **Storage** | `src/utils/TokenManager.js` | Persistent token storage in `localStorage` |

Supporting files:

- `src/types/auth.js` — JSDoc type definitions (`AuthState`, `UserInfo`, `LoginCredentials`, `TokenData`, etc.)
- `src/config/apiConfig.js` — API endpoints, public endpoint list, error messages, request configuration
- `src/middleware/authMiddleware.js` — Redux middleware for auth error events and token expiration checks

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
  │  skipAuth=true → no Bearer token injected
  │  POST /api/login  { username, password }
  ▼
ESP32 Server responds
  │  { token: "eyJhbG...", user: { username, role }, message: "Login successful" }
  ▼
HttpRequestAgent.login()
  │  Validates response (token must exist)
  │  TokenManager.storeToken(token)
  ▼
TokenManager.storeToken()
  │  localStorage['esp32_auth_token'] = JSON.stringify({ token, timestamp: Date.now() })
  ▼
AuthSlice: loginUser.fulfilled
  │  state.token = token
  │  state.isAuthenticated = true
  │  state.user = { username, role }
  ▼
AuthGuard.jsx re-renders
  │  isAuthenticated === true → show main app
  ▼
User sees Dashboard
```

### On Failure

- `HttpRequestAgent.login()` **always** calls `TokenManager.clearStoredToken()` on any error to ensure clean state.
- The error propagates through the Redux thunk to `loginUser.rejected`, which resets `token`, `isAuthenticated`, and `user` to `null`/`false`.
- `LoginPage.jsx` reads the `error` from Redux state and displays it to the user.

---

## App Startup / Token Restoration

When the app first loads, `AuthGuard.jsx` dispatches `initializeAuth()`:

1. A loading spinner is shown while `isInitializing` is `true` (message: "Initializing ESP32 Connection...").
2. `TokenManager.getStoredToken()` checks if a token exists in `localStorage`.
3. If a token exists → `HttpRequestAgent.validateToken()` sends `GET /api/validate-token` with the stored Bearer token.
4. If the server confirms validity → Redux state is restored (`isAuthenticated = true`, user info populated).
5. If invalid or network error → token is cleared from `localStorage`, user sees the login page.
6. `isInitializing` transitions from `true` → `false`.

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
Has stored token?
  ├─ NO  → return { token: null, user: null } → show LoginPage
  ├─ YES → GET /api/validate-token
  │          ├─ 200 OK   → return { token, user } → show main app
  │          └─ Error/401 → clearStoredToken() → show LoginPage
```

---

## Subsequent API Requests

Every HTTP request goes through `HttpClient.request()`:

1. Checks if the request is **not** a login request and `skipAuth` is not set.
2. Reads the token via `TokenManager.getStoredToken()`.
3. Injects `Authorization: Bearer <token>` header.
4. If the endpoint requires auth but no token is available → throws `Authentication required but no token available`.
5. If the response status is `401` or `403`:
   - Clears the token from `localStorage`.
   - Dispatches a `CustomEvent('auth-error')` on `window`.
   - Throws an `Authentication failed` error.

The **authMiddleware** (Redux middleware) listens for the `auth-error` window event and dispatches `clearAuthToken()` to reset Redux state, forcing the user back to the login page.

```
Any API call (e.g., GET /api/schedule/settings)
  │
  ▼
HttpClient.request()
  │  token = TokenManager.getStoredToken()
  │  headers.Authorization = "Bearer <token>"
  ▼
fetch(url, { headers })
  │
  ├─ 200 OK → return response data
  │
  └─ 401/403
       │  TokenManager.clearStoredToken()
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
2. `HttpRequestAgent.logout()` attempts `POST /api/logout` (best effort, 5s timeout).
3. **Regardless of server response**, `TokenManager.clearStoredToken()` removes the token from `localStorage`.
4. Redux state is reset: `token = null`, `isAuthenticated = false`, `user = null`.
5. AuthGuard re-renders → shows `LoginPage`.

Even if `logoutUser` is rejected (server error), the Redux reducer still clears all local auth state.

---

## Public vs Protected Endpoints

Defined in `src/config/apiConfig.js`:

| Public (no token needed) | Protected (token required) |
|---|---|
| `/api/login` | `/api/schedule/*` |
| `/api/health` | `/api/bell/*` |
| `/api/status` | `/api/system/*` |
| `/api/wifi/status` | `/api/logout` |
| `/api/wifi/networks` | `/api/validate-token` |
| `/api/wifi/config` | `/api/refresh-token` |

---

## TokenManager — Detailed Reference

**File**: `src/utils/TokenManager.js`  
**Storage key**: `esp32_auth_token`  
**Singleton**: Exported as a single instance (`export default new TokenManager()`)

### Storage Format

The token is stored in `localStorage` as a JSON string:

```json
{
  "token": "eyJhbGciOiJIUzI1NiIs...",
  "timestamp": 1709011200000
}
```

- `token` — The JWT/session token string received from the ESP32 server.
- `timestamp` — `Date.now()` at the moment of storage, used for age/expiration checks.

### Methods

| Method | Signature | Returns | Description |
|--------|-----------|---------|-------------|
| **storeToken** | `storeToken(token: string)` | `boolean` | Validates the token (must be a non-empty string), wraps it with a `timestamp`, and stores as JSON in `localStorage`. Returns `false` on failure. |
| **getStoredToken** | `getStoredToken()` | `string \| null` | Parses stored JSON, validates the structure (`parsed.token` must exist). Auto-clears corrupted/invalid data and returns `null`. |
| **getTokenData** | `getTokenData()` | `TokenData \| null` | Returns the full stored object `{ token, timestamp }`. Same validation and auto-cleanup as `getStoredToken()`. |
| **clearStoredToken** | `clearStoredToken()` | `boolean` | Removes the `esp32_auth_token` key from `localStorage`. Returns `false` if removal fails. |
| **hasStoredToken** | `hasStoredToken()` | `boolean` | Convenience wrapper: `!!this.getStoredToken()`. |
| **isStorageAvailable** | `isStorageAvailable()` | `boolean` | Tests `localStorage` read/write with a temporary key (`__storage_test__`). |
| **getTokenAge** | `getTokenAge()` | `number \| null` | Returns `Date.now() - timestamp` in milliseconds, or `null` if no token is stored. |
| **isTokenExpired** | `isTokenExpired(maxAge: number)` | `boolean` | Returns `true` if `getTokenAge() > maxAge`. Used by the `tokenValidationMiddleware` with a 24-hour max age (86,400,000 ms). |

### Error Resilience

| Scenario | Behavior |
|----------|----------|
| Invalid JSON in `localStorage` | Caught by `JSON.parse`, token is auto-cleared via `clearStoredToken()`, returns `null` |
| Missing `token` field in parsed object | Treated as invalid, auto-cleared, returns `null` |
| `null`, `undefined`, or non-string passed to `storeToken()` | Throws `'Invalid token provided'`, returns `false` |
| `localStorage` unavailable (e.g., private browsing) | `isStorageAvailable()` returns `false`; all read/write operations are wrapped in try-catch and fail gracefully |

### Token Lifecycle

```
Login success
  └─→ storeToken(token)           — stores { token, timestamp }

Every API request
  └─→ getStoredToken()             — reads token, validates JSON structure
  └─→ injected as Authorization: Bearer <token>

401/403 response
  └─→ clearStoredToken()           — removes from localStorage

App startup
  └─→ getStoredToken()             — checks for existing token
  └─→ server validates via GET /api/validate-token

Token age check (middleware)
  └─→ isTokenExpired(86400000)     — 24-hour expiration check

Logout
  └─→ clearStoredToken()           — always clears, even if server logout fails
```

---

## Redux Auth State

### State Shape (`src/features/Auth/AuthSlice.js`)

```javascript
{
  token: null,              // JWT/session token string from server
  isAuthenticated: false,   // Derived from token presence
  isLoading: false,         // True during login/logout API calls
  isInitializing: true,     // True during app startup token validation
  error: null,              // Error message string or null
  user: null                // { username, email?, role?, displayName? }
}
```

### Async Thunks

| Thunk | Trigger | Success | Failure |
|-------|---------|---------|---------|
| `loginUser(credentials)` | Login form submit | Sets token, user, `isAuthenticated = true` | Clears all auth state, sets `error` |
| `logoutUser()` | Logout button click | Clears all auth state | Clears all auth state + sets `error` |
| `initializeAuth()` | App mount (`AuthGuard`) | Restores token + user if valid | Clears all auth state |

### Synchronous Reducers

| Reducer | Purpose |
|---------|---------|
| `clearAuthError()` | Clears the `error` field |
| `clearAuthToken()` | Resets `token`, `isAuthenticated`, `user` and calls `TokenManager.clearStoredToken()` |
| `setAuthFromToken({ token, user })` | Sets auth state from external source (e.g., middleware) |

---

## Redux Middleware

Two middlewares registered in `src/app/store.js`:

### 1. `authMiddleware`

Listens for `auth-error` `CustomEvent` on `window` (dispatched by `HttpClient` on 401/403). On receiving the event, dispatches `clearAuthToken()` to force a full logout in Redux state. The listener is set up only once (guarded by `window.__authErrorListenerSet`).

### 2. `tokenValidationMiddleware`

Runs after `loginUser/fulfilled` and `initializeAuth/fulfilled` actions. Checks `TokenManager.isTokenExpired(24 * 60 * 60 * 1000)` — if the token is older than 24 hours, dispatches `clearAuthToken()` to force re-authentication.

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

AuthGuard wraps the entire application. No protected route is accessible without a valid token confirmed by the server.

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
