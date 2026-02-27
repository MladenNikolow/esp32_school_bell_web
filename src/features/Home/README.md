# Home Feature

This folder contains the main application home page that users see after successful authentication.

## Structure

```
Home/
├── HomePage.jsx       # Main home page component with device control
├── HomePage.css       # Styling for home page
└── README.md         # This file
```

## HomePage Component

The HomePage component provides:
- Device control panel with mode settings
- Connection status indicators
- User information display
- Logout functionality
- Integration with existing mode control from AppSlice

## Dependencies

- **Auth**: Uses `logoutUser` action from `../Auth/AuthSlice.js`
- **App**: Uses mode control actions from `../App/AppSlice.jsx`
- **Redux**: Connected to both `auth` and `mode` state slices

## Usage

The HomePage is automatically rendered by the AuthGuard component when the user is authenticated. It should not be imported or used directly outside of the authentication flow.

```jsx
// Used in AuthGuard.jsx
import HomePage from '../../Home/HomePage.jsx';

// Rendered when authenticated
return isAuthenticated ? <HomePage /> : <LoginPage />;
```

## Features

1. **Device Status**: Real-time connection status with visual indicators
2. **Mode Control**: Input field and save button for device mode configuration
3. **User Info**: Displays logged-in user information
4. **Logout**: Secure logout with proper state cleanup
5. **Error Handling**: Displays and dismisses error messages
6. **Responsive Design**: Mobile-friendly layout

## State Management

The component connects to two Redux slices:
- `state.auth` - Authentication state (user, isLoading)
- `state.mode` - Device mode state (value, connected, loading, saving, error)
