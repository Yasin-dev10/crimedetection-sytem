const crypto = require("crypto");

// Generate random password with mix of uppercase, lowercase, numbers, and special characters
const generateRandomPassword = (length = 12) => {
  const uppercase = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
  const lowercase = "abcdefghijklmnopqrstuvwxyz";
  const numbers = "0123456789";
  const special = "!@#$%^&*";

  const allChars = uppercase + lowercase + numbers + special;

  let password = "";

  // Ensure at least one character from each type
  password += uppercase[crypto.randomInt(uppercase.length)];
  password += lowercase[crypto.randomInt(lowercase.length)];
  password += numbers[crypto.randomInt(numbers.length)];
  password += special[crypto.randomInt(special.length)];

  // Fill the rest with random characters
  for (let i = password.length; i < length; i++) {
    password += allChars[crypto.randomInt(allChars.length)];
  }

  // Shuffle the password
  const chars = password.split("");
  for (let i = chars.length - 1; i > 0; i--) {
    const j = crypto.randomInt(i + 1);
    [chars[i], chars[j]] = [chars[j], chars[i]];
  }

  return chars.join("");
};

// Generate email verification token
const generateEmailVerificationToken = () => {
  return crypto.randomBytes(32).toString("hex");
};

// Generate 6-digit OTP code for email verification
const generateOTPCode = () => {
  return crypto.randomInt(100000, 1000000).toString();
};

// Get OTP expiry time (15 minutes)
const getOTPExpiry = () => {
  return new Date(Date.now() + 15 * 60 * 1000);
};

// Generate password change token
const generatePasswordChangeToken = () => {
  return crypto.randomBytes(32).toString("hex");
};

// Get token expiry time (24 hours for email verification)
const getEmailTokenExpiry = () => {
  return new Date(Date.now() + 24 * 60 * 60 * 1000);
};

// Get token expiry time (1 hour for password change)
const getPasswordChangeTokenExpiry = () => {
  return new Date(Date.now() + 60 * 60 * 1000);
};

module.exports = {
  generateRandomPassword,
  generateEmailVerificationToken,
  generateOTPCode,
  getOTPExpiry,
  generatePasswordChangeToken,
  getEmailTokenExpiry,
  getPasswordChangeTokenExpiry,
};
