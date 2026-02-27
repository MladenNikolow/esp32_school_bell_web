# ESP32 Authentication System - Project Structure

## 📁 Feature Organization

The project is organized into separate feature folders with clear separation of concerns:

```
src/
├── features/
│   ├── Auth/                          # 🔐 Authentication Feature
│   │   ├── components/
│   │   │   ├── LoginPage.jsx         # Login form UI
│   │   │   ├── LoginPage.css         # Login styling
│   │   │   ├── AuthGuard.jsx         # Route protection
│   │   │   ├── AuthGuard.css         # Loading screen
│   │   │   └── __tests__/
│   │   │       └── LoginPage.test.jsx
│   │   ├── AuthSlice.js              # Auth state management
│   │   └── README.md
│   │
│   ├── Home/                          # 🏠 Home Feature
│   │   ├── HomePage.jsx              # Main app interface
│   │   ├── HomePage.css              # Home styling
│   │   └── README.md
│   │
│   └── App/                           # 📱 App Feature (existing)
│       ├── App.jsx                   # Main app component
│       └── AppSlice.jsx              # Mode control state
│
├── services/                          # 🔧 Services Layer
│   ├── AuthService.js                # Authentication API calls
│   ├── ErrorHandlingService.js       # Error processing
│   └── __tests__/
│       └── AuthService.test.js
│
├── utils/                             # 🛠️ Utilities
│   ├── HttpClient.js                 # HTTP client with auth
│   ├── HttpRequestAgent.js           # Request wrapper
│   ├── TokenManager.js               # Token storage
│   ├── authUtils.js                  # Auth helpers
│   ├── formValidation.js             # Form validation
│   └── __tests__/
│       └── integration.test.js
│
├── middleware/                        # ⚙️ Redux Middleware
│   └── authMiddleware.js             # Auth event handling
│
├── config/                            # ⚙️ Configuration
│   └── apiConfig.js                  # API endpoints & config
│
├── types/                             # 📝 Type Definitions
│   └── auth.js                       # JSDoc type definitions
│
└── app/                               # 🏪 Redux Store
    └── store.js                      # Store configuration
```

## 🔄 Data Flow

```
┌─────────────────────────────────────────────────────────────┐
│                         App.jsx                              │
│                            │                                 │
│                            ▼                                 │
│                      AuthGuard.jsx                           │
│                            │                                 │
│              ┌─────────────┴─────────────┐                  │
│              ▼                           ▼                   │
│         LoginPage.jsx              HomePage.jsx              │
│              │                           │                   │
└──────────────┼───────────────────────────┼──────────────────┘
               │                           │
               ▼                           ▼
        ┌──────────────┐          ┌──────────────┐
        │  AuthSlice   │          │  AppSlice    │
        │  (auth)      │          │  (mode)      │
        └──────┬───────┘          └──────┬───────┘
               │                         │
               └────────┬────────────────┘
                        ▼
                ┌───────────────┐
                │  Redux Store  │
                └───────┬───────┘
                        │
        ┌───────────────┼───────────────┐
        ▼               ▼               ▼
┌──────────────┐ ┌──────────────┐ ┌──────────────┐
│ AuthService  │ │ HttpRequest  │ │ TokenManager │
│              │ │   Agent      │ │              │
└──────┬───────┘ └──────┬───────┘ └──────┬───────┘
       │                │                │
       └────────────────┼────────────────┘
                        ▼
                ┌──────────────┐
                │  HttpClient  │
                └──────┬───────┘
                       │
                       ▼
                ┌──────────────┐
                │  ESP32 API   │
                └──────────────┘
```

## 🎯 Feature Responsibilities

### Auth Feature
**Purpose**: Handle all authentication logic
- User login/logout
- Token management
- Session validation
- Route protection
- Login UI

**Key Files**:
- `AuthSlice.js` - Redux state for authentication
- `LoginPage.jsx` - Login form component
- `AuthGuard.jsx` - Route protection wrapper

**Dependencies**:
- Services: AuthService, ErrorHandlingService
- Utils: HttpRequestAgent, TokenManager
- External: Home feature (for routing)

---

### Home Feature
**Purpose**: Main application interface after authentication
- Device control panel
- Mode management
- User information display
- Logout functionality

**Key Files**:
- `HomePage.jsx` - Main home component
- `HomePage.css` - Home page styling

**Dependencies**:
- Auth: `logoutUser` action
- App: Mode control actions
- Redux: Both `auth` and `mode` state

---

### App Feature
**Purpose**: Device mode control (existing functionality)
- Mode value management
- ESP32 communication
- Connection status

**Key Files**:
- `App.jsx` - Main app wrapper (now uses AuthGuard)
- `AppSlice.jsx` - Mode control state

**Dependencies**:
- Utils: HttpRequestAgent (for authenticated requests)
- Auth: Requires authentication for API calls

---

## 🔗 Integration Points

### Auth → Home
```javascript
// AuthGuard.jsx
import HomePage from '../../Home/HomePage.jsx';
return isAuthenticated ? <HomePage /> : <LoginPage />;
```

### Home → Auth
```javascript
// HomePage.jsx
import { logoutUser } from '../Auth/AuthSlice.js';
const handleLogout = () => dispatch(logoutUser());
```

### Home → App
```javascript
// HomePage.jsx
import { loadMode, updateMode } from '../App/AppSlice.jsx';
dispatch(loadMode());
dispatch(updateMode(value));
```

### All Features → Services
```javascript
// Any feature can use services
import AuthService from '../../services/AuthService.js';
import HttpRequestAgent from '../../utils/HttpRequestAgent.js';
```

---

## 🚀 Benefits of This Structure

1. **Separation of Concerns**: Auth logic is isolated from application logic
2. **Reusability**: Home feature can be used independently
3. **Maintainability**: Clear boundaries between features
4. **Testability**: Each feature can be tested in isolation
5. **Scalability**: Easy to add new features without affecting existing ones

---

## 📝 Adding New Features

To add a new feature:

1. Create folder in `src/features/YourFeature/`
2. Add component files and styling
3. Create Redux slice if needed (in feature folder)
4. Add to store configuration in `src/app/store.js`
5. Import and use in appropriate parent component
6. Document in feature README.md

Example:
```
src/features/Settings/
├── SettingsPage.jsx
├── SettingsPage.css
├── SettingsSlice.js
└── README.md
```

Then integrate:
```javascript
// In HomePage.jsx or AuthGuard.jsx
import SettingsPage from '../Settings/SettingsPage.jsx';
```
