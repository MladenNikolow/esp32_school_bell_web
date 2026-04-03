# ESP32 Authentication System - API Specification

This document specifies the HTTP endpoints for the ESP32 IDF firmware. The React frontend authenticates via **HttpOnly session cookies** (no client-side token storage). CSRF protection relies on `SameSite=Strict` cookies plus mandatory request-header checks on state-changing endpoints. Two account roles exist: **service** (full access + credential management) and **client** (full access minus credential management).

---

## 🔧 **Required HTTP Endpoints**

### **1. Authentication Endpoints**

#### **POST /api/login**
**Purpose**: Authenticate user credentials and set an HttpOnly session cookie
**Access**: Public (no authentication required)

**Request Headers:**
```
Content-Type: application/json
X-Requested-With: XMLHttpRequest
```

**Request Body:**
```json
{
  "username": "admin",
  "password": "password123"
}
```

**Success Response (200):**

Response headers — the server **must** set the session cookie here:
```
Set-Cookie: session=<opaque_token>; HttpOnly; SameSite=Strict; Path=/
Content-Type: application/json
```

Response body — **no token field** (the cookie carries the credential):
```json
{
  "user": {
    "username": "admin",
    "role": "service"
  },
  "message": "Login successful"
}
```

`role` is `"service"` or `"client"` depending on which account matched.
```

**Error Responses:**
- **400 Bad Request**: Invalid JSON or missing fields
- **401 Unauthorized**: Invalid credentials
- **429 Too Many Requests**: Rate limiting (max 5 attempts/min recommended)
- **500 Internal Server Error**: Server error

---

#### **POST /api/logout**
**Purpose**: Invalidate session and clear the session cookie
**Access**: Authenticated (requires valid session cookie)

**Request Headers:**
```
Content-Type: application/json
X-Requested-With: XMLHttpRequest
Cookie: session=<opaque_token>        (sent automatically by the browser)
```

**Request Body:** `{}` (empty JSON object)

**Success Response (200):**

Response headers — clear the cookie by setting it expired:
```
Set-Cookie: session=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0
Content-Type: application/json
```

Response body:
```json
{
  "success": true,
  "message": "Logged out successfully"
}
```

**Error Responses:**
- **401 Unauthorized**: No valid session cookie
- **500 Internal Server Error**: Server error

---

#### **GET /api/validate-token**
**Purpose**: Validate the current session cookie and return user info
**Access**: Authenticated (requires valid session cookie)

**Request Headers:**
```
Cookie: session=<opaque_token>        (sent automatically by the browser)
```

> GET requests do **not** require `X-Requested-With` or `Content-Type` — they are read-only and not vulnerable to CSRF form submissions that can read the response.

**Success Response (200):**
```json
{
  "valid": true,
  "user": {
    "username": "admin",
    "role": "service"
  }
}
```

`role` is `"service"` or `"client"`.
```

**Error Responses:**
- **401 Unauthorized**: No cookie or session expired
- **403 Forbidden**: Session valid but access denied

---

### **2. Application Endpoints**

#### **GET /api/mode**
**Purpose**: Get current device mode/configuration
**Access**: Authenticated (requires valid session cookie)

