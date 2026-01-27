# Design Document

## Overview

The ESP32 Authentication System is a React-based web application that provides secure user authentication for ESP32 web servers. The system leverages the existing Redux Toolkit architecture and follows the established patterns in the current codebase. It implements token-based authentication with automatic token management, session persistence, and optimized builds for ESP32 deployment.

The design integrates seamlessly with the existing Vite build system and compression pipeline, ensuring minimal impact on the ESP32's limited storage and processing capabilities.

## Architecture

The authentication system follows a layered architecture that separates concerns and maintains the existing project patterns:

### Presentation Layer
- **LoginPage Component**: Handles user credential input and login form submission
- **HomePage Component**: Main application interface accessible after authentication
- **AuthGuard Component**: Route protection wrapper that manages authentication state
- **App Component**: Updated to handle authentication routing and state

### State Management Layer
- **AuthSlice**: Redux slice managing authentication state, tokens, and user session
- **Enhanced Store**: Extended Redux store configuration including authentication reducer

### Service Layer
- **AuthService**: Handles authentication API calls and token management
- **HttpClient**: Enhanced HTTP client with automatic token injection
- **TokenManager**: Utility for secure token storage and retrieval

### Infrastructure Layer
- **LocalStorage Integration**: Persistent token storage using browser localStorage
- **API Proxy Configuration**: Vite proxy setup for ESP32 server communication
- **Build Optimization**: Compression and bundling for ESP32 deployment

## Components and Interfaces

### AuthSlice Interface
```javascript
interface AuthState {
  token: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;
  user: UserInfo | null;
}

interface UserInfo {
  username: string;
  // Additional user fields as needed
}
```

### AuthService Interface
```javascript
interface AuthService {
  login(credentials: LoginCredentials): Promise<AuthResponse>;
  logout(): void;
  getStoredToken(): string | null;
  clearStoredToken(): void;
}

interface LoginCredentials {
  username: string;
  password: string;
}

interface AuthResponse {
  token: string;
  user: UserInfo;
}
```

### HttpClient Interface
```javascript
interface HttpClient {
  get(url: string, options?: RequestOptions): Promise<Response>;
  post(url: string, data: any, options?: RequestOptions): Promise<Response>;
  // Other HTTP methods as needed
}

interface RequestOptions {
  headers?: Record<string, string>;
  skipAuth?: boolean; // For login requests
}
```

## Data Models

### Authentication State Model
The authentication state follows Redux Toolkit patterns established in the existing AppSlice:

```javascript
const initialAuthState = {
  token: null,           // JWT or session token from server
  isAuthenticated: false, // Computed from token presence and validity
  isLoading: false,      // For login/logout operations
  error: null,           // Authentication error messages
  user: null             // User information from login response
};
```

### Token Storage Model
Tokens are stored in localStorage with a consistent key structure:
- Key: `esp32_auth_token`
- Value: JSON string containing token and metadata
- Expiration: Handled by server-side token validation

### API Request Model
All authenticated requests follow this pattern:
```javascript
{
  headers: {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json'
  }
}
```

## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system-essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

### Property Reflection

After reviewing all properties identified in the prework, several can be consolidated to eliminate redundancy:

- Properties 1.2 and 2.1 both test token storage and can be combined
- Properties 1.3, 2.3, and 4.2 all test navigation behavior and can be consolidated into navigation properties
- Properties 3.3 and 3.4 both handle auth error responses and can be combined
- Properties 2.2 and 2.4 test startup behavior and can be combined into initialization properties

The following properties provide unique validation value and will be implemented:

Property 1: Login request generation
*For any* valid credentials, submitting the login form should generate an HTTP POST request to the login endpoint with the correct credential data
**Validates: Requirements 1.1**

Property 2: Token storage on successful authentication
*For any* successful authentication response containing a token, the system should store that token in localStorage and update the authentication state
**Validates: Requirements 1.2, 2.1**

