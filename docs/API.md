# External API Documentation

This document describes the External API (v1) for the karate class website.

## Overview

- **Base Path:** `/api/v1/`
- **Authentication:** Supabase JWT (Bearer token)
- **Authorization:** Most endpoints require admin role
- **Format:** JSON requests and responses
- **Error Handling:** Standard HTTP status codes with JSON error messages

## Authentication

All API requests (except registration) require a valid Supabase JWT token in the Authorization header:

```bash
Authorization: Bearer <YOUR_SUPABASE_JWT>
```

## Endpoints

### Family Management

#### Get Family Information

**`GET /api/v1/families/{familyId}`**

- **Description:** Retrieves comprehensive family information including students and 1:1 session balance
- **Authorization:** Requires admin role
- **Parameters:**
  - `familyId` (path): UUID of the family
- **Example Request:**
  ```bash
  curl -X GET "https://<your-domain>/api/v1/families/YOUR_FAMILY_ID" \
       -H "Authorization: Bearer <YOUR_SUPABASE_JWT>"
  ```
- **Example Success Response (200 OK):**
  ```json
  {
    "id": "uuid-for-family",
    "name": "Smith Family",
    "email": "smith@example.com",
    "phone": "+1234567890",
    "address": "123 Main St, City, State 12345",
    "emergency_contact": "Jane Smith - +1987654321",
    "one_on_one_balance": 450,
    "students": [
      {
        "id": "uuid-for-student",
        "first_name": "John",
        "last_name": "Smith",
        "date_of_birth": "2010-05-15",
        "belt_level": "yellow",
        "active": true
      }
    ]
  }
  ```
- **Example Error Responses:**
  - `401 Unauthorized`
  - `403 Forbidden`: `{"error": "Forbidden: Admin access required."}`
  - `404 Not Found`: `{"error": "Family not found"}`
  - `500 Internal Server Error`

#### Get Current User's Family

**`GET /api/v1/family/me`**

- **Description:** Retrieves the authenticated user's family information
- **Authorization:** Requires standard user authentication
- **Example Request:**
  ```bash
  curl -X GET "https://<your-domain>/api/v1/family/me" \
       -H "Authorization: Bearer <YOUR_SUPABASE_JWT>"
  ```
- **Example Success Response (200 OK):**
  ```json
  {
    "id": "uuid-for-family",
    "name": "Smith Family",
    "email": "smith@example.com",
    "phone": "+1234567890",
    "address": "123 Main St, City, State 12345",
    "emergency_contact": "Jane Smith - +1987654321",
    "one_on_one_balance": 450,
    "students": [
      {
        "id": "uuid-for-student",
        "first_name": "John",
        "last_name": "Smith",
        "date_of_birth": "2010-05-15",
        "belt_level": "yellow",
        "active": true
      }
    ]
  }
  ```
- **Example Error Responses:**
  - `401 Unauthorized`
  - `404 Not Found`: `{"error": "Family not found for user"}`
  - `500 Internal Server Error`

### Student Management

#### Get Student Information

**`GET /api/v1/students/{studentId}`**

- **Description:** Retrieves detailed student information
- **Authorization:** Requires admin role
- **Parameters:**
  - `studentId` (path): UUID of the student
- **Example Request:**
  ```bash
  curl -X GET "https://<your-domain>/api/v1/students/YOUR_STUDENT_ID" \
       -H "Authorization: Bearer <YOUR_SUPABASE_JWT>"
  ```
- **Example Success Response (200 OK):**
  ```json
  {
    "id": "uuid-for-student",
    "first_name": "John",
    "last_name": "Smith",
    "date_of_birth": "2010-05-15",
    "belt_level": "yellow",
    "active": true,
    "family_id": "uuid-for-family",
    "notes": "Progressing well with kata"
  }
  ```
- **Example Error Responses:**
  - `401 Unauthorized`
  - `403 Forbidden`: `{"error": "Forbidden: Admin access required."}`
  - `404 Not Found`: `{"error": "Student not found"}`
  - `500 Internal Server Error`

