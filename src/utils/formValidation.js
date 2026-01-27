// src/utils/formValidation.js
// Form validation utilities for authentication forms

/**
 * Validation rules for login credentials
 */
export const VALIDATION_RULES = {
  username: {
    required: true,
    minLength: 1,
    maxLength: 100,
    pattern: /^[a-zA-Z0-9_.-]+$/, // Alphanumeric, underscore, dot, dash
  },
  password: {
    required: true,
    minLength: 1,
    maxLength: 200,
  },
};

/**
 * Validate a single field
 * @param {string} field - Field name
 * @param {string} value - Field value
 * @param {Object} rules - Validation rules
 * @returns {Object} Validation result
 */
export function validateField(field, value, rules = VALIDATION_RULES[field]) {
  const errors = [];
  
  if (!rules) {
    return { isValid: true, errors: [] };
  }

  // Required validation
  if (rules.required && (!value || value.trim().length === 0)) {
    errors.push(`${field.charAt(0).toUpperCase() + field.slice(1)} is required`);
    return { isValid: false, errors };
  }

  // Skip other validations if field is empty and not required
  if (!value || value.trim().length === 0) {
    return { isValid: true, errors: [] };
  }

  const trimmedValue = value.trim();

  // Length validations
  if (rules.minLength && trimmedValue.length < rules.minLength) {
    errors.push(`${field.charAt(0).toUpperCase() + field.slice(1)} must be at least ${rules.minLength} characters`);
  }

  if (rules.maxLength && trimmedValue.length > rules.maxLength) {
    errors.push(`${field.charAt(0).toUpperCase() + field.slice(1)} must be no more than ${rules.maxLength} characters`);
  }

  // Pattern validation
  if (rules.pattern && !rules.pattern.test(trimmedValue)) {
    errors.push(`${field.charAt(0).toUpperCase() + field.slice(1)} contains invalid characters`);
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
}

/**
 * Validate login credentials
 * @param {Object} credentials - Login credentials
 * @returns {Object} Validation result
 */
export function validateLoginCredentials(credentials) {
  const { username = '', password = '' } = credentials || {};
  
  const usernameValidation = validateField('username', username);
  const passwordValidation = validateField('password', password);
  
  const allErrors = [
    ...usernameValidation.errors,
    ...passwordValidation.errors,
  ];

  return {
    isValid: allErrors.length === 0,
    errors: allErrors,
    fieldErrors: {
      username: usernameValidation.errors,
      password: passwordValidation.errors,
    },
  };
}

/**
 * Sanitize input value
 * @param {string} value - Input value
 * @param {string} type - Input type ('username', 'password', etc.)
 * @returns {string} Sanitized value
 */
export function sanitizeInput(value, type = 'text') {
  if (!value || typeof value !== 'string') {
    return '';
  }

  // Basic sanitization
  let sanitized = value.trim();

  // Type-specific sanitization
  switch (type) {
    case 'username':
      // Remove any characters that aren't allowed
      sanitized = sanitized.replace(/[^a-zA-Z0-9_.-]/g, '');
      break;
    case 'password':
      // For passwords, we generally don't sanitize much to preserve user intent
      // Just ensure it's not excessively long
      if (sanitized.length > VALIDATION_RULES.password.maxLength) {
        sanitized = sanitized.substring(0, VALIDATION_RULES.password.maxLength);
      }
      break;
    default:
      // Generic text sanitization
      sanitized = sanitized.replace(/[<>]/g, ''); // Remove basic HTML chars
      break;
  }

  return sanitized;
}

/**
 * Check if form has any validation errors
 * @param {Object} fieldErrors - Field errors object
 * @returns {boolean} True if form has errors
 */
export function hasFormErrors(fieldErrors) {
  return Object.values(fieldErrors).some(errors => errors.length > 0);
}

/**
 * Get first error message from field errors
 * @param {Array} errors - Array of error messages
 * @returns {string|null} First error message or null
 */
export function getFirstError(errors) {
  return errors && errors.length > 0 ? errors[0] : null;
}

/**
 * Create form state for validation
 * @param {Array} fields - Array of field names
 * @returns {Object} Initial form state
 */
export function createFormState(fields) {
  const state = {
    values: {},
    errors: {},
    touched: {},
    isValid: false,
  };

  fields.forEach(field => {
    state.values[field] = '';
    state.errors[field] = [];
    state.touched[field] = false;
  });

  return state;
}

/**
 * Update form state with new field value
 * @param {Object} formState - Current form state
 * @param {string} field - Field name
 * @param {string} value - New value
 * @returns {Object} Updated form state
 */
export function updateFormField(formState, field, value) {
  const sanitizedValue = sanitizeInput(value, field);
  const validation = validateField(field, sanitizedValue);

  return {
    ...formState,
    values: {
      ...formState.values,
      [field]: sanitizedValue,
    },
    errors: {
      ...formState.errors,
      [field]: validation.errors,
    },
    isValid: !hasFormErrors({
      ...formState.errors,
      [field]: validation.errors,
    }),
  };
}

/**
 * Mark field as touched
 * @param {Object} formState - Current form state
 * @param {string} field - Field name
 * @returns {Object} Updated form state
 */
export function touchFormField(formState, field) {
  return {
    ...formState,
    touched: {
      ...formState.touched,
      [field]: true,
    },
  };
}

export default {
  validateField,
  validateLoginCredentials,
  sanitizeInput,
  hasFormErrors,
  getFirstError,
  createFormState,
  updateFormField,
  touchFormField,
  VALIDATION_RULES,
};