# Cypher ERP - Security Documentation

**Last Updated:** February 2026

---

## Table of Contents

1. [JWT & Cookie-Based Authentication](#1-jwt--cookie-based-authentication)
2. [Two-Factor Authentication (2FA)](#2-two-factor-authentication-2fa)
3. [Rate Limiting](#3-rate-limiting)
4. [Input Sanitization](#4-input-sanitization)
5. [CSRF Protection](#5-csrf-protection)
6. [Audit Logging](#6-audit-logging)
7. [Security Headers](#7-security-headers)
8. [Request Processing Pipeline](#8-request-processing-pipeline)
9. [Account Lockout](#9-account-lockout)

---

## 1. JWT & Cookie-Based Authentication

**Source:** `shared/services/JwtService.ts`, `shared/middleware/auth.middleware.ts`

### Token Lifecycle

| Token                | Default Expiry | Configurable Via                                       |
| -------------------- | -------------- | ------------------------------------------------------ |
| Access Token         | 15 minutes     | `JWT_ACCESS_TOKEN_EXPIRY` or `JWT_EXPIRES_IN`          |
| Refresh Token        | 7 days         | `JWT_REFRESH_TOKEN_EXPIRY` or `JWT_REFRESH_EXPIRES_IN` |
| Pre-Auth Token (2FA) | 5 minutes      | Hardcoded                                              |

### Cookie Configuration

Three cookies are set on successful login:

| Cookie          | HttpOnly | Secure          | SameSite | Path                   | Purpose                                    |
| --------------- | -------- | --------------- | -------- | ---------------------- | ------------------------------------------ |
| `access_token`  | Yes      | Production only | Lax      | `/`                    | Short-lived access token                   |
| `refresh_token` | Yes      | Production only | Lax      | `/api/v1/auth/refresh` | Long-lived refresh token (restricted path) |
| `auth_status`   | **No**   | Production only | Lax      | `/`                    | Frontend auth status indicator             |

The `auth_status` cookie is intentionally non-HttpOnly so the frontend can detect whether the user is authenticated without making an API call.

### Token Extraction Priority

The auth middleware extracts tokens in this order:

1. **HttpOnly cookie** (`access_token`) -- preferred
2. **Authorization header** (`Bearer <token>`) -- backwards compatibility

### Auto-Refresh Flow

When the access token is expired but a valid refresh token cookie exists, the auth middleware automatically:

1. Verifies the refresh token
2. Generates a new access + refresh token pair
3. Sets new cookies on the response
4. Continues the request without returning 401

This is transparent to the client.

```
Client Request (expired access_token + valid refresh_token cookie)
  -> Auth Middleware detects TokenExpiredError
  -> Extracts refresh_token from cookie
  -> Verifies refresh token
  -> Generates new access + refresh tokens
  -> Sets new cookies on response
  -> Attaches user to request
  -> Continues to route handler
```

### Manual Refresh Endpoint

`POST /api/v1/auth/refresh` -- reads refresh token from cookie or request body, issues new token pair.

### Logout

`POST /api/v1/auth/logout` -- clears all three auth cookies (`access_token`, `refresh_token`, `auth_status`).

### Environment Variables

| Variable                   | Required | Description                                                |
| -------------------------- | -------- | ---------------------------------------------------------- |
| `JWT_SECRET`               | Yes      | Access token signing key (min 32 chars enforced at login)  |
| `JWT_REFRESH_SECRET`       | Yes      | Refresh token signing key (min 32 chars enforced at login) |
| `JWT_ACCESS_TOKEN_EXPIRY`  | No       | Access token TTL (default: `15m`)                          |
| `JWT_REFRESH_TOKEN_EXPIRY` | No       | Refresh token TTL (default: `7d`)                          |

### Role-Based Access Control (RBAC)

Roles are embedded in the JWT payload and checked via the `requireRole` middleware:

```typescript
router.post('/admin-action', requireRole(['admin']), handler);
router.post('/moderation', requireRole(['admin', 'sales']), handler);
```

Available roles: `admin`, `sales`, `warehouse`, `finance`, `user`

**403 Response** when role check fails:

```json
{
  "error": "Insufficient permissions",
  "required_roles": ["admin"],
  "user_role": "user"
}
```

---

## 2. Two-Factor Authentication (2FA)

**Source:** `modules/users/src/application/services/TwoFactorAuthService.ts`

### Implementation

- **Algorithm:** TOTP (Time-based One-Time Password) via `otplib`
- **Token window:** 1 step (allows 30 seconds of clock drift)
- **QR Code:** Generated via `qrcode` library as data URL
- **Issuer:** Configurable via `TWOFA_ISSUER` env var (default: `Cypher ERP`)
- **Backup codes:** 10 codes, 8 hex characters each (e.g., `8A2B3C4D`)

### Setup Flow

```
1. User calls POST /api/v1/users/2fa/setup
   -> Server generates TOTP secret
   -> Returns secret + otpauth URL + QR code data URL

2. User scans QR code with authenticator app (Google Auth, Authy, etc.)

3. User calls POST /api/v1/users/2fa/verify-setup with { token, secret }
   -> Server verifies the TOTP token against the secret
   -> If valid: enables 2FA, stores secret, generates 10 backup codes
   -> Returns backup codes (user MUST save these)
```

### Login Flow with 2FA

```
1. POST /api/v1/users/login { email, password }
   -> Password valid + 2FA enabled
   -> Returns { requires2FA: true, preAuthToken: "..." }
   (preAuthToken is a JWT valid for 5 minutes with isPreAuth: true)

2. POST /api/v1/users/2fa/verify { token, preAuthToken }
   -> Verify preAuthToken JWT (must have isPreAuth claim)
   -> Verify TOTP token against stored secret
   -> If valid: issue full access + refresh tokens, set cookies
   -> Returns tokens + user object
```

### Backup Code Usage

When a user loses access to their authenticator app, they can use a backup code:

```
POST /api/v1/users/2fa/verify {
  "token": "8A2B3C4D",
  "preAuthToken": "...",
  "isBackupCode": true
}
```

Each backup code is single-use. After verification, the code is removed from the database. The remaining codes list is updated.

### Disabling 2FA

Requires a valid current TOTP token as confirmation:

```
POST /api/v1/users/2fa/disable { "token": "123456" }
```

The server verifies the token against the stored secret before clearing `twofa_enabled`, `twofa_secret`, and `twofa_backup_codes` from the user record.

### Database Fields

| Column               | Type    | Description                              |
| -------------------- | ------- | ---------------------------------------- |
| `twofa_enabled`      | boolean | Whether 2FA is active                    |
| `twofa_secret`       | text    | TOTP secret (stored plaintext currently) |
| `twofa_backup_codes` | JSONB   | Array of remaining backup codes          |

---

## 3. Rate Limiting

**Source:** `shared/middleware/rate-limit.middleware.ts`

All rate limiters use `express-rate-limit` with standard headers (`RateLimit-*`) and per-IP key generation.

### Rate Limit Tiers

| Limiter                 | Requests | Window     | Applied To                               | Key |
| ----------------------- | -------- | ---------- | ---------------------------------------- | --- |
| `globalApiLimiter`      | 100      | 15 minutes | All `/api/*` routes                      | IP  |
| `loginLimiter`          | 5        | 15 minutes | `POST /api/v1/users/login`               | IP  |
| `authLimiter`           | 10       | 15 minutes | `/api/v1/users/2fa/*`                    | IP  |
| `writeOperationLimiter` | 30       | 1 minute   | `/api/v1/orders/*`, `/api/v1/settings/*` | IP  |

### Write Operation Limiter

The `writeOperationLimiter` only applies to mutating methods. GET, HEAD, and OPTIONS requests are automatically skipped.

### Exemptions

Health check endpoints (`/health`, `/api/v1/health`) are exempt from the global rate limiter.

### Response Headers

```
RateLimit-Limit: 100
RateLimit-Remaining: 97
RateLimit-Reset: 1708000000
```

### Rate Limit Exceeded

```
HTTP/1.1 429 Too Many Requests
Content-Type: application/json

{
  "status": 429,
  "message": "Too many requests, please try again later."
}
```

---

## 4. Input Sanitization

**Source:** `shared/middleware/sanitize.middleware.ts`

Applied globally as middleware before any route handlers. Sanitizes `req.body`, `req.query`, and `req.params`.

### Protections

| Threat                     | Mitigation                                                                                 |
| -------------------------- | ------------------------------------------------------------------------------------------ |
| XSS (Cross-Site Scripting) | Strips `<script>` tags, `<img onerror>` tags, and inline event handlers (`onclick=`, etc.) |
| Prototype Pollution        | Rejects keys named `__proto__`, `constructor`, `prototype`                                 |
| NoSQL Injection            | Rejects MongoDB-style operator keys starting with `$`                                      |
| Input Length Overflow      | Truncates strings exceeding 10,000 characters                                              |

### Behavior

- Recursively sanitizes nested objects and arrays
- Trims whitespace from all string values
- Skips `multipart/form-data` requests (file uploads)
- Continues to next middleware even if sanitization throws (fails open for availability)

### Example

Input:

```json
{
  "name": "<script>alert('xss')</script>Hello",
  "__proto__": { "admin": true },
  "$gt": 100
}
```

After sanitization:

```json
{
  "name": "Hello"
}
```

The `__proto__` and `$gt` keys are removed entirely.

---

## 5. CSRF Protection

**Source:** `shared/middleware/csrf.middleware.ts`

### Strategy

Origin/Referer header validation. Enabled in **production only** (`NODE_ENV=production`).

### How It Works

1. **Safe methods** (GET, HEAD, OPTIONS) are always allowed
2. Requests with a valid **Bearer token** in the Authorization header skip CSRF checks (API clients)
3. For browser requests:
   - If `Origin` header is present, it must match the `CORS_ORIGINS` allowlist
   - If `Referer` header is present, its origin must match the allowlist
   - If both are missing, the request is allowed (likely an API client) but logged for monitoring

### CSRF Rejection Response

```
HTTP/1.1 403 Forbidden

{
  "error": "CSRF Validation Failed",
  "message": "Request origin not allowed",
  "code": "CSRF_INVALID_ORIGIN"
}
```

### Configuration

CSRF allowed origins are configured via the `CORS_ORIGINS` environment variable:

```
CORS_ORIGINS=http://localhost:3000,http://localhost:3001,https://app.ledux.ro
```

---

## 6. Audit Logging

**Source:** `shared/middleware/audit-trail.middleware.ts`, `shared/services/AuditLogService.ts`

### What Gets Logged

All HTTP requests are logged to the console/file. **Write operations** (POST, PUT, PATCH, DELETE) are additionally persisted to the `audit_logs` database table.

### Skipped Paths

The following paths are excluded from audit logging:

- `/health`, `/api/v1/health`
- `/metrics`, `/api/v1/system/metrics`, `/api/v1/system/metrics/detailed`
- Static assets (`/static/*`, `/assets/*`, `/_next/*`)

### Audit Log Schema

The `audit_logs` table stores:

| Column          | Type      | Description                                          |
| --------------- | --------- | ---------------------------------------------------- |
| `id`            | UUID      | Primary key (auto-generated)                         |
| `user_id`       | text      | Authenticated user's ID                              |
| `user_email`    | text      | Authenticated user's email                           |
| `action`        | text      | CREATE, UPDATE, DELETE, READ                         |
| `resource_type` | text      | Extracted from URL path (e.g., "Order", "Inventory") |
| `resource_id`   | text      | Resource identifier from URL path                    |
| `ip_address`    | text      | Client IP address                                    |
| `user_agent`    | text      | Client user agent string                             |
| `changes`       | JSONB     | Request body (sensitive fields redacted)             |
| `metadata`      | JSONB     | Request ID, status code, duration, path              |
| `created_at`    | timestamp | Auto-set on insert                                   |

### Indexes

- `user_id`
- `action`
- `resource_type`
- `created_at DESC`
- Composite: `(resource_type, resource_id)`

### Sensitive Field Redaction

The following fields are automatically redacted to `[REDACTED]` in the `changes` column:

`password`, `token`, `secret`, `authorization`, `credit_card`, `creditCard`, `cvv`, `ssn`, `twofa_secret`, `twofaSecret`

### Action Mapping

| HTTP Method | Audit Action                                    |
| ----------- | ----------------------------------------------- |
| POST        | CREATE                                          |
| PUT, PATCH  | UPDATE                                          |
| DELETE      | DELETE                                          |
| GET         | READ (file-based log only, not persisted to DB) |

### Non-Blocking Design

Audit logging never throws or blocks the main request flow. If database persistence fails, the error is logged but the response is still sent successfully.

### Query API (Admin)

| Endpoint                              | Description                             |
| ------------------------------------- | --------------------------------------- |
| `GET /api/v1/admin/audit-logs`        | Query with filters, pagination, sorting |
| `GET /api/v1/admin/audit-logs/stats`  | Aggregated stats (last 30 days)         |
| `GET /api/v1/admin/audit-logs/export` | CSV export (up to 10,000 rows)          |

See [API.md](./API.md#12-audit-logs) for full endpoint documentation.

---

## 7. Security Headers

**Source:** `src/server.ts` (helmet configuration)

Helmet.js is configured with the following security headers:

| Header                            | Value                                                                                                  | Purpose                           |
| --------------------------------- | ------------------------------------------------------------------------------------------------------ | --------------------------------- |
| Content-Security-Policy           | `default-src 'self'; style-src 'self' 'unsafe-inline'; script-src 'self'; img-src 'self' data: https:` | Prevents XSS, clickjacking        |
| Strict-Transport-Security         | `max-age=31536000; includeSubDomains; preload`                                                         | Forces HTTPS for 1 year           |
| X-Content-Type-Options            | `nosniff`                                                                                              | Prevents MIME type sniffing       |
| X-XSS-Protection                  | Enabled                                                                                                | Legacy XSS filter                 |
| X-Frame-Options                   | `DENY`                                                                                                 | Prevents framing/clickjacking     |
| Referrer-Policy                   | `strict-origin-when-cross-origin`                                                                      | Limits referrer leakage           |
| X-Permitted-Cross-Domain-Policies | `none`                                                                                                 | Blocks Flash/Acrobat cross-domain |
| X-Powered-By                      | Removed                                                                                                | Hides Express fingerprint         |

### CORS Configuration

```
Methods: GET, POST, PUT, PATCH, DELETE, OPTIONS
Credentials: true
Allowed Headers: Content-Type, Authorization
Preflight Cache: 86400s (24 hours)
Origins: Configured via CORS_ORIGINS env var
```

### Request Body Limits

| Content Type              | Max Size                          |
| ------------------------- | --------------------------------- |
| JSON (`application/json`) | 10 KB                             |
| URL-encoded               | 10 KB (max 50 parameters)         |
| File upload (multer)      | 10 MB (SmartBill), 1 MB (B2B CSV) |

---

## 8. Request Processing Pipeline

Every request passes through this middleware chain in order:

```
1. Helmet (security headers)
2. CORS
3. Cookie Parser
4. Compression (gzip)
5. Body Parser (JSON, URL-encoded with 10KB limit)
6. Request ID (generates X-Request-ID UUID)
7. Distributed Tracing (links spans via request ID)
8. Input Sanitization (XSS, prototype pollution, injection)
9. Audit Trail (logs all requests, persists writes to DB)
10. CSRF Protection (origin/referer validation, production only)
11. Global Rate Limiter (100 req/15min)
12. Endpoint-Specific Rate Limiters (login, 2FA, writes)
13. Metrics Collection
14. Route Handler (authenticate -> requireRole -> controller)
15. Error Handler (500 catch-all)
16. 404 Handler
```

---

## 9. Account Lockout

**Source:** `modules/users/src/api/controllers/UserController.ts`

### Mechanism

Failed login attempts are tracked per user. After too many failures, the account is temporarily locked.

### Behavior

1. On failed login: increment `failed_login_attempts` counter and potentially set `locked_until` timestamp
2. On successful login: reset `failed_login_attempts` to 0
3. If `locked_until` is in the future: reject login with 403

### Response (Locked Account)

```json
{
  "error": "Account temporarily locked",
  "message": "Too many failed login attempts. Please try again in 14 minutes.",
  "lockedUntil": "2026-02-15T12:30:00.000Z"
}
```

---

## Security Checklist

- [x] JWT with HttpOnly cookies (prevents XSS token theft)
- [x] Separate access/refresh token secrets
- [x] Auto-refresh via middleware (transparent to client)
- [x] TOTP-based 2FA with backup codes
- [x] Pre-auth token pattern for 2FA login flow
- [x] Per-IP rate limiting at multiple tiers
- [x] Account lockout after failed attempts
- [x] Input sanitization (XSS, prototype pollution, injection)
- [x] CSRF protection via origin validation (production)
- [x] Comprehensive audit logging to database
- [x] Sensitive field redaction in audit logs
- [x] Security headers via Helmet
- [x] CORS with allowlist
- [x] Request body size limits
- [x] RBAC with role middleware
- [x] Parameterized SQL queries (TypeORM)
- [x] Graceful shutdown handling
