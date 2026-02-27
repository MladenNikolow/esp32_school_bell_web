# Auth Feature

This folder contains all authentication-related components, logic, and state management.

## Structure

```
Auth/
├── components/
│   ├── LoginPage.jsx          # Login form component
│   ├── LoginPage.css          # Login page styling
│   ├── AuthGuard.jsx          # Route protection component
│   ├── AuthGuard.css          # Loading screen styling
│   └── __tests__/
│       └── LoginPage.test.jsx # Login page tests
├── AuthSlice.js               # Redux slice for auth state
└── README.md                  # This file
```

## Components

### LoginPage
The main login interface with:
- Username and password input fields
- Form validation with real-time feedback
- Password visibility toggle
- Loading states during authentication
- Error message display
- Touch-friendly, ESP32-optimized design

### AuthGuard
Route protection component that:
- Initializes authentication on app startup
- Shows loading screen during initialization
- Renders LoginPage for unauthenticated users
- Renders HomePage for authenticated users
- Handles automatic routing based on auth state

## Redux State (AuthSlice)

### State Shape
```javascript
{
  token: string | null,           // JWT token
  isAuthenticated: boolean,       // Auth status
  isLoading: boolean,            // Login/logout in progress
  isInitializing: boolean,       // App startup auth check
  error: string | null,          // Error messages
  user: object | null            // User information
}
```

### Actions
- `loginUser(credentials)` - Authenticate user
- `logoutUser()` - Log out and clear session
- `initializeAuth()` - Check for existing session on startup
- `clearAuthError()` - Clear error messages
- `clearAuthToken()` - Clear auth state (for 401/403 errors)
- `setAuthFromToken(payload)` - Set auth from external source

### Async Thunks
All authentication operations are handled through async thunks that integrate with:
- `HttpRequestAgent` for API calls
- `TokenManager` for token storage
- `ErrorHandlingService` for consistent error handling

## Integration Points

### Services Used
- `HttpRequestAgent` - HTTP requests with automatic token injection
- `TokenManager` - localStorage token management
- `ErrorHandlingService` - Error processing and user messages

### External Dependencies
- **Home Feature**: AuthGuard renders HomePage after authentication
- **Redux Store**: Auth state is available globally via `state.auth`
- **Middleware**: Auth middleware handles token cleanup on errors

## Authentication Flow

1. **App Startup**:
   - AuthGuard calls `initializeAuth()`
   - Checks localStorage for existing token
   - Validates token with server
   - Routes to HomePage if valid, LoginPage if not

2. **Login**:
   - User submits credentials via LoginPage
   - `loginUser()` action sends request to `/api/login`
   - Token stored in localStorage on success
   - User redirected to HomePage

3. **Logout**:
   - User clicks logout button
   - `logoutUser()` action notifies server
   - Token cleared from localStorage
   - User redirected to LoginPage

4. **Token Expiration**:
   - HTTP client detects 401/403 responses
   - Dispatches `clearAuthToken()` action
   - User automatically redirected to LoginPage

## Usage

### In App.jsx
```jsx
import AuthGuard from '../Auth/components/AuthGuard.jsx';

export default function App() {
  return <AuthGuard />;
}
```

### Accessing Auth State
```jsx
import { useSelector } from 'react-redux';

function MyComponent() {
  const { isAuthenticated, user } = useSelector(state => state.auth);
  // Use auth state...
}
```

### Logout Action
```jsx
import { useDispatch } from 'react-redux';
import { logoutUser } from '../Auth/AuthSlice.js';

function MyComponent() {
  const dispatch = useDispatch();
  
  const handleLogout = async () => {
    await dispatch(logoutUser()).unwrap();
  };
}
```

## Security Features

- JWT token-based authentication
- Automatic token injection in API requests
- Token validation on app startup
- Secure token storage in localStorage
- Automatic cleanup on authentication errors
- CSRF protection through token-based auth
- Input validation and sanitization

## Testing

Tests are located in `components/__tests__/` and cover:
- Form validation
- User interactions
- Loading states
- Error handling
- Accessibility features
