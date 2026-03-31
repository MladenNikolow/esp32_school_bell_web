// src/config/apiConfig.js

/**
 * API configuration for ESP32 authentication system
 */
export const API_CONFIG = {
  // Base configuration
  BASE_URL: '', // Empty for relative URLs to current ESP32 host
  TIMEOUT: 10000, // 10 seconds default timeout
  
  // Authentication endpoints
  ENDPOINTS: {
    LOGIN: '/api/login',
    LOGOUT: '/api/logout',
    VALIDATE_TOKEN: '/api/validate-token',
    REFRESH_TOKEN: '/api/refresh-token',
    
    // Application endpoints
    STATUS: '/api/status',
    HEALTH: '/api/health',

    // WiFi configuration endpoints
    WIFI_STATUS: '/api/wifi/status',
    WIFI_NETWORKS: '/api/wifi/networks',
    WIFI_CONFIG: '/api/wifi/config',

    // Schedule endpoints
    SCHEDULE_SETTINGS: '/api/schedule/settings',
    SCHEDULE_BELLS: '/api/schedule/bells',
    SCHEDULE_HOLIDAYS: '/api/schedule/holidays',
    SCHEDULE_EXCEPTIONS: '/api/schedule/exceptions',
    SCHEDULE_TEMPLATES: '/api/schedule/templates',
    BELL_STATUS: '/api/bell/status',
    BELL_PANIC: '/api/bell/panic',
    BELL_TEST: '/api/bell/test',

    // System endpoints
    SYSTEM_TIME: '/api/system/time',
    SYSTEM_INFO: '/api/system/info',
    SYSTEM_REBOOT: '/api/system/reboot',
    SYSTEM_FACTORY_RESET: '/api/system/factory-reset',
    SYSTEM_SYNC_TIME: '/api/system/sync-time',
    SYSTEM_PIN: '/api/system/pin',
    SCHEDULE_DEFAULTS: '/api/schedule/defaults',
  },
  
  // Public endpoints that don't require authentication
  PUBLIC_ENDPOINTS: [
    '/api/login',
    '/api/validate-token',
    '/api/health',
    '/api/status',
    '/api/wifi/status',
    '/api/wifi/networks',
    '/api/wifi/config',
  ],
  
  // HTTP status codes
  STATUS_CODES: {
    OK: 200,
    CREATED: 201,
    BAD_REQUEST: 400,
    UNAUTHORIZED: 401,
    FORBIDDEN: 403,
    NOT_FOUND: 404,
    CONFLICT: 409,
    TOO_MANY_REQUESTS: 429,
    INTERNAL_SERVER_ERROR: 500,
    SERVICE_UNAVAILABLE: 503,
  },
  
  // Request configuration
  REQUEST_CONFIG: {
    DEFAULT_HEADERS: {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
    },
    
    // Retry configuration
    MAX_RETRIES: 2,
    RETRY_DELAY: 1000, // 1 second
    
    // Authentication is handled via HttpOnly session cookies.
    // The browser sends the cookie automatically with credentials: 'same-origin'.
    
    // ESP32 specific optimizations
    KEEP_ALIVE: false, // ESP32 may not support keep-alive well
    CACHE: 'no-cache', // Prevent caching issues on ESP32
  },
  
  // Error messages
  ERROR_MESSAGES: {
    NETWORK_ERROR: 'Unable to connect to ESP32 device',
    TIMEOUT_ERROR: 'Request timed out - ESP32 may be busy',
    AUTH_REQUIRED: 'Authentication required',
    INVALID_CREDENTIALS: 'Invalid username or password',
    TOKEN_EXPIRED: 'Session expired - please log in again',
    SERVER_ERROR: 'ESP32 server error - please try again',
    RATE_LIMITED: 'Too many requests - please wait before trying again',
  },
};

/**
 * Get full URL for an endpoint
 * @param {string} endpoint - Endpoint path
 * @returns {string} Full URL
 */
export function getApiUrl(endpoint) {
  return `${API_CONFIG.BASE_URL}${endpoint}`;
}

/**
 * Check if endpoint is public (doesn't require auth)
 * @param {string} endpoint - Endpoint to check
 * @returns {boolean} True if public endpoint
 */
export function isPublicEndpoint(endpoint) {
  return API_CONFIG.PUBLIC_ENDPOINTS.some(publicEndpoint => 
    endpoint.includes(publicEndpoint)
  );
}

/**
 * Get error message for HTTP status code
 * @param {number} status - HTTP status code
 * @param {string} [defaultMessage] - Default message if no specific message found
 * @returns {string} Error message
 */
export function getErrorMessage(status, defaultMessage = 'Request failed') {
  switch (status) {
    case API_CONFIG.STATUS_CODES.BAD_REQUEST:
      return 'Invalid request data';
    case API_CONFIG.STATUS_CODES.UNAUTHORIZED:
      return API_CONFIG.ERROR_MESSAGES.INVALID_CREDENTIALS;
    case API_CONFIG.STATUS_CODES.FORBIDDEN:
      return 'Access denied';
    case API_CONFIG.STATUS_CODES.NOT_FOUND:
      return 'Requested resource not found';
    case API_CONFIG.STATUS_CODES.CONFLICT:
      return 'Request conflicts with current state';
    case API_CONFIG.STATUS_CODES.TOO_MANY_REQUESTS:
      return API_CONFIG.ERROR_MESSAGES.RATE_LIMITED;
    case API_CONFIG.STATUS_CODES.INTERNAL_SERVER_ERROR:
      return API_CONFIG.ERROR_MESSAGES.SERVER_ERROR;
    case API_CONFIG.STATUS_CODES.SERVICE_UNAVAILABLE:
      return 'Service temporarily unavailable';
    default:
      return defaultMessage;
  }
}

/**
 * Create request configuration with ESP32 optimizations
 * @param {Object} options - Additional options
 * @returns {Object} Request configuration
 */
export function createRequestConfig(options = {}) {
  return {
    ...API_CONFIG.REQUEST_CONFIG.DEFAULT_HEADERS,
    cache: API_CONFIG.REQUEST_CONFIG.CACHE,
    keepalive: API_CONFIG.REQUEST_CONFIG.KEEP_ALIVE,
    ...options,
  };
}

/**
 * Validate API response structure
 * @param {Response} response - Fetch response
 * @param {Object} data - Parsed response data
 * @returns {boolean} True if response is valid
 */
export function validateApiResponse(response, data) {
  // Basic response validation
  if (!response.ok) {
    return false;
  }
  
  // Check for required fields in auth responses
  // Token is now set via HttpOnly cookie; JSON body only needs user info
  if (response.url.includes(API_CONFIG.ENDPOINTS.LOGIN)) {
    return !!(data && data.user);
  }
  
  // Check for required fields in validation responses
  if (response.url.includes(API_CONFIG.ENDPOINTS.VALIDATE_TOKEN)) {
    return !!(data && typeof data.valid !== 'undefined');
  }
  
  return true;
}

export default API_CONFIG;