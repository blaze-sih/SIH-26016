# LRVS Backend — API Reference
## Team BLAZE | SIH26016 | Land Record Verification System

---

## Quick Start

```bash
cd backend
npm install
# Copy .env.example to .env and configure
npm run dev      # Development (nodemon)
npm start        # Production
npm test         # Run tests
```

**Default Port:** `9000`
**Health Check:** `GET http://localhost:9000/api/health`

---

## Environment Variables

| Variable | Description | Default |
|---|---|---|
| `PORT` | Server port | `9000` |
| `MONGO_URI` | MongoDB connection string | `mongodb://127.0.0.1:27017/sih26016` |
| `JWT_SECRET` | JWT signing secret | **required** |
| `JWT_EXPIRES_IN` | Token expiry | `7d` |
| `AI_SERVICE_URL` | AI service base URL | `http://localhost:8000` |
| `AI_TIMEOUT_MS` | AI request timeout | `120000` |
| `BLOCKCHAIN_MOCK` | Use mock blockchain | `true` |
| `BLOCKCHAIN_RPC_URL` | Ethereum RPC endpoint | — |
| `BLOCKCHAIN_PRIVATE_KEY` | Signer private key | — |
| `BLOCKCHAIN_CONTRACT_ADDRESS_LAND` | LandRecord.sol address | — |
| `BLOCKCHAIN_CONTRACT_ADDRESS_APPROVAL` | Approval.sol address | — |
| `BLOCKCHAIN_CONTRACT_ADDRESS_COMPENSATION` | Compensation.sol address | — |
| `UPLOAD_DIR` | Document upload directory | `uploads` |
| `MAX_FILE_SIZE_MB` | Max upload size | `20` |
| `CORS_ORIGIN` | Allowed CORS origin | `http://localhost:3000` |

---

## User Roles

| Role | Description |
|---|---|
| `SUPER_ADMIN` | Full system access |
| `CENTRAL_AUTHORITY` | Central-level approvals |
| `STATE_AUTHORITY` | State-level approvals |
| `DISTRICT_AUTHORITY` | District-level approvals |
| `VERIFICATION_OFFICER` | Data Checker — verifies AI-extracted data |
| `FINANCE_OFFICER` | Compensation management |
| `PROJECT_OFFICER` | Data Adder — creates records, uploads documents |
| `LAND_OWNER` | Citizen portal access |
| `VIEWER` | Read-only access |

---

## API Endpoints

### Base URL: `http://localhost:9000/api`

---

### 🔐 Authentication

#### `POST /auth/register`
**Auth:** None | **Roles:** Open

Register a new user.

**Request:**
```json
{
  "name": "Officer Name",
  "email": "officer@lrvs.gov.in",
  "password": "SecurePass123!",
  "role": "VERIFICATION_OFFICER",
  "department": "Revenue",
  "state": "Maharashtra",
  "district": "Pune"
}
```

**Response `201`:**
```json
{
  "success": true,
  "message": "User registered successfully.",
  "data": { "token": "...", "user": { "userId": "...", "email": "...", "role": "..." } }
}
```

**Errors:** `400 VALIDATION_ERROR` · `409 DUPLICATE_EMAIL`

---

#### `POST /auth/login`
**Auth:** None

**Request:**
```json
{ "email": "officer@lrvs.gov.in", "password": "SecurePass123!" }
```

**Response `200`:**
```json
{ "success": true, "data": { "token": "JWT_TOKEN", "user": { ... } } }
```

**Errors:** `400` · `401 INVALID_CREDENTIALS`

---

#### `GET /auth/me`
**Auth:** Bearer token

**Response `200`:** Current user object.

---

#### `POST /auth/logout`
**Auth:** Bearer token

Writes audit log. JWT must be discarded client-side.

---

### 📋 Land Records

#### `POST /land`
**Auth:** Bearer | **Roles:** Officers (non-VIEWER, non-LAND_OWNER)

Create a new land acquisition request (starts in `DRAFT` status).

**Request:**
```json
{
  "surveyNumber": "123/A",
  "district": "Pune",
  "taluka": "Haveli",
  "village": "Vadgaon",
  "state": "Maharashtra",
  "owners": [{ "name": "Ramesh Patil", "share": "1/2" }],
  "area": { "unit": "Hectare", "total": "2.5", "cultivable": "2.0", "uncultivable": "0.5" },
  "acquisitionPurpose": "Road widening",
  "location": { "latitude": 18.5204, "longitude": 73.8567 }
}
```

