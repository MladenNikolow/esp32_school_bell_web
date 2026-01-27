// src/services/ErrorHandlingService.js
import { API_CONFIG, getErrorMessage } from '../config/apiConfig.js';

/**
 * Centralized error handling service for authentication and API operations
 */
class ErrorHandlingService {
  /**
   * Handle authentication errors
   * @param {Error} error - Error object
   * @param {Object} context - Additional context
   * @returns {Object} Processed error information
   */
  handleAuthError(error, context = {}) {
    const errorInfo = {
      message: this.getAuthErrorMessage(error),
      type: this.getErrorType(error),
      shouldRetry: this.shouldRetryRequest(error),
      shouldClearAuth: this.shouldClearAuth(error),
      originalError: error,
      context,
    };

    // Log error for debugging (in development)
    if (process.env.NODE_ENV === 'development') {
      console.error('Auth Error:', errorInfo);
    }

    return errorInfo;
  }

  /**
   * Handle API request errors
   * @param {Error} error - Error object
   * @param {string} endpoint - API endpoint that failed
   * @returns {Object} Processed error information
   */
  handleApiError(error, endpoint) {
    const errorInfo = {
      message: this.getApiErrorMessage(error, endpoint),
      type: this.getErrorType(error),
      shouldRetry: this.shouldRetryRequest(error),
      endpoint,
      originalError: error,
    };

    // Log error for debugging
    if (process.env.NODE_ENV === 'development') {
      console.error('API Error:', errorInfo);
    }

    return errorInfo;
  }

  /**
   * Get user-friendly authentication error message
   * @param {Error} error - Error object
   * @returns {string} User-friendly message
   */
  getAuthErrorMessage(error) {
    const message = error.message || '';

    // Network errors
    if (this.isNetworkError(error)) {
      return API_CONFIG.ERROR_MESSAGES.NETWORK_ERROR;
    }

    // Timeout errors
    if (this.isTimeoutError(error)) {
      return API_CONFIG.ERROR_MESSAGES.TIMEOUT_ERROR;
    }

    // Authentication specific errors
    if (message.includes('401') || message.includes('Invalid username')) {
      return API_CONFIG.ERROR_MESSAGES.INVALID_CREDENTIALS;
    }

    if (message.includes('403') || message.includes('Access denied')) {
      return 'Access denied - insufficient permissions';
    }

    if (message.includes('429') || message.includes('Too many')) {
      return API_CONFIG.ERROR_MESSAGES.RATE_LIMITED;
    }

    if (message.includes('token') && message.includes('expired')) {
      return API_CONFIG.ERROR_MESSAGES.TOKEN_EXPIRED;
    }

    // Server errors
    if (message.includes('500') || message.includes('server error')) {
      return API_CONFIG.ERROR_MESSAGES.SERVER_ERROR;
    }

    // Default fallback
    return message || 'Authentication failed. Please try again.';
  }

  /**
   * Get user-friendly API error message
   * @param {Error} error - Error object
   * @param {string} endpoint - API endpoint
   * @returns {string} User-friendly message
   */
  getApiErrorMessage(error, endpoint) {
    const message = error.message || '';

    // Network errors
    if (this.isNetworkError(error)) {
      return API_CONFIG.ERROR_MESSAGES.NETWORK_ERROR;
    }

    // Timeout errors
    if (this.isTimeoutError(error)) {
      return API_CONFIG.ERROR_MESSAGES.TIMEOUT_ERROR;
    }

    // Endpoint-specific messages
    if (endpoint.includes('/mode')) {
      if (message.includes('401') || message.includes('403')) {
        return 'Authentication required to access device settings';
      }
      return 'Failed to communicate with device. Please check connection.';
    }

    // Generic API error handling
    if (message.includes('404')) {
      return 'Requested feature not available on this device';
    }

    if (message.includes('500')) {
      return 'Device error. Please try again or restart the device.';
    }

    return message || 'Request failed. Please try again.';
  }

  /**
   * Determine error type for categorization
   * @param {Error} error - Error object
   * @returns {string} Error type
   */
  getErrorType(error) {
    const message = error.message || '';

    if (this.isNetworkError(error)) return 'network';
    if (this.isTimeoutError(error)) return 'timeout';
    if (message.includes('401')) return 'unauthorized';
    if (message.includes('403')) return 'forbidden';
    if (message.includes('429')) return 'rate_limited';
    if (message.includes('500')) return 'server_error';
    if (message.includes('validation') || message.includes('Invalid')) return 'validation';
    
    return 'unknown';
  }

  /**
   * Check if error is a network connectivity issue
   * @param {Error} error - Error object
   * @returns {boolean} True if network error
   */
  isNetworkError(error) {
    const message = error.message || '';
    return (
      error.name === 'TypeError' && message.includes('fetch') ||
      message.includes('Network') ||
      message.includes('connection') ||
      message.includes('ECONNREFUSED') ||
      message.includes('ERR_NETWORK')
    );
  }

  /**
   * Check if error is a timeout
   * @param {Error} error - Error object
   * @returns {boolean} True if timeout error
   */
  isTimeoutError(error) {
    const message = error.message || '';
    return (
      error.name === 'AbortError' ||
      message.includes('timeout') ||
      message.includes('ETIMEDOUT')
    );
  }

  /**
   * Determine if request should be retried
   * @param {Error} error - Error object
   * @returns {boolean} True if should retry
   */
  shouldRetryRequest(error) {
    const message = error.message || '';
    
    // Don't retry authentication errors
    if (message.includes('401') || message.includes('403')) {
      return false;
    }

    // Don't retry validation errors
    if (message.includes('400') || message.includes('Invalid')) {
      return false;
    }

    // Don't retry rate limiting
    if (message.includes('429')) {
      return false;
    }

    // Retry network and timeout errors
    if (this.isNetworkError(error) || this.isTimeoutError(error)) {
      return true;
    }

    // Retry server errors
    if (message.includes('500') || message.includes('503')) {
      return true;
    }

    return false;
  }

  /**
   * Determine if authentication should be cleared
   * @param {Error} error - Error object
   * @returns {boolean} True if should clear auth
   */
  shouldClearAuth(error) {
    const message = error.message || '';
    return (
      message.includes('401') ||
      message.includes('403') ||
      message.includes('token') && message.includes('expired') ||
      message.includes('Authentication failed')
    );
  }

  /**
   * Create error object for Redux actions
   * @param {Error} error - Original error
   * @param {string} context - Context where error occurred
   * @returns {Object} Error object for Redux
   */
  createReduxError(error, context) {
    return {
      message: this.getAuthErrorMessage(error),
      type: this.getErrorType(error),
      context,
      timestamp: Date.now(),
    };
  }

  /**
   * Log error with context (development only)
   * @param {Error} error - Error to log
   * @param {string} context - Context information
   * @param {Object} additionalData - Additional data to log
   */
  logError(error, context, additionalData = {}) {
    if (process.env.NODE_ENV === 'development') {
      console.group(`🚨 Error in ${context}`);
      console.error('Error:', error);
      console.log('Additional Data:', additionalData);
      console.groupEnd();
    }
  }
}

// Export singleton instance
export default new ErrorHandlingService();