### Guardian Management

#### List Family Guardians

**`GET /api/v1/families/{familyId}/guardians`**

- **Description:** Lists all guardians for a specific family
- **Authorization:** Requires user authentication (admin or family member)
- **Parameters:**
  - `familyId` (path): UUID of the family
- **Example Request:**
  ```bash
  curl -X GET "https://<your-domain>/api/v1/families/YOUR_FAMILY_ID/guardians" \
       -H "Authorization: Bearer <YOUR_SUPABASE_JWT>"
  ```
- **Example Success Response (200 OK):**
  ```json
  [
    {
      "id": "uuid-for-guardian-1",
      "first_name": "Jane",
      "last_name": "Smith",
      "email": "jane@example.com",
      "phone": "+1234567890",
      "relationship": "mother",
      "is_primary": true
    },
    {
      "id": "uuid-for-guardian-2",
      "first_name": "Bob",
      "last_name": "Smith",
      "email": "bob@example.com",
      "phone": "+1987654321",
      "relationship": "father",
      "is_primary": false
    }
  ]
  ```
- **Example Error Responses:**
  - `401 Unauthorized`
  - `403 Forbidden`: `{"error": "Forbidden: You do not have permission to view guardians for this family."}`
  - `404 Not Found`: `{"error": "Family not found"}`
  - `500 Internal Server Error`

#### Create Guardian

**`POST /api/v1/families/{familyId}/guardians`**

- **Description:** Creates a new guardian for a family
- **Authorization:** Requires user authentication (admin or family member)
- **Parameters:**
  - `familyId` (path): UUID of the family
- **Request Body:**
  ```json
  {
    "first_name": "Alice",
    "last_name": "Smith",
    "email": "alice@example.com",
    "phone": "+1555123456",
    "relationship": "aunt",
    "is_primary": false
  }
  ```
- **Example Request:**
  ```bash
  curl -X POST "https://<your-domain>/api/v1/families/YOUR_FAMILY_ID/guardians" \
       -H "Authorization: Bearer <YOUR_SUPABASE_JWT>" \
       -H "Content-Type: application/json" \
       -d '{"first_name":"Alice","last_name":"Smith","email":"alice@example.com","phone":"+1555123456","relationship":"aunt","is_primary":false}'
  ```
- **Example Success Response (201 Created):**
  ```json
  {
    "id": "uuid-for-new-guardian",
    "first_name": "Alice",
    "last_name": "Smith",
    "email": "alice@example.com",
    "phone": "+1555123456",
    "relationship": "aunt",
    "is_primary": false,
    "family_id": "uuid-for-family"
  }
  ```
- **Example Error Responses:**
  - `400 Bad Request`: `{"error": "Invalid guardian data"}`
  - `401 Unauthorized`
  - `403 Forbidden`: `{"error": "Forbidden: You do not have permission to create guardians for this family."}`
  - `409 Conflict`: `{"error": "Guardian with this email already exists for this family"}`
  - `500 Internal Server Error`

#### Get Guardian

**`GET /api/v1/guardians/{guardianId}`**

