const express = require("express");
const router = express.Router();

const {
  registerUser,
  registerAdmin,
  login,
  verifyLoginOTP,
  resendLoginOTP,
  logout,
  getMe,
  updateMe,
  changePassword,
  createInvestigator,
  verifyEmail,
  verifyOTP,
  resendOTP,
  forgotPassword,
  resendForgotPasswordOTP,
  resetPasswordWithOTP,
  requestPasswordChange,
  changePasswordWithVerification,
  sendPhoneVerification,
  verifyPhone,
  autoGeneratePasswordOnFirstLogin,
} = require("../controllers/authController");

const { protect, adminOnly } = require("../middleware/authMiddleware");
const { otpRateLimiter } = require("../middleware/rateLimitMiddleware");

router.post("/register", registerUser);
router.post("/register-admin", otpRateLimiter, registerAdmin);
router.post("/login", login);
router.post("/verify-login-otp", otpRateLimiter, verifyLoginOTP);
router.post("/resend-login-otp", otpRateLimiter, resendLoginOTP);
router.post("/logout", protect, logout);
router.get("/me", protect, getMe);
router.patch("/me", protect, updateMe);
router.patch("/change-password", protect, changePassword);
router.post("/create-investigator", protect, adminOnly, createInvestigator);
router.post("/verify-email", otpRateLimiter, verifyEmail);
router.post("/verify-otp", otpRateLimiter, verifyOTP);
router.post("/resend-otp", otpRateLimiter, resendOTP);
router.post("/forgot-password", otpRateLimiter, forgotPassword);
router.post("/resend-forgot-password-otp", otpRateLimiter, resendForgotPasswordOTP);
router.post("/reset-password-otp", otpRateLimiter, resetPasswordWithOTP);
router.post("/request-password-change", protect, requestPasswordChange);
router.post("/change-password-verified", otpRateLimiter, changePasswordWithVerification);
router.post("/send-phone-verification", protect, sendPhoneVerification);
router.post("/verify-phone", protect, verifyPhone);
router.post("/auto-generate-password", protect, autoGeneratePasswordOnFirstLogin);

module.exports = router;
