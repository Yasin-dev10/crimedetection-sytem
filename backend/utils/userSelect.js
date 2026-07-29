/** Fields that must never be returned by user APIs */
const SENSITIVE_USER_FIELDS =
  "-password -emailVerificationToken -emailVerificationOTP -emailVerificationOTPExpiry -loginOTP -loginOTPExpiry -passwordResetOTP -passwordResetOTPExpiry -passwordChangeToken -passwordChangeTokenExpiry -activeSessionId";

/** Auth middleware needs activeSessionId for session binding — keep OTP/password out */
const AUTH_USER_FIELDS =
  "-password -emailVerificationToken -emailVerificationOTP -emailVerificationOTPExpiry -loginOTP -loginOTPExpiry -passwordResetOTP -passwordResetOTPExpiry -passwordChangeToken -passwordChangeTokenExpiry";

module.exports = { SENSITIVE_USER_FIELDS, AUTH_USER_FIELDS };
