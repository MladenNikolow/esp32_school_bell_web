# Copilot Project Instructions

## Project Overview

This is the **ESP32 School Bell Web UI** — a React + Redux Toolkit frontend that runs on an ESP32 microcontroller. It controls a school bell system with schedules, holidays, exceptions, and device settings.

## Tech Stack

- **React** (JSX) with **Vite** as build tool
- **Redux Toolkit** for state management (slices, async thunks, middleware)
- **Vanilla CSS** — no CSS framework
- **JSDoc** for type definitions (no TypeScript)
- **Vitest** for testing

## Project Structure

Feature-based organization under `src/features/`:

- `Auth/` — Login, logout, token validation, route protection (AuthGuard)
- `Dashboard/` — Device status and clock
- `Schedule/` — Bell times, holidays, exceptions, settings
- `Calendar/` — Calendar view
- `Settings/` — Device settings (WiFi, system)
- `Navigation/` — App navigation
- `Home/` — Home page
- `App/` — Root app component

Shared layers:

- `src/services/` — Business logic (AuthService, ErrorHandlingService, ScheduleService)
- `src/utils/` — HTTP client, token management, form validation
- `src/middleware/` — Redux middleware (auth error handling, token expiration)
- `src/config/` — API endpoints and configuration
- `src/types/` — JSDoc type definitions
- `src/hooks/` — Custom React hooks (useLocale, useTheme)
- `src/i18n/` — Internationalization (English, Bulgarian)

## Authentication System

The auth system uses **HttpOnly session cookies** — documented in detail in `docs/AUTHENTICATION.md`. Key points:

- Server sets `Set-Cookie: session=<token>; HttpOnly; SameSite=Strict; Path=/` on login (no Expires = session cookie, cleared on browser close)
- Browser sends the cookie automatically via `credentials: 'same-origin'` — JavaScript never reads the credential
- `TokenManager` stores auth *metadata* in `sessionStorage` under key `esp32_auth_meta` (`{ authenticated, timestamp }`) — UI hint only
- `HttpClient` adds `X-Requested-With: XMLHttpRequest` on POST/PUT/DELETE for CSRF defense
- Firmware enforces `Content-Type: application/json` + `X-Requested-With: XMLHttpRequest` on all state-changing endpoints
- 401/403 responses trigger automatic session metadata cleanup and redirect to login
- `AuthGuard` wraps the app — validates session cookie with server on startup
- Two Redux middlewares: `authMiddleware` (auth-error events) and `tokenValidationMiddleware` (24h session age check)

## API Communication

- All endpoints defined in `src/config/apiConfig.js`
- `HttpClient` (singleton) handles raw fetch with cookie-based auth (`credentials: 'same-origin'`)
- `HttpRequestAgent` (singleton) provides higher-level methods (get, post, login, logout, validateToken)
- Public endpoints (no auth): `/api/login`, `/api/health`, `/api/status`, `/api/wifi/*`
- Protected endpoints require a valid session cookie (sent automatically by browser)
- CSRF defense: POST/PUT/DELETE require `Content-Type: application/json` + `X-Requested-With: XMLHttpRequest`
- API specification: `ESP32_API_Specification.md` (cookie auth, CSRF, security headers)

## Conventions

- Singleton pattern for services: `export default new ClassName()`
- Redux slices use `createAsyncThunk` for API calls
- Error messages are user-friendly via `ErrorHandlingService`
- i18n keys follow `feature.key` pattern (e.g., `auth.username`, `schedule.bellTimes`)
- Form validation in `src/utils/formValidation.js`
- CSS files are co-located with components

## Documentation

- `docs/AUTHENTICATION.md` — Full authentication system documentation
- `docs/PROJECT_STRUCTURE.md` — File organization and data flow
- `docs/ESP32_API_Specification.md` — Complete API endpoint reference
- `REFACTORING_SUMMARY.md` — Refactoring history

## Post-Task Rule

After completing any task, **always ask the user** whether the project documentation and Copilot instructions should be updated to reflect the changes made. Specifically check if any of the following need updates:

- `docs/AUTHENTICATION.md` — if auth, token, HTTP, or middleware logic changed
- `docs/.instructions.md` — if key files, patterns, or conventions changed
- `.github/copilot-instructions.md` — if project structure, tech stack, or conventions changed
- `docs/PROJECT_STRUCTURE.md` — if files were added, moved, or removed
- `docs/ESP32_API_Specification.md` — if API endpoints or request/response formats changed