**Request Headers:**
```
Cookie: session=<opaque_token>
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
**Access**: Authenticated (requires valid session cookie)

**Request Headers:**
```
Content-Type: application/json
X-Requested-With: XMLHttpRequest
Cookie: session=<opaque_token>
```

**Request Body:**
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

### **Session Cookie Requirements**

| Attribute      | Value                 | Purpose                                      |
| -------------- | --------------------- | -------------------------------------------- |
| `HttpOnly`     | *(flag)*              | Prevents JavaScript from reading the cookie  |
| `SameSite`     | `Strict`              | Cookie sent only on same-origin navigations  |
| `Path`         | `/`                   | Cookie available to all paths                |
| `Expires / Max-Age` | *omitted*        | Session cookie — cleared when browser closes |

The cookie value should be an opaque, random token (e.g., 32 hex characters). The server stores a mapping from token → `{ username, role, created_at }` in memory (RAM) or NVS.

### **Session Validation**
For all authenticated endpoints, validate the incoming `Cookie` header:

**Validation Steps:**
1. Extract the `session` cookie value from the `Cookie` header
2. Look up the session token in the server-side session store
3. Verify the session has not expired (24 h recommended maximum age)
4. Extract user info (username, role) from the session record
5. If invalid or missing → respond **401 Unauthorized**

---

## 🛡️ **CSRF Protection**

### **Content-Type Enforcement (Required)**
The firmware **must reject** any POST, PUT, or DELETE request to a protected endpoint that does not have:

```
Content-Type: application/json
```

**Why:** HTML forms can only submit `application/x-www-form-urlencoded`, `multipart/form-data`, or `text/plain`. They **cannot** send `application/json`. Enforcing this Content-Type blocks cross-origin form-based CSRF attacks.

### **X-Requested-With Header Check (Required)**
The firmware **must also reject** any POST, PUT, or DELETE request to a protected endpoint that does not have:

```
X-Requested-With: XMLHttpRequest
```

**Why:** This is a custom header that cannot be set by HTML forms or simple cross-origin requests. Any request with a custom header triggers a CORS preflight, which the server can deny. This provides a second layer of CSRF defense.

### **CSRF Validation Pseudocode**
```c
// Run this BEFORE session validation on POST/PUT/DELETE endpoints
if (method == POST || method == PUT || method == DELETE) {
    const char *content_type = get_header("Content-Type");
    const char *x_requested  = get_header("X-Requested-With");

    if (!content_type || strncmp(content_type, "application/json", 16) != 0) {
        return respond_error(415, "Unsupported Media Type");
    }
    if (!x_requested || strcmp(x_requested, "XMLHttpRequest") != 0) {
        return respond_error(403, "Forbidden: missing X-Requested-With");
    }
}
```

### **CSRF Error Responses**
- **415 Unsupported Media Type**: Missing or wrong `Content-Type` on POST/PUT/DELETE
- **403 Forbidden**: Missing `X-Requested-With: XMLHttpRequest` on POST/PUT/DELETE

---

## 🔒 **Security Response Headers**

The firmware should include these headers on **every** response:

```
X-Content-Type-Options: nosniff
X-Frame-Options: DENY
Cache-Control: no-store
```

| Header                     | Purpose                                                    |
| -------------------------- | ---------------------------------------------------------- |
| `X-Content-Type-Options`   | Prevents browsers from MIME-sniffing responses              |
| `X-Frame-Options`          | Prevents the page from being embedded in iframes (clickjacking) |
| `Cache-Control: no-store`  | Prevents caching of authenticated responses                 |

For the HTML page response (serving the SPA), additionally include:

```
Content-Security-Policy: default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self'
```

---

## 📋 **CORS Configuration**

Since the frontend is served from the **same origin** as the API (both from the ESP32), CORS headers are typically **not needed**. If you do serve from a different origin during development:

### **Response Headers**
```
Access-Control-Allow-Origin: <specific-origin>
Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS
Access-Control-Allow-Headers: Content-Type, X-Requested-With
Access-Control-Allow-Credentials: true
Access-Control-Max-Age: 86400
```

> **Important:** When using `Access-Control-Allow-Credentials: true`, you **must not** use `Access-Control-Allow-Origin: *`. Specify the exact origin instead.

### **Handle OPTIONS Preflight Requests**
For CORS preflight requests, respond with:
- **Status**: 204 No Content
- **Headers**: CORS headers above
- **Body**: Empty

---

## ⚡ **ESP32 Implementation Tips**

### **Memory Optimization**
- Use static JSON buffers for responses
- Limit concurrent sessions (e.g., max 3 users)
- Store session records in a small fixed-size array in RAM

### **Security Considerations**
- Generate session tokens using `esp_random()` for cryptographic randomness
- Store the session secret/records in RAM (cleared on reboot = automatic logout)
- Implement rate limiting on `/api/login` (max 5 attempts per minute)
- Use HTTPS in production (ESP32 supports TLS via `esp_tls`)
- Validate and sanitize all input data before processing

---

## 👥 **Credential Management Endpoints**

These endpoints are only accessible to the **service** role. Client-role sessions receive `403 Forbidden`.

#### **GET /api/system/credentials**
**Purpose**: Check whether a client account exists
**Access**: Authenticated (service role only)

**Success Response (200):**
```json
{
  "clientExists": true,
  "clientUsername": "teacher"
}
```
If no client account: `{ "clientExists": false }`

---

#### **POST /api/system/credentials**
**Purpose**: Create or update client account
**Access**: Authenticated (service role only)

**Request Headers:**
```
Content-Type: application/json
X-Requested-With: XMLHttpRequest
```

**Request Body:**
```json
{
  "username": "teacher",
  "password": "securepass"
}
```
- `username`: 1–31 characters
- `password`: minimum 8 characters

**Success Response (200):**
```json
{ "status": "ok", "message": "Client credentials saved" }
```

All active sessions are invalidated after this operation.

**Error Responses:**
- **400 Bad Request**: Invalid username or password
- **403 Forbidden**: Not service role
- **500 Internal Server Error**: Storage failure

---

#### **DELETE /api/system/credentials**
**Purpose**: Delete client account
**Access**: Authenticated (service role only)

**Request Headers:**
```
Content-Type: application/json
X-Requested-With: XMLHttpRequest
```

**Success Response (200):**
```json
{ "status": "ok", "message": "Client credentials deleted" }
```

All active sessions are invalidated after this operation.

**Error Responses:**
- **403 Forbidden**: Not service role
- **404 Not Found**: No client account exists
- **500 Internal Server Error**: Storage failure

### **Error Handling**
- Always return proper HTTP status codes
- Include descriptive error messages in JSON body
- Log authentication attempts and CSRF rejections for debugging

### **Performance**
- Session lookup by token is O(n) for a small array — fine for ≤3 sessions
- Use lightweight JSON parsing (cJSON library)
- Implement request timeouts (10 seconds max)

---

## 🧪 **Testing Endpoints**

Test your ESP32 endpoints using curl. Note: curl requires `-c`/`-b` flags to handle cookies.

```bash
# Health check (public)
curl http://192.168.1.100/api/health

