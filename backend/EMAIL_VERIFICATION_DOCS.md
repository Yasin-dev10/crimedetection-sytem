# Email Verification and Automatic Password Generation Documentation

## Overview
This document describes the implementation of email verification and automatic password generation for new Investigators in the BAREAI system.

## Features Implemented

### 1. Email Verification
- When a new Investigator is created, an email verification token is generated
- A verification email is sent to the Investigator's email address
- The verification link in the email expires after 24 hours
- Users must verify their email before they can fully use their account

### 2. Automatic Password Generation
- When a new Investigator is created, a random secure password is automatically generated
- The password contains a mix of uppercase, lowercase, numbers, and special characters
- The generated username (email) and password are sent via email to the Investigator
- The Investigator is prompted to change the password on first login

### 3. Password Change with Verification
- Users can request to change their password
- A verification email is sent with a time-limited link (1 hour expiry)
- The password can only be changed through the verified link
- After successful password change, the requirement flag is cleared

## Database Schema Changes

### User Model Updates
New fields added to the User schema:

```javascript
emailVerified: {
  type: Boolean,
  default: false
}

emailVerificationToken: {
  type: String,
  default: null
}

emailVerificationTokenExpiry: {
  type: Date,
  default: null
}

isPasswordChangeRequired: {
  type: Boolean,
  default: false
}

passwordChangeToken: {
  type: String,
  default: null
}

passwordChangeTokenExpiry: {
  type: Date,
  default: null
}
```

## API Endpoints

### 1. Create Investigator (Modified)
**Endpoint:** `POST /api/auth/create-investigator`

**Authentication:** Required (Admin only)

**Request Body:**
```json
{
  "name": "John Doe",
  "email": "john@example.com",
  "badgeNumber": "INV123",
  "station": "Central Police Station",
  "phone": "+1234567890"
}
```

**Response:**
```json
{
  "message": "Investigator created successfully. Credentials and verification email sent.",
  "user": {
    "_id": "user_id",
    "name": "John Doe",
    "email": "john@example.com",
    "emailVerified": false,
    "isPasswordChangeRequired": true,
    "role": "investigator"
  }
}
```

### 2. Verify Email
**Endpoint:** `POST /api/auth/verify-email`

**Authentication:** Not required

**Request Body:**
```json
{
  "token": "verification_token_from_email"
}
```

**Response:**
```json
{
  "message": "Email verified successfully",
  "user": {
    "id": "user_id",
    "email": "john@example.com",
    "emailVerified": true
  }
}
```

**Frontend Route:** `/verify-email?token={verification_token}`

### 3. Request Password Change
**Endpoint:** `POST /api/auth/request-password-change`

**Authentication:** Required (Authenticated user)

**Request Body:** None (uses authenticated user)

**Response:**
```json
{
  "message": "Password change verification email sent successfully"
}
```

### 4. Change Password with Verification
**Endpoint:** `POST /api/auth/change-password-verified`

**Authentication:** Not required (uses token from email)

**Request Body:**
```json
{
  "token": "password_change_token_from_email",
  "newPassword": "new_secure_password"
}
```

**Response:**
```json
{
  "message": "Password changed successfully",
  "user": {
    "id": "user_id",
    "email": "john@example.com",
    "isPasswordChangeRequired": false
  }
}
```

**Frontend Route:** `/change-password?token={password_change_token}`

## Email Service Updates

### New Email Functions
- `sendVerificationEmail(to, verificationToken, userName)` - Sends email verification link
- `sendCredentialsEmail(to, userName, password, role)` - Sends login credentials
- `sendPasswordChangeVerificationEmail(to, changeToken, userName)` - Sends password change link

## Utility Functions

New file: `backend/utils/authUtils.js`

- `generateRandomPassword(length)` - Generates secure random password
- `generateEmailVerificationToken()` - Generates email verification token
- `generatePasswordChangeToken()` - Generates password change token
- `getEmailTokenExpiry()` - Returns 24-hour expiry time
- `getPasswordChangeTokenExpiry()` - Returns 1-hour expiry time

## Frontend Components

### 1. VerifyEmailPage
**File:** `frontend/src/page/VerifyEmailPage.jsx`

- Route: `/verify-email?token={token}`
- Displays verification status
- Redirects to login on success
- Shows error message on failure

### 2. ChangePasswordPage
**File:** `frontend/src/page/ChangePasswordPage.jsx`

- Route: `/change-password?token={token}`
- Form to enter new password
- Password confirmation validation
- Shows success/error messages
- Redirects to login on success

### 3. ChangePasswordModal
**File:** `frontend/src/components/ChangePasswordModal.jsx`

- Modal component for requesting password change
- Integrated into user profile/settings
- Sends verification email
- Shows confirmation message

## Environment Variables

Add to `.env` file:
```
FRONTEND_URL=http://localhost:5173
```

## Login Flow with New Features

1. User logs in with email and password
2. Login response includes:
   - `emailVerified` - Whether email is verified
   - `isPasswordChangeRequired` - Whether password change is required
3. Frontend checks these flags:
   - If `emailVerified` is false, prompt for email verification
   - If `isPasswordChangeRequired` is true, prompt to request password change
4. After password change, user can proceed normally

## Email Templates

### Verification Email
- Subject: "BAAREAI - Email Verification Required"
- Contains verification link
- 24-hour expiry notice

### Credentials Email
- Subject: "BAAREAI - Your Login Credentials"
- Contains email and auto-generated password
- Security warnings about credential confidentiality
- Link to login page

### Password Change Email
- Subject: "BAAREAI - Password Change Verification"
- Contains password change link
- 1-hour expiry notice
- Security notice if not requested

## Security Considerations

1. **Tokens are single-use** - Used only once and then cleared
2. **Tokens have expiration** - Email: 24 hours, Password: 1 hour
3. **Password hashing** - All passwords are bcrypt hashed
4. **Email verification** - Prevents unauthorized account creation
5. **Token generation** - Uses crypto.randomBytes for security
6. **Protected endpoints** - Password change requires email verification or token

## Testing

### Manual Testing Steps

1. **Create Investigator:**
   - Call POST /api/auth/create-investigator with admin token
   - Check email for verification and credentials emails

2. **Verify Email:**
   - Extract token from verification email
   - Navigate to /verify-email?token={token}
   - Verify success page appears

3. **Change Password:**
   - Log in with generated password
   - Request password change
   - Extract token from email
   - Navigate to /change-password?token={token}
   - Enter new password and verify

## Troubleshooting

### Emails not sending
- Check EMAIL_USER and EMAIL_PASS in .env
- Verify Gmail App Password is set correctly
- Check firewall/network settings

### Token expired errors
- Email tokens: 24 hours from generation
- Password change tokens: 1 hour from generation
- Request new token if expired

### Email verification stuck
- Clear browser cache
- Check if token is still valid
- Request new verification email

## Future Enhancements

1. Resend verification email option
2. SMS verification support
3. Two-factor authentication
4. Password strength meter
5. Login attempt tracking
6. Account lockout after failed attempts