**Response `201`:** `{ "data": { "record": { "requestId": "LRVS-...", "acquisitionStatus": "DRAFT" } } }`

---

#### `GET /land/requests`
**Auth:** Bearer

**Query Params:**
- `page`, `limit` (default: 1, 10)
- `status` — acquisition status filter
- `district`, `state` — location filter
- `search` — searches requestId, registrationNumber, surveyNumber, owner name
- `dateFrom`, `dateTo` — ISO date range
- `sortBy`, `sortOrder`

**Response `200`:** Paginated list with `pagination` object.

---

#### `GET /land/map`
**Auth:** Bearer

Returns GIS markers for all records that have coordinates.

**Query:** `district`, `state`, `status`

---

#### `GET /land/:requestId`
**Auth:** Bearer

Returns full record with populated references.

**Errors:** `404 NOT_FOUND`

---

#### `PATCH /land/:requestId`
**Auth:** Bearer | **Roles:** Officers

Update record fields.

---

#### `POST /land/:requestId/submit`
**Auth:** Bearer | **Roles:** Officers

Transition: `DRAFT` → `SUBMITTED`

---

#### `GET /land/:requestId/location`
**Auth:** Bearer

Returns GIS coordinates for a specific record.

---

#### `GET /land/:requestId/audit`
**Auth:** Bearer

Returns paginated audit trail for a request.

---

### 📄 Documents

#### `POST /documents/upload`
**Auth:** Bearer | **Roles:** Officers

Upload a land document (PDF/image). Automatically:
1. Saves file to `uploads/documents/`
2. Computes SHA-256 hash
3. Registers hash on blockchain (non-blocking)
4. Creates Document record

**Request:** `multipart/form-data`
- `document` — file
- `requestId` — land request ID
- `documentType` — one of: `712_EXTRACT` | `FORM_8A` | `SALE_DEED` | `MUTATION_ENTRY` | `IDENTITY_DOCUMENT` | ...
- `description` — optional

**Response `201`:** `{ "data": { "document": { "documentId": "...", "hash": "sha256...", ... } } }`

---

#### `GET /documents/land/:requestId`
**Auth:** Bearer

Returns all documents for a land request.

---

#### `GET /documents/:documentId`
**Auth:** Bearer

Returns document metadata.

---

#### `GET /documents/:documentId/file`
**Auth:** Bearer

Serves the actual document file (PDF/image).

---

#### `POST /documents/:documentId/process-ai`
**Auth:** Bearer | **Roles:** Officers

Trigger AI extraction for a supported document type (`712_EXTRACT`, `FORM_8A`, `MUTATION_ENTRY`).

Flow:
1. Validates document exists and type is supported
2. Creates `ProcessingJob`
3. Calls AI service at `AI_SERVICE_URL/process-document`
4. Validates AI JSON schema
5. Stores extracted data with confidence map
6. Creates `Verification` record
7. Transitions land record to `PENDING_VERIFICATION`

**Response `200` (success):**
```json
{
  "data": {
    "job": {
      "jobId": "...",
      "status": "COMPLETED",
      "modelName": "Qwen2.5-VL-7B-Instruct",
      "pagesProcessed": 2,
      "overallConfidence": null,
      "validationWarnings": [],
      "extractedFieldCount": 12
    }
  }
}
```

**Response `502` (AI unavailable):**
```json
{
  "success": false,
  "message": "AI processing failed. Document is preserved. You may retry or proceed with manual verification.",
  "error": { "code": "AI_SERVICE_UNAVAILABLE", "details": { "jobId": "..." } }
}
```

---

#### `GET /documents/:documentId/job-status`
**Auth:** Bearer

Poll AI processing job status.

**Response:** Full `ProcessingJob` object with `status`, `progress`, `extractedData`, `fieldConfidence`, `validationWarnings`.

---

### ✅ Verification (Data Checker)

#### `GET /verification/queue`
**Auth:** Bearer | **Roles:** Verification officers

**Query Params:**
- `page`, `limit`
- `status` — `PENDING` | `INCOMPLETE` | `VERIFIED`
- `documentType`
- `confidence` — `HIGH` (≥0.8) | `MEDIUM` (≥0.5) | `LOW` (<0.5)
- `search` — requestId, surveyNumber, district
- `dateFrom`, `dateTo`

---

#### `GET /verification/:requestId`
**Auth:** Bearer | **Roles:** Verification officers

