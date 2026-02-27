# ESP32 Authentication System - API Specification

This document outlines all the HTTP endpoints you need to implement in your ESP32 IDF project to support the React authentication system.

## 🔧 **Required HTTP Endpoints**

### **1. Authentication Endpoints**

#### **POST /api/login**
**Purpose**: Authenticate user credentials and return JWT token
**Access**: Public (no authentication required)

**Request:**
```json
{
  "username": "admin",
  "password": "password123"
}
```

**Success Response (200):**
```json
{
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "username": "admin",
    "role": "admin" //user
  },
  "message": "Login successful"
}
```

**Error Responses:**
- **400 Bad Request**: Invalid JSON or missing fields
- **401 Unauthorized**: Invalid credentials
- **429 Too Many Requests**: Rate limiting
- **500 Internal Server Error**: Server error

---

#### **POST /api/logout**
**Purpose**: Invalidate user session (optional server-side cleanup)
**Access**: Authenticated (requires Bearer token)

**Request Headers:**
```
Authorization: Bearer <jwt_token>
Content-Type: application/json
```

**Request Body:** `{}` (empty JSON object)

**Success Response (200):**
```json
{
  "success": true,
  "message": "Logged out successfully"
}
```

**Error Responses:**
- **401 Unauthorized**: Invalid or expired token
- **500 Internal Server Error**: Server error

---

#### **GET /api/validate-token**
**Purpose**: Validate JWT token and return user info
**Access**: Authenticated (requires Bearer token)

**Request Headers:**
```
Authorization: Bearer <jwt_token>
```

**Success Response (200):**
```json
{
  "valid": true,
  "user": {
    "username": "admin",
    "role": "admin"
  }
}
```

**Error Responses:**
- **401 Unauthorized**: Invalid or expired token
- **403 Forbidden**: Token valid but access denied

---

### **2. Application Endpoints**

#### **GET /api/mode**
**Purpose**: Get current device mode/configuration
**Access**: Authenticated (requires Bearer token)

**Request Headers:**
```
Authorization: Bearer <jwt_token>
```

**Success Response (200):**
```json
{
  "mode": "auto",
  "timestamp": 1640995200,
  "status": "active"
}
```

**Error Responses:**
- **401 Unauthorized**: Authentication required
- **500 Internal Server Error**: Device error

---

#### **POST /api/mode**
**Purpose**: Update device mode/configuration
**Access**: Authenticated (requires Bearer token)

**Request Headers:**
```
Authorization: Bearer <jwt_token>
Content-Type: application/json
```

**Request:**
```json
{
  "mode": "manual"
}
```

**Success Response (200):**
```json
{
  "mode": "manual",
  "timestamp": 1640995260,
  "status": "updated",
  "message": "Mode updated successfully"
}
```

**Error Responses:**
- **400 Bad Request**: Invalid mode value
- **401 Unauthorized**: Authentication required
- **500 Internal Server Error**: Device error

---

### **3. System Endpoints**

#### **GET /api/health**
**Purpose**: Health check endpoint
**Access**: Public (no authentication required)

**Success Response (200):**
```json
{
  "status": "healthy",
  "timestamp": 1640995200,
  "uptime": 3600,
  "memory": {
    "free": 45000,
    "total": 520000
  }
}
```

---

#### **GET /api/status**
**Purpose**: System status information
**Access**: Public (no authentication required)

**Success Response (200):**
```json
{
  "device": "ESP32",
  "version": "1.0.0",
  "wifi": {
    "connected": true,
    "ssid": "MyNetwork",
    "rssi": -45
  },
  "auth": {
    "enabled": true,
    "sessions": 1
  }
}
```

---

## 🔐 **Authentication Implementation**

### **JWT Token Requirements**
- **Algorithm**: HS256 (HMAC with SHA-256)
- **Expiration**: 24 hours recommended
- **Claims**: Include `username`, `role`, `exp` (expiration)
- **Secret**: Use a strong, device-specific secret key

### **Token Validation**
For all authenticated endpoints, validate the `Authorization` header:
```
Authorization: Bearer <jwt_token>
```

**Validation Steps:**
1. Extract token from `Bearer ` prefix
2. Verify JWT signature
3. Check expiration (`exp` claim)
4. Extract user info from claims

---

## 📋 **HTTP Headers & CORS**

### **Required Response Headers**
```
Content-Type: application/json
Access-Control-Allow-Origin: *
Access-Control-Allow-Methods: GET, POST, OPTIONS
Access-Control-Allow-Headers: Content-Type, Authorization
Access-Control-Max-Age: 86400
```

### **Handle OPTIONS Requests**
For CORS preflight requests, respond with:
- **Status**: 200 OK
- **Headers**: CORS headers above
- **Body**: Empty

---

## ⚡ **ESP32 Implementation Tips**

### **Memory Optimization**
- Use static JSON buffers for responses
- Implement token caching to avoid re-parsing
- Limit concurrent sessions (e.g., max 3 users)

### **Security Considerations**
- Store JWT secret in NVS (non-volatile storage)
- Implement rate limiting (max 5 login attempts per minute)
- Use HTTPS in production (ESP32 supports TLS)
- Validate all input data

### **Error Handling**
- Always return proper HTTP status codes
- Include descriptive error messages
- Log authentication attempts for debugging

### **Performance**
- Cache parsed tokens for the session duration
- Use lightweight JSON parsing (cJSON library)
- Implement request timeouts (10 seconds max)

---

## 🧪 **Testing Endpoints**

You can test your ESP32 endpoints using curl:

```bash
# Health check
curl http://192.168.1.100/api/health

# Login
curl -X POST http://192.168.1.100/api/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"password"}'

# Get mode (with token)
curl http://192.168.1.100/api/mode \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"

# Update mode (with token)
curl -X POST http://192.168.1.100/api/mode \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -d '{"mode":"manual"}'
```

---

## 📚 **ESP32 Libraries Needed**

- **HTTP Server**: `esp_http_server.h`
- **JSON Parsing**: `cJSON.h`
- **JWT**: Custom implementation or `libjwt` port
- **WiFi**: `esp_wifi.h`
- **NVS**: `nvs_flash.h` (for storing secrets)

This specification provides everything you need to implement a fully functional authentication system on your ESP32 that works seamlessly with the React frontend!