- **Description:** Retrieves specific guardian information
- **Authorization:** Requires user authentication (admin or guardian's family member)
- **Parameters:**
  - `guardianId` (path): UUID of the guardian
- **Example Request:**
  ```bash
  curl -X GET "https://<your-domain>/api/v1/guardians/YOUR_GUARDIAN_ID" \
       -H "Authorization: Bearer <YOUR_SUPABASE_JWT>"
  ```
- **Example Success Response (200 OK):**
  ```json
  {
    "id": "uuid-for-guardian",
    "first_name": "Jane",
    "last_name": "Smith",
    "email": "jane@example.com",
    "phone": "+1234567890",
    "relationship": "mother",
    "is_primary": true,
    "family_id": "uuid-for-family"
  }
  ```
- **Example Error Responses:**
  - `401 Unauthorized`
  - `403 Forbidden`: `{"error": "Forbidden: You do not have permission to view this guardian."}`
  - `404 Not Found`: `{"error": "Guardian not found"}`
  - `500 Internal Server Error`

#### Update Guardian

**`PUT /api/v1/guardians/{guardianId}`**

- **Description:** Updates guardian information
- **Authorization:** Requires user authentication (admin or guardian's family member)
- **Parameters:**
  - `guardianId` (path): UUID of the guardian
- **Request Body:**
  ```json
  {
    "first_name": "Jane",
    "last_name": "Smith-Johnson",
    "email": "jane.johnson@example.com",
    "phone": "+1234567890",
    "relationship": "mother",
    "is_primary": true
  }
  ```
- **Example Request:**
  ```bash
  curl -X PUT "https://<your-domain>/api/v1/guardians/YOUR_GUARDIAN_ID" \
       -H "Authorization: Bearer <YOUR_SUPABASE_JWT>" \
       -H "Content-Type: application/json" \
       -d '{"first_name":"Jane","last_name":"Smith-Johnson","email":"jane.johnson@example.com","phone":"+1234567890","relationship":"mother","is_primary":true}'
  ```
- **Example Success Response (200 OK):**
  ```json
  {
    "id": "uuid-for-guardian",
    "first_name": "Jane",
    "last_name": "Smith-Johnson",
    "email": "jane.johnson@example.com",
    "phone": "+1234567890",
    "relationship": "mother",
    "is_primary": true,
    "family_id": "uuid-for-family"
  }
  ```
- **Example Error Responses:**
  - `400 Bad Request`: `{"error": "Invalid guardian data"}`
  - `401 Unauthorized`
  - `403 Forbidden`: `{"error": "Forbidden: You do not have permission to update this guardian."}`
  - `404 Not Found`: `{"error": "Guardian not found"}`
  - `409 Conflict`: `{"error": "Guardian with this email already exists"}`
  - `500 Internal Server Error`

#### Delete Guardian

**`DELETE /api/v1/guardians/{guardianId}`**

- **Description:** Deletes a guardian
- **Authorization:** Requires user authentication (admin or guardian's family member)
- **Parameters:**
  - `guardianId` (path): UUID of the guardian
- **Example Request:**
  ```bash
  curl -X DELETE "https://<your-domain>/api/v1/guardians/YOUR_GUARDIAN_ID" \
       -H "Authorization: Bearer <YOUR_SUPABASE_JWT>"
  ```
- **Example Success Response (204 No Content):** Empty response body
- **Example Error Responses:**
  - `401 Unauthorized`
  - `403 Forbidden`: `{"error": "Forbidden: You do not have permission to delete this guardian."}`
  - `404 Not Found`: `{"error": "Guardian not found"}`
  - `409 Conflict`: `{"error": "Cannot delete primary guardian"}`
  - `500 Internal Server Error`

### User Registration

#### Register New User

**`POST /api/v1/auth/register`**

- **Description:** Registers a new user, family, and first guardian
- **Authorization:** Public endpoint (no authentication required)
- **Request Body:**
  ```json
  {
    "email": "newuser@example.com",
    "password": "securepassword123",
    "first_name": "John",
    "last_name": "Doe",
    "phone": "+1234567890",
    "family_name": "Doe Family",
    "address": "456 Oak St, City, State 12345",
    "emergency_contact": "Jane Doe - +1987654321"
  }
  ```
- **Example Request:**
  ```bash
  curl -X POST "https://<your-domain>/api/v1/auth/register" \
       -H "Content-Type: application/json" \
       -d '{"email":"newuser@example.com","password":"securepassword123","first_name":"John","last_name":"Doe","phone":"+1234567890","family_name":"Doe Family","address":"456 Oak St, City, State 12345","emergency_contact":"Jane Doe - +1987654321"}'
  ```
- **Example Success Response (201 Created):**
  ```json
  {
    "user": {
      "id": "uuid-for-user",
      "email": "newuser@example.com"
    },
    "family": {
      "id": "uuid-for-family",
      "name": "Doe Family",
      "email": "newuser@example.com",
      "phone": "+1234567890",
      "address": "456 Oak St, City, State 12345",
      "emergency_contact": "Jane Doe - +1987654321"
    },
    "guardian": {
      "id": "uuid-for-guardian",
      "first_name": "John",
      "last_name": "Doe",
      "email": "newuser@example.com",
      "phone": "+1234567890",
      "relationship": "parent",
      "is_primary": true
    }
  }
  ```
- **Example Error Responses:**
  - `400 Bad Request`: `{"error": "Invalid registration data"}`
  - `409 Conflict`: `{"error": "User with this email already exists"}`
  - `500 Internal Server Error`

### Discount Management

#### Validate Discount Code

**`POST /api/discount-codes/validate`**

- **Description:** Validates a discount code for a specific family and context
- **Authorization:** Requires user authentication
- **Request Body:**
  ```json
  {
    "code": "SAVE20",
    "familyId": "uuid-for-family",
    "studentId": "uuid-for-student",
    "applicableTo": "training",
    "amount": 5000
  }
  ```
- **Example Request:**
  ```bash
  curl -X POST "https://<your-domain>/api/discount-codes/validate" \
       -H "Authorization: Bearer <YOUR_SUPABASE_JWT>" \
       -H "Content-Type: application/json" \
       -d '{"code":"SAVE20","familyId":"uuid-for-family","studentId":"uuid-for-student","applicableTo":"training","amount":5000}'
  ```
- **Example Success Response (200 OK):**
  ```json
  {
    "valid": true,
    "discountAmount": 1000,
    "discountCode": {
      "id": "uuid-for-discount-code",
      "code": "SAVE20",
      "name": "20% Off Training",
      "discount_type": "percentage",
      "discount_value": 20
    }
  }
  ```
- **Example Error Responses:**
  - `400 Bad Request`: `{"error": "Invalid or expired discount code"}`
  - `401 Unauthorized`
  - `500 Internal Server Error`

#### Get Available Discounts

**`GET /api/available-discounts/{familyId}`**

- **Description:** Retrieves available discount codes for a specific family, filtered by applicability and usage restrictions
- **Authorization:** Requires standard user authentication. User must be an admin or belong to the specified family
- **Parameters:**
  - `familyId` (path): UUID of the family
- **Query Parameters:**
  - `applicableTo` (optional): Filter by applicability ("training", "store", "both")
  - `studentId` (optional): Include student-specific discounts
- **Example Request:**
  ```bash
  curl -X GET "https://<your-domain>/api/available-discounts/YOUR_FAMILY_ID?applicableTo=training" \
       -H "Authorization: Bearer <YOUR_SUPABASE_JWT>"
  ```
- **Example Success Response (200 OK):**
  ```json
  [
    {
      "id": "uuid-for-discount-code-1",
      "code": "WELCOME10",
      "name": "Welcome Discount",
      "description": "10% off first month",
      "discount_type": "percentage",
      "discount_value": 10,
      "applicable_to": "training",
      "scope": "per_family",
      "usage_type": "one_time",
      "valid_until": "2024-12-31T23:59:59.000Z"
    }
  ]
  ```
- **Example Error Responses:**
  - `401 Unauthorized`
  - `403 Forbidden`: `{"error": "Forbidden: You do not have permission to view discounts for this family."}`
  - `500 Internal Server Error`

## Error Handling

All API endpoints return standard HTTP status codes:

- **200 OK**: Request successful
- **201 Created**: Resource created successfully
- **204 No Content**: Request successful, no content to return
- **400 Bad Request**: Invalid request data
- **401 Unauthorized**: Authentication required or invalid
- **403 Forbidden**: Insufficient permissions
- **404 Not Found**: Resource not found
- **409 Conflict**: Resource conflict (e.g., duplicate email)
- **500 Internal Server Error**: Server error

Error responses include a JSON object with an `error` field describing the issue:

```json
{
  "error": "Description of the error"
}
```

## Rate Limiting

API endpoints may be subject to rate limiting. If you exceed the rate limit, you'll receive a `429 Too Many Requests` response.

## Support

For API support or questions, please contact the development team or refer to the main project documentation.