# Login — save session cookie to cookiejar
curl -X POST http://192.168.1.100/api/login \
  -H "Content-Type: application/json" \
  -H "X-Requested-With: XMLHttpRequest" \
  -c cookies.txt \
  -d '{"username":"admin","password":"password"}'

# Validate session (uses saved cookie)
curl http://192.168.1.100/api/validate-token \
  -b cookies.txt

# Get mode (authenticated GET)
curl http://192.168.1.100/api/mode \
  -b cookies.txt

# Update mode (authenticated POST — requires CSRF headers)
curl -X POST http://192.168.1.100/api/mode \
  -H "Content-Type: application/json" \
  -H "X-Requested-With: XMLHttpRequest" \
  -b cookies.txt \
  -d '{"mode":"manual"}'

# Logout — clear cookie
curl -X POST http://192.168.1.100/api/logout \
  -H "Content-Type: application/json" \
  -H "X-Requested-With: XMLHttpRequest" \
  -b cookies.txt \
  -c cookies.txt \
  -d '{}'

# CSRF test — should fail with 415 (wrong Content-Type)
curl -X POST http://192.168.1.100/api/mode \
  -H "Content-Type: text/plain" \
  -H "X-Requested-With: XMLHttpRequest" \
  -b cookies.txt \
  -d '{"mode":"manual"}'

# CSRF test — should fail with 403 (missing X-Requested-With)
curl -X POST http://192.168.1.100/api/mode \
  -H "Content-Type: application/json" \
  -b cookies.txt \
  -d '{"mode":"manual"}'
```

---

## 📚 **ESP32 Libraries Needed**

- **HTTP Server**: `esp_http_server.h`
- **JSON Parsing**: `cJSON.h`
- **Random**: `esp_random.h` (for generating session tokens)
- **WiFi**: `esp_wifi.h`
- **NVS**: `nvs_flash.h` (optional — for persisting sessions across reboots)

This specification provides everything you need to implement a fully functional cookie-based authentication system on your ESP32 that works seamlessly with the React frontend.