Returns the full Data Checker view:
```json
{
  "data": {
    "verification": { "status": "PENDING", "aiSnapshot": {}, "verifiedSnapshot": {}, "fieldChanges": [] },
    "landRecord": { "requestId": "...", "district": "...", ... },
    "document": { "documentType": "712_EXTRACT", "originalName": "...", "url": "/uploads/..." },
    "processingJob": { "extractedData": {}, "fieldConfidence": {}, "overallConfidence": null, "validationWarnings": [] },
    "documentUrl": "/uploads/documents/..."
  }
}
```

**Left panel:** PDF served at `documentUrl`
**Right panel:** `processingJob.extractedData` with `fieldConfidence`

---

#### `POST /verification/:requestId/update-field`
**Auth:** Bearer | **Roles:** Verification officers

Correct an AI-extracted field. **Original AI value is preserved.**

**Request:**
```json
{
  "fieldPath": "district",
  "verifiedValue": "Pune",
  "reason": "AI extracted incorrectly — verified against source document"
}
```

**Response `200`:** Updated verification with `fieldChanges` array.

---

#### `POST /verification/:requestId/verify`
**Auth:** Bearer | **Roles:** Verification officers

Mark record as verified. Triggers:
1. Verification status → `VERIFIED`
2. Land record → `VERIFIED`
3. Blockchain hash of verified snapshot
4. Creates Approval record
5. Land record → `PENDING_APPROVAL`

**Request:** `{ "remarks": "Optional remarks" }`

---

#### `POST /verification/:requestId/incomplete`
**Auth:** Bearer | **Roles:** Verification officers

Mark record as incomplete. **Remarks required.**

**Request:** `{ "remarks": "Missing survey number on page 2" }`

---

### 🏛️ Approvals (Approval Manager)

#### `GET /approvals/queue`
**Auth:** Bearer | **Roles:** District/State/Central/Super authority

**Query:** `page`, `limit`, `action`, `district`, `state`, `search`

---

#### `GET /approvals/stats`
**Auth:** Bearer | **Roles:** Approvers

Returns `{ pending, approved, rejected, forwarded, total }`.

---

#### `GET /approvals/:id`
**Auth:** Bearer | **Roles:** Approvers

Full approval detail.

---

#### `POST /approvals/:id/approve`
**Auth:** Bearer | **Roles:** Approvers

Approve a request. Triggers:
1. Approval → `APPROVED`
2. Land record → `APPROVED`
3. SHA-256 of approval record computed
4. Blockchain anchoring

**Request:** `{ "remarks": "Approved after thorough review" }`

---

#### `POST /approvals/:id/reject`
**Auth:** Bearer | **Roles:** Approvers

**Remarks required.**

**Request:** `{ "remarks": "Survey number mismatch with land records" }`

---

#### `POST /approvals/:id/forward`
**Auth:** Bearer | **Roles:** Approvers

**Request:**
```json
{
  "forwardedTo": "<userId>",
  "forwardedToAuthority": "STATE_AUTHORITY",
  "remarks": "Forwarded for state-level review"
}
```

---

### 💰 Compensation

#### `GET /compensation/stats`
**Auth:** Bearer

#### `GET /compensation/:requestId`
**Auth:** Bearer

#### `POST /compensation`
**Auth:** Bearer | **Roles:** Finance/authority officers

**Request:**
```json
{
  "requestId": "LRVS-...",
  "ownerName": "Ramesh Patil",
  "assessedAmount": 2500000,
  "remarks": "Based on circle rate assessment"
}
```

#### `POST /compensation/:id/approve`
**Auth:** Bearer | **Roles:** Approvers

**Request:** `{ "approvedAmount": 2500000, "remarks": "..." }`

#### `POST /compensation/:id/process-payment`
**Auth:** Bearer | **Roles:** Finance officers

Generates mock payment reference. No real banking transfer.

---

### 📊 Dashboard

All dashboard routes require authentication.

| Endpoint | Description |
|---|---|
| `GET /dashboard/summary` | Overall counts + land area + compensation totals |
| `GET /dashboard/project-wise` | Breakdown by project |
| `GET /dashboard/state-wise` | Breakdown by state |
| `GET /dashboard/district-wise` | Breakdown by district (optional `?state=`) |
| `GET /dashboard/timeline` | Records over time (`?groupBy=month&dateFrom=&dateTo=`) |
| `GET /dashboard/verification-activity` | Verification stats by date range |
| `GET /dashboard/request-distribution` | Status distribution with percentages |

**Summary Response:**
```json
{
  "data": {
    "summary": {
      "pendingRequests": 12,
      "inReview": 5,
      "approved": 8,
      "rejected": 2,
      "total": 27,
      "totalLandProposed": 45.5,
      "totalLandAcquired": 18.2,
      "compensationAssessed": 12500000,
      "compensationPaid": 8000000,
      "possessionCompleted": 3,
      "affectedFamilies": 45,
      "displacedFamilies": 12
    }
  }
}
```

---

### 🏥 System

| Endpoint | Auth | Description |
|---|---|---|
| `GET /api/health` | None | Health check |
| `GET /api/system/status` | None | Service status for all subsystems |

**System Status Response:**
```json
{
  "data": {
    "backend": "UP",
    "database": "UP",
    "aiService": "DOWN",
    "blockchain": "MOCK",
    "storage": "UP"
  }
}
```

---

## Land Acquisition Lifecycle

```
DRAFT → SUBMITTED → AI_PROCESSING → AI_PROCESSED → PENDING_VERIFICATION
     ↕                    ↓
   REJECTED          AI_FAILED
                         ↓
              PENDING_VERIFICATION ← (manual or retry)
                         ↓
           VERIFIED / VERIFICATION_INCOMPLETE
                         ↓
              PENDING_APPROVAL
                         ↓
              APPROVED / REJECTED
                         ↓
             COMPENSATION_PENDING
                         ↓
            COMPENSATION_APPROVED
                         ↓
              COMPENSATION_PAID
                         ↓
             POSSESSION_PENDING
                         ↓
            POSSESSION_COMPLETED
                         ↓
                       CLOSED
```

---

## AI Integration

The backend communicates with the AI service (Python/FastAPI) over HTTP.

**AI Service Contract (POST /process-document):**

```json
Request:
{
  "documentId": "uuid",
  "documentType": "712_EXTRACT",
  "filePath": "/path/to/file.pdf",
  "language": "mr",
  "schemaVersion": "v1"
}

Response:
{
  "success": true,
  "documentType": "712_EXTRACT",
  "model": "Qwen2.5-VL-7B-Instruct",
  "schemaVersion": "v1",
  "processingTimeMs": 1234,
  "pagesProcessed": 2,
  "extractedData": {
    "district": "पुणे",
    "taluka": "हवेली",
    "village": "वडगाव",
    "village_code": "123456",
    "survey_number": "123/A",
    "owners": [{ "name": "रमेश पाटील" }],
    "area": { "unit": "Hectare", "total": "२.५", ... }
  },
  "fieldConfidence": {},
  "overallConfidence": null,
  "warnings": [],
  "errors": []
}
```

**If AI is unavailable:**
- Document is preserved
- `ProcessingJob` is marked `FAILED`
- Land record moves to `AI_FAILED`
- Manual verification is available without AI data

---

## Blockchain Integration

Contracts deployed on configured network (`BLOCKCHAIN_NETWORK`).

| Action | Contract | Method |
|---|---|---|
| Document uploaded | `LandRecord.sol` | `registerDocument(bytes32, string)` |
| Record verified | `LandRecord.sol` | `registerLandRecord(bytes32, string)` |
| Approved | `Approval.sol` | `recordApproval(bytes32, string, string)` |
| Compensation paid | `Compensation.sol` | `recordCompensation(bytes32, string, uint256)` |

**Mock Mode:** Set `BLOCKCHAIN_MOCK=true` to skip on-chain calls (returns `0xmock_...` hashes).

---

## Standard Response Format

```json
// Success
{ "success": true, "message": "...", "data": {} }

// Error
{ "success": false, "message": "...", "error": { "code": "...", "details": {} } }

// Paginated
{ "success": true, "message": "...", "data": [], "pagination": { "page": 1, "limit": 10, "total": 50, "totalPages": 5 } }
```

---

## Error Codes

| HTTP | Code | Description |
|---|---|---|
| 400 | `VALIDATION_ERROR` | Request body validation failed |
| 401 | `UNAUTHORIZED` | Missing or invalid token |
| 401 | `TOKEN_EXPIRED` | JWT expired |
| 403 | `FORBIDDEN` | Insufficient role |
| 404 | `NOT_FOUND` | Resource not found |
| 409 | `CONFLICT` / `INVALID_STATUS_TRANSITION` | State machine violation |
| 413 | `FILE_TOO_LARGE` | Upload exceeds limit |
| 422 | `AI_SCHEMA_ERROR` | AI response failed validation |
| 429 | `TOO_MANY_REQUESTS` | Rate limit exceeded |
| 502 | `AI_SERVICE_UNAVAILABLE` | AI service unreachable |
| 503 | `SERVICE_UNAVAILABLE` | Database down |