Property 3: Navigation after authentication state changes
*For any* authentication state change (login success, logout, token expiration), the system should navigate to the appropriate page (Home for authenticated, Login for unauthenticated)
**Validates: Requirements 1.3, 2.3, 2.5, 4.2**

Property 4: Error handling for authentication failures
*For any* authentication failure (invalid credentials, network errors, server errors), the system should display appropriate error messages and remain in the correct state
**Validates: Requirements 1.4, 1.5**

Property 5: Application initialization with existing tokens
*For any* application startup state (with or without stored tokens), the system should check localStorage and initialize authentication state correctly
**Validates: Requirements 2.2, 2.4**

Property 6: Automatic token injection in authenticated requests
*For any* HTTP request (except login), when authenticated, the system should include the Authorization header with Bearer token format
**Validates: Requirements 3.1, 3.5**

Property 7: Request blocking when unauthenticated
*For any* HTTP request (except login), when not authenticated, the system should block the request or handle it appropriately
**Validates: Requirements 3.2**

Property 8: Token cleanup on authentication errors
*For any* server response indicating authentication failure (401, 403), the system should clear stored tokens and redirect to login
**Validates: Requirements 3.3, 3.4**

Property 9: Complete logout cleanup
*For any* logout action, the system should remove all authentication data (token, user info) from both state and localStorage
**Validates: Requirements 4.1, 4.3, 4.4**

## Error Handling

The authentication system implements comprehensive error handling following the established patterns in the existing codebase:

### Network Errors
- Connection timeouts and network failures display user-friendly messages
- Retry mechanisms for transient network issues
- Graceful degradation when ESP32 server is unreachable

### Authentication Errors
- Invalid credentials result in clear error messages without exposing security details
- Token expiration triggers automatic logout and redirection
- Server authentication errors (401/403) clear stored tokens and redirect to login

### Validation Errors
- Client-side validation for required fields and input formats
- Server-side validation errors are displayed with specific field feedback
- Form state management prevents invalid submissions

### Storage Errors
- localStorage availability checks with fallback to session-only authentication
- Graceful handling of storage quota exceeded scenarios
- Automatic cleanup of corrupted or invalid stored data

## Testing Strategy

The authentication system employs a dual testing approach combining unit tests and property-based tests to ensure comprehensive coverage and correctness.

### Unit Testing Approach
Unit tests will verify specific examples, edge cases, and integration points:
- Login form submission with specific credential combinations
- Token storage and retrieval with known values
- Navigation behavior for specific authentication state transitions
- Error display for specific failure scenarios
- Component rendering with various authentication states

### Property-Based Testing Approach
Property-based tests will verify universal properties across all valid inputs using **fast-check** library for JavaScript:
- Each property-based test will run a minimum of 100 iterations to ensure thorough coverage
- Tests will generate random but valid inputs to verify system behavior across the entire input space
- Each property test will be tagged with comments explicitly referencing the correctness property from this design document
- Property tests will use the format: **Feature: esp32-auth-system, Property {number}: {property_text}**

### Testing Requirements
- All correctness properties must be implemented as property-based tests
- Each correctness property will be implemented by a single property-based test
- Unit tests and property tests are complementary and both must be included
- Tests will focus on core functional logic and important edge cases
- Property-based tests will validate universal behaviors that should hold across all inputs
- Unit tests will catch concrete bugs and verify specific integration scenarios

### Test Organization
- Authentication slice tests: `src/features/Auth/AuthSlice.test.js`
- Authentication service tests: `src/services/AuthService.test.js`
- HTTP client tests: `src/utils/HttpClient.test.js`
- Component tests: `src/features/Auth/components/*.test.jsx`
- Property-based tests: `src/features/Auth/__tests__/properties.test.js`

The testing strategy ensures that both specific examples work correctly (unit tests) and that general correctness properties hold across all possible inputs (property-based tests), providing comprehensive validation of the authentication system's behavior.