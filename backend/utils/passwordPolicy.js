const COMMON_PASSWORDS = new Set([
  "password",
  "password123",
  "123456",
  "12345678",
  "qwerty",
  "admin",
  "admin123",
  "welcome",
  "letmein",
  "password@2026",
  "admin@12345",
]);

/**
 * Enforce a stronger password policy across register/reset/change flows.
 * @returns {{ ok: true } | { ok: false, message: string }}
 */
const validatePasswordStrength = (password = "") => {
  const value = String(password);

  if (value.length < 12) {
    return {
      ok: false,
      message: "Password must be at least 12 characters long",
    };
  }

  if (!/[a-z]/.test(value) || !/[A-Z]/.test(value)) {
    return {
      ok: false,
      message: "Password must include both uppercase and lowercase letters",
    };
  }

  if (!/\d/.test(value)) {
    return {
      ok: false,
      message: "Password must include at least one number",
    };
  }

  if (!/[^A-Za-z0-9]/.test(value)) {
    return {
      ok: false,
      message: "Password must include at least one special character",
    };
  }

  if (COMMON_PASSWORDS.has(value.toLowerCase())) {
    return {
      ok: false,
      message: "This password is too common. Please choose a stronger one",
    };
  }

  return { ok: true };
};

module.exports = { validatePasswordStrength };
