const crypto = require("crypto");
const User = require("../model/user");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const { logActivity } = require("../utils/activityLogger");
const {
  generateRandomPassword,
  generateOTPCode,
  getOTPExpiry,
  generatePasswordChangeToken,
  getPasswordChangeTokenExpiry,
} = require("../utils/authUtils");
const {
  sendOTPEmail,
  sendCredentialsEmail,
  sendPasswordChangeVerificationEmail,
  sendOTPWithPasswordEmail,
  sendLoginOTPEmail,
  sendPasswordResetOTPEmail,
} = require("../services/emailService");
const twilioVerify = require("../services/twilioVerifyService");
const { validatePasswordStrength } = require("../utils/passwordPolicy");
const { SENSITIVE_USER_FIELDS } = require("../utils/userSelect");

const generateSessionId = () => crypto.randomBytes(16).toString("hex");

const generateToken = (user, sessionId = null) => {
  if (!process.env.JWT_SECRET) {
    throw new Error("JWT_SECRET is not configured");
  }

  const payload = { id: user._id, role: user.role };
  if (sessionId) payload.sessionId = sessionId;

  return jwt.sign(payload, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || "12h",
  });
};

const AUTH_COOKIE_OPTIONS = {
  httpOnly: true,
  sameSite: "lax",
  secure: process.env.NODE_ENV === "production",
  maxAge: 12 * 60 * 60 * 1000,
  path: "/",
};

const setAuthCookie = (res, token) => {
  res.cookie("token", token, AUTH_COOKIE_OPTIONS);
};

const clearAuthCookie = (res) => {
  res.clearCookie("token", {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
  });
};

const buildUserResponse = (user) => ({
  id: user._id,
  name: user.name,
  email: user.email,
  role: user.role,
  emailVerified: user.emailVerified,
  isPasswordChangeRequired: user.isPasswordChangeRequired,
  theme: user.theme,
  emailAlerts: user.emailAlerts,
  pushNotifications: user.pushNotifications,
});

const registerUser = async (req, res) => {
  try {
    const { name, email, password, phone } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({ message: "Name, email and password are required" });
    }

    const passwordCheck = validatePasswordStrength(password);
    if (!passwordCheck.ok) {
      return res.status(400).json({ message: passwordCheck.message });
    }

    const normalizedPhone = String(phone || "").replace(/\s+/g, "").trim();
    if (!normalizedPhone) {
      return res.status(400).json({ message: "Phone number is required" });
    }
    if (!/^\+?\d{7,15}$/.test(normalizedPhone)) {
      return res.status(400).json({ message: "Please enter a valid phone number" });
    }

    const normalizedEmail = email.trim().toLowerCase();
    const exists = await User.findOne({ email: normalizedEmail });
    if (exists) return res.status(400).json({ message: "Email already exists" });

    const phoneExists = await User.findOne({ phone: normalizedPhone });
    if (phoneExists) {
      return res.status(400).json({
        message: "This phone number is already registered. Please use another number.",
      });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const emailVerificationOTP = generateOTPCode();
    const emailVerificationOTPExpiry = getOTPExpiry();

    const user = await User.create({
      name,
      email: normalizedEmail,
      password: hashedPassword,
      phone: normalizedPhone,
      role: "user",
      emailVerified: false,
      emailVerificationOTP,
      emailVerificationOTPExpiry,
    });

    try {
      await sendOTPEmail(user.email, emailVerificationOTP, user.name);
    } catch (emailError) {
      console.error("Failed to send registration OTP email:", emailError.message);
      await User.findByIdAndDelete(user._id);
      return res.status(502).json({
        message: "Account could not be created because the verification email failed to send. Please try again.",
      });
    }

    res.status(201).json({
      message: "Registration successful. Please verify your email with the OTP code sent to your inbox.",
      requiresVerification: true,
      email: user.email,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const registerAdmin = async (req, res) => {
  try {
    const bootstrapSecret = process.env.ADMIN_BOOTSTRAP_SECRET;
    const providedSecret = req.headers["x-admin-bootstrap-secret"];
    if (!bootstrapSecret || !providedSecret || providedSecret !== bootstrapSecret) {
      return res.status(403).json({ message: "Admin registration is disabled" });
    }

    const { name, email, password } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({ message: "Name, email and password are required" });
    }

    const passwordCheck = validatePasswordStrength(password);
    if (!passwordCheck.ok) {
      return res.status(400).json({ message: passwordCheck.message });
    }

    const normalizedEmail = email.trim().toLowerCase();
    const adminExists = await User.findOne({ role: "admin" });

    if (adminExists) {
      if (!adminExists.password && adminExists.email === normalizedEmail) {
        const sessionId = generateSessionId();
        adminExists.name = name;
        adminExists.password = await bcrypt.hash(password, 10);
        adminExists.activeSessionId = sessionId;
        await adminExists.save();

        const token = generateToken(adminExists, sessionId);
        setAuthCookie(res, token);

        return res.status(200).json({
          message: "Admin password configured successfully",
          user: {
            id: adminExists._id,
            name: adminExists.name,
            email: adminExists.email,
            role: adminExists.role,
            theme: adminExists.theme,
            emailAlerts: adminExists.emailAlerts,
            pushNotifications: adminExists.pushNotifications,
          },
          token,
        });
      }

      return res.status(400).json({ message: "Admin already exists" });
    }

    const exists = await User.findOne({ email: normalizedEmail });
    if (exists) return res.status(400).json({ message: "Email already exists" });

    const hashedPassword = await bcrypt.hash(password, 10);
    const sessionId = generateSessionId();

    const admin = await User.create({
      name,
      email: normalizedEmail,
      password: hashedPassword,
      role: "admin",
      activeSessionId: sessionId,
    });

    const token = generateToken(admin, sessionId);
    setAuthCookie(res, token);

    res.status(201).json({
      message: "Admin created successfully",
      user: {
        id: admin._id,
        name: admin.name,
        email: admin.email,
        role: admin.role,
        theme: admin.theme,
        emailAlerts: admin.emailAlerts,
        pushNotifications: admin.pushNotifications,
      },
      token,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const login = async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ message: "Email and password are required" });
    }

    const normalizedEmail = email.trim().toLowerCase();
    const user = await User.findOne({ email: normalizedEmail });

    const recordFailedLogin = async (reason, actor = null) => {
      await logActivity({
        req,
        user: actor,
        action: "login_failed",
        status: "failed",
        userName: actor?.name || normalizedEmail,
        role: actor?.role || null,
        details: { email: normalizedEmail, reason },
      });

      try {
        const ActivityLog = require("../model/ActivityLog");
        const windowStart = new Date(Date.now() - 15 * 60 * 1000);
        const failCount = await ActivityLog.countDocuments({
          action: "login_failed",
          createdAt: { $gte: windowStart },
          $or: [
            { "details.email": normalizedEmail },
            ...(actor?._id ? [{ user: actor._id }] : []),
          ],
        });
        if (failCount >= 3) {
          await logActivity({
            req,
            user: actor,
            action: "multiple_failed_logins",
            status: "failed",
            userName: actor?.name || normalizedEmail,
            role: actor?.role || null,
            details: {
              email: normalizedEmail,
              attemptCount: failCount,
              windowMinutes: 15,
            },
          });
        }
      } catch (countError) {
        console.error("Failed login count error:", countError.message);
      }
    };

    if (!user) {
      await recordFailedLogin("unknown_email");
      return res.status(401).json({ message: "Invalid email or password" });
    }

    if (!user.password || typeof user.password !== "string") {
      await recordFailedLogin("password_not_configured", user);
      return res.status(401).json({
        message: "Account password is not configured. Please reset or recreate this user.",
      });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      await recordFailedLogin("invalid_password", user);
      return res.status(401).json({ message: "Invalid email or password" });
    }

    const accountStatus = user.account_status || "active";
    if (accountStatus === "blocked") {
      await recordFailedLogin("account_blocked", user);
      return res.status(403).json({
        message:
          "Your account has been blocked due to repeated false or malicious reports. Contact an administrator.",
        account_status: "blocked",
      });
    }
    if (accountStatus === "suspended") {
      await recordFailedLogin("account_suspended", user);
      return res.status(403).json({
        message:
          "Your account is temporarily suspended pending review of false report flags. Contact an administrator.",
        account_status: "suspended",
      });
    }

    if (!user.emailVerified) {
      await recordFailedLogin("email_unverified", user);
      return res.status(403).json({
        message: "Please verify your email before logging in.",
        requiresVerification: true,
        email: user.email,
      });
    }

    if (
      ["investigator", "dataset_manager"].includes(user.role) &&
      !user.passwordChangedAt
    ) {
      user.isPasswordChangeRequired = true;
      await user.save();
    }

    const loginOTP = generateOTPCode();
    const loginOTPExpiry = getOTPExpiry();
    user.loginOTP = loginOTP;
    user.loginOTPExpiry = loginOTPExpiry;
    await user.save();

    try {
      await sendLoginOTPEmail(user.email, loginOTP, user.name);
    } catch (emailError) {
      console.error("Failed to send login OTP email:", emailError.message);
      user.loginOTP = null;
      user.loginOTPExpiry = null;
      await user.save();
      return res.status(502).json({
        message: "Login verification email could not be sent. Please try again.",
      });
    }

    res.json({
      message: "A verification code has been sent to your email.",
      requiresOTP: true,
      email: user.email,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const verifyLoginOTP = async (req, res) => {
  try {
    const { email, otp } = req.body;

    if (!email || !otp) {
      return res.status(400).json({ message: "Email and OTP code are required" });
    }

    const user = await User.findOne({
      email: email.trim().toLowerCase(),
      loginOTP: otp.trim(),
      loginOTPExpiry: { $gt: new Date() },
    });

    if (!user) {
      await logActivity({
        req,
        action: "login_failed",
        status: "failed",
        userName: email.trim().toLowerCase(),
        details: {
          email: email.trim().toLowerCase(),
          reason: "invalid_or_expired_otp",
        },
      });
      return res.status(400).json({ message: "Invalid or expired verification code" });
    }

    user.loginOTP = null;
    user.loginOTPExpiry = null;

    const sessionId = generateSessionId();
    user.activeSessionId = sessionId;
    await user.save();

    const token = generateToken(user, sessionId);
    setAuthCookie(res, token);

    await logActivity({
      req,
      user,
      action: "login",
      sessionId,
      details: { method: "login_otp" },
    });

    res.json({
      message: "Login successful",
      user: buildUserResponse(user),
      token,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const resendLoginOTP = async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({ message: "Email is required" });
    }

    const user = await User.findOne({ email: email.trim().toLowerCase() });
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    const loginOTP = generateOTPCode();
    const loginOTPExpiry = getOTPExpiry();
    user.loginOTP = loginOTP;
    user.loginOTPExpiry = loginOTPExpiry;
    await user.save();

    try {
      await sendLoginOTPEmail(user.email, loginOTP, user.name);
    } catch (emailError) {
      console.error("Failed to resend login OTP email:", emailError.message);
      return res.status(502).json({
        message: "Verification email could not be sent. Please try again.",
      });
    }

    res.json({
      message: "A new login verification code has been sent to your email.",
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const getMe = async (req, res) => {
  try {
    const user = await User.findById(req.user._id).select(SENSITIVE_USER_FIELDS);
    res.json({
      user: {
        ...user.toObject(),
        emailVerified: user.emailVerified,
        isPasswordChangeRequired: user.isPasswordChangeRequired,
      },
      smsVerificationEnabled: twilioVerify.isConfigured(),
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const updateMe = async (req, res) => {
  try {
    const allowedFields = [
      "name",
      "email",
      "phone",
      "badgeNumber",
      "station",
      "theme",
      "emailAlerts",
      "pushNotifications",
    ];

    const updates = {};
    allowedFields.forEach((field) => {
      if (req.body[field] !== undefined) {
        updates[field] = req.body[field];
      }
    });

    if (updates.email && updates.email !== req.user.email) {
      const exists = await User.findOne({ email: updates.email });
      if (exists) return res.status(400).json({ message: "Email already exists" });
    }

    if (updates.phone !== undefined && updates.phone !== req.user.phone) {
      if (updates.phone) {
        const phoneExists = await User.findOne({
          phone: updates.phone,
          _id: { $ne: req.user._id },
        });
        if (phoneExists) {
          return res.status(400).json({ message: "Phone number already in use" });
        }
      }
      updates.phoneVerified = false;
    }

    const updatedUser = await User.findByIdAndUpdate(req.user._id, updates, {
      new: true,
      runValidators: true,
    }).select(SENSITIVE_USER_FIELDS);

    res.json({
      message: "Settings updated successfully",
      user: updatedUser,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const changePassword = async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword) {
      return res.status(400).json({ message: "Current and new password are required" });
    }

    const passwordCheck = validatePasswordStrength(newPassword);
    if (!passwordCheck.ok) {
      return res.status(400).json({ message: passwordCheck.message });
    }

    const user = await User.findById(req.user._id);
    if (!user?.password) {
      return res.status(400).json({ message: "Account password is not configured" });
    }

    const isMatch = await bcrypt.compare(currentPassword, user.password);

    if (!isMatch) {
      return res.status(400).json({ message: "Current password is incorrect" });
    }

    user.password = await bcrypt.hash(newPassword, 10);
    user.isPasswordChangeRequired = false;
    user.passwordChangedAt = new Date();
    user.activeSessionId = null;
    await user.save();
    clearAuthCookie(res);

    await logActivity({
      req,
      user,
      action: "password_reset",
      resourceType: "User",
      resourceId: user._id,
      details: {
        targetName: user.name,
        targetEmail: user.email,
        method: "change_password",
      },
    });

    res.json({
      message: "Password changed successfully",
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        emailVerified: user.emailVerified,
        isPasswordChangeRequired: user.isPasswordChangeRequired,
        theme: user.theme,
        emailAlerts: user.emailAlerts,
        pushNotifications: user.pushNotifications,
      },
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const createInvestigator = async (req, res) => {
  try {
    const { name, email, password, badgeNumber, station, phone } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({ message: "Name, email and password are required" });
    }

    const passwordCheck = validatePasswordStrength(password);
    if (!passwordCheck.ok) {
      return res.status(400).json({ message: passwordCheck.message });
    }

    const normalizedEmail = email.trim().toLowerCase();
    const exists = await User.findOne({ email: normalizedEmail });
    if (exists) return res.status(400).json({ message: "Email already exists" });

    const hashedPassword = await bcrypt.hash(password, 10);

    const investigator = await User.create({
      name,
      email: normalizedEmail,
      password: hashedPassword,
      role: "investigator",
      badgeNumber,
      station,
      phone,
      isPasswordChangeRequired: true,
    });

    res.status(201).json({
      message: "Investigator account created successfully",
      investigator: {
        id: investigator._id,
        name: investigator.name,
        email: investigator.email,
        role: investigator.role,
        badgeNumber: investigator.badgeNumber,
        station: investigator.station,
        phone: investigator.phone,
      },
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Verify email address with OTP code — auto-generates password and sends it via email
const verifyEmail = async (req, res) => {
  try {
    const { token } = req.body;

    if (!token) {
      return res.status(400).json({ message: "Verification token is required" });
    }

    const user = await User.findOne({
      emailVerificationToken: token,
      emailVerificationTokenExpiry: { $gt: new Date() },
    });

    if (!user) {
      return res.status(400).json({
        message: "Invalid or expired verification token",
      });
    }

    const newPassword = generateRandomPassword();
    const hashedPassword = await bcrypt.hash(newPassword, 10);

    try {
      await sendCredentialsEmail(user.email, user.name, newPassword, user.role);
    } catch (emailError) {
      console.error("Failed to send credentials email after verification:", emailError.message);
      return res.status(502).json({
        message: "Email token is valid, but the password email could not be sent. Please try again later.",
      });
    }

    user.emailVerified = true;
    user.emailVerificationToken = null;
    user.emailVerificationTokenExpiry = null;
    user.password = hashedPassword;
    user.isPasswordChangeRequired = true;
    user.passwordChangedAt = null;
    await user.save();

    res.json({
      message: "Email verified successfully. Log in with the temporary password sent to your email, then choose your own password.",
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        emailVerified: user.emailVerified,
        isPasswordChangeRequired: user.isPasswordChangeRequired,
        role: user.role,
      },
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Verify email with OTP code
const verifyOTP = async (req, res) => {
  try {
    const { email, otp } = req.body;

    if (!email || !otp) {
      return res.status(400).json({ message: "Email and OTP code are required" });
    }

    const user = await User.findOne({
      email: email.trim().toLowerCase(),
      emailVerificationOTP: otp.trim(),
      emailVerificationOTPExpiry: { $gt: new Date() },
    });

    if (!user) {
      return res.status(400).json({
        message: "Invalid or expired verification code",
      });
    }

    // Mark email as verified and clear OTP fields
    user.emailVerified = true;
    user.emailVerificationOTP = null;
    user.emailVerificationOTPExpiry = null;

    if (["investigator", "admin", "dataset_manager"].includes(user.role)) {
      user.isPasswordChangeRequired = true;
      user.passwordChangedAt = null;
    }

    await user.save();

    const response = {
      message:
        user.role === "user"
          ? "Email verified successfully. You can now log in."
          : "Email verified successfully. Log in with the temporary password sent to your email, then choose your own password.",
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        emailVerified: user.emailVerified,
        isPasswordChangeRequired: user.isPasswordChangeRequired,
        role: user.role,
      },
    };

    if (user.role === "user") {
      // Registration OTP verification issues an immediate token — treat as a login
      const sessionId = generateSessionId();
      user.activeSessionId = sessionId;
      await user.save();
      const token = generateToken(user, sessionId);
      setAuthCookie(res, token);
      await logActivity({
        req,
        user,
        action: "login",
        sessionId,
        details: { method: "registration_otp" },
      });
      response.token = token;
    }

    res.json(response);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Resend OTP verification code for an unverified account (also regenerates password)
const resendOTP = async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({ message: "Email is required" });
    }

    const user = await User.findOne({ email: email.trim().toLowerCase() });

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    if (user.emailVerified) {
      return res.status(400).json({ message: "Email is already verified" });
    }

    const nextOTP = generateOTPCode();
    const nextOTPExpiry = getOTPExpiry();
    user.emailVerificationOTP = nextOTP;
    user.emailVerificationOTPExpiry = nextOTPExpiry;

    if (user.role === "user") {
      await user.save();

      try {
        await sendOTPEmail(user.email, nextOTP, user.name);
      } catch (emailError) {
        console.error("Failed to resend registration OTP email:", emailError.message);
        return res.status(502).json({
          message: "Verification email could not be sent. Please check email settings and try again.",
          emailSent: false,
        });
      }

      return res.json({
        message: "A new verification code has been sent to your email.",
        emailSent: true,
      });
    }

    // Investigator/admin: regenerate OTP and password together
    const newPassword = generateRandomPassword();
    const hashedPassword = await bcrypt.hash(newPassword, 10);

    user.emailVerificationOTP = nextOTP;
    user.emailVerificationOTPExpiry = nextOTPExpiry;
    user.password = hashedPassword;
    user.isPasswordChangeRequired = true;
    user.passwordChangedAt = null;
    await user.save();

    try {
      await sendOTPWithPasswordEmail(user.email, nextOTP, newPassword, user.name, user.role);
    } catch (emailError) {
      console.error("Failed to resend OTP+password email:", emailError.message);
      return res.status(502).json({
        message: "Verification email could not be sent. Please check email settings and try again.",
        emailSent: false,
      });
    }

    const response = {
      message: "A new verification code and password have been sent to your email.",
      emailSent: true,
    };

    res.json(response);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Forgot password — send OTP to email
const forgotPassword = async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({ message: "Email is required" });
    }

    const user = await User.findOne({ email: email.trim().toLowerCase() });

    if (!user) {
      return res.json({
        message: "If an account exists with this email, a reset code has been sent.",
      });
    }

    const passwordResetOTP = generateOTPCode();
    const passwordResetOTPExpiry = getOTPExpiry();

    user.passwordResetOTP = passwordResetOTP;
    user.passwordResetOTPExpiry = passwordResetOTPExpiry;
    await user.save();

    try {
      await sendPasswordResetOTPEmail(user.email, passwordResetOTP, user.name);
    } catch (emailError) {
      console.error("Failed to send password reset OTP email:", emailError.message);
      user.passwordResetOTP = null;
      user.passwordResetOTPExpiry = null;
      await user.save();
      return res.status(502).json({
        message: "Reset email could not be sent. Please try again.",
      });
    }

    res.json({
      message: "A password reset code has been sent to your email.",
      email: user.email,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Resend forgot-password OTP
const resendForgotPasswordOTP = async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({ message: "Email is required" });
    }

    const user = await User.findOne({ email: email.trim().toLowerCase() });

    if (!user) {
      return res.json({
        message: "If an account exists with this email, a reset code has been sent.",
      });
    }

    const passwordResetOTP = generateOTPCode();
    const passwordResetOTPExpiry = getOTPExpiry();

    user.passwordResetOTP = passwordResetOTP;
    user.passwordResetOTPExpiry = passwordResetOTPExpiry;
    await user.save();

    try {
      await sendPasswordResetOTPEmail(user.email, passwordResetOTP, user.name);
    } catch (emailError) {
      console.error("Failed to resend password reset OTP email:", emailError.message);
      return res.status(502).json({
        message: "Reset email could not be sent. Please try again.",
      });
    }

    res.json({
      message: "A new password reset code has been sent to your email.",
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Reset password with OTP verification
const resetPasswordWithOTP = async (req, res) => {
  try {
    const { email, otp, newPassword } = req.body;

    if (!email || !otp || !newPassword) {
      return res.status(400).json({
        message: "Email, OTP code, and new password are required",
      });
    }

    const passwordCheck = validatePasswordStrength(newPassword);
    if (!passwordCheck.ok) {
      return res.status(400).json({ message: passwordCheck.message });
    }

    const user = await User.findOne({
      email: email.trim().toLowerCase(),
      passwordResetOTP: otp.trim(),
      passwordResetOTPExpiry: { $gt: new Date() },
    });

    if (!user) {
      return res.status(400).json({
        message: "Invalid or expired reset code",
      });
    }

    user.password = await bcrypt.hash(newPassword, 10);
    user.passwordResetOTP = null;
    user.passwordResetOTPExpiry = null;
    user.isPasswordChangeRequired = false;
    user.passwordChangedAt = new Date();
    user.activeSessionId = null;
    await user.save();

    res.json({
      message: "Password reset successfully. You can now log in with your new password.",
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Request password change (sends verification email)
const requestPasswordChange = async (req, res) => {
  try {
    const user = await User.findById(req.user._id);
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    // Generate password change token
    const passwordChangeToken = generatePasswordChangeToken();
    const passwordChangeTokenExpiry = getPasswordChangeTokenExpiry();

    user.passwordChangeToken = passwordChangeToken;
    user.passwordChangeTokenExpiry = passwordChangeTokenExpiry;
    await user.save();

    // Send verification email
    try {
      await sendPasswordChangeVerificationEmail(
        user.email,
        passwordChangeToken,
        user.name
      );
    } catch (emailError) {
      console.error("Failed to send password change email:", emailError.message);
      // Delete the token if email fails
      user.passwordChangeToken = null;
      user.passwordChangeTokenExpiry = null;
      await user.save();
      return res.status(500).json({
        message: "Failed to send verification email. Please try again.",
      });
    }

    res.json({
      message: "Password change verification email sent successfully",
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Change password with verification token
const changePasswordWithVerification = async (req, res) => {
  try {
    const { token, newPassword } = req.body;

    if (!token || !newPassword) {
      return res
        .status(400)
        .json({ message: "Token and new password are required" });
    }

    const passwordCheck = validatePasswordStrength(newPassword);
    if (!passwordCheck.ok) {
      return res.status(400).json({ message: passwordCheck.message });
    }

    const user = await User.findOne({
      passwordChangeToken: token,
      passwordChangeTokenExpiry: { $gt: new Date() },
    });

    if (!user) {
      return res.status(400).json({
        message: "Invalid or expired password change token",
      });
    }

    // Hash and update password
    user.password = await bcrypt.hash(newPassword, 10);
    user.passwordChangeToken = null;
    user.passwordChangeTokenExpiry = null;
    user.isPasswordChangeRequired = false;
    user.passwordChangedAt = new Date();
    user.activeSessionId = null;
    await user.save();

    res.json({
      message: "Password changed successfully",
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        isPasswordChangeRequired: user.isPasswordChangeRequired,
      },
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const sendPhoneVerification = async (req, res) => {
  try {
    if (!twilioVerify.isConfigured()) {
      return res.status(503).json({
        message:
          "SMS verification is not configured. Add TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, and TWILIO_VERIFY_SERVICE_SID to backend/.env, then restart the server.",
        code: "TWILIO_NOT_CONFIGURED",
      });
    }

    const phone = (req.body.phone || req.user.phone || "").trim();
    if (!phone) {
      return res.status(400).json({ message: "Save a phone number on your profile first." });
    }

    const { status, to } = await twilioVerify.sendVerification(phone);

    if (req.body.phone && req.body.phone.trim() !== (req.user.phone || "").trim()) {
      req.user.phone = phone;
      req.user.phoneVerified = false;
      await req.user.save();
    }

    res.json({
      message: "Verification code sent by SMS.",
      status,
      phone: to,
    });
  } catch (error) {
    console.error("Twilio Verify send failed:", error.message);
    res.status(502).json({
      message: twilioVerify.formatPhoneError(error),
    });
  }
};

const verifyPhone = async (req, res) => {
  try {
    if (!twilioVerify.isConfigured()) {
      return res.status(503).json({
        message: "SMS verification is not configured.",
      });
    }

    const { code } = req.body;
    const phone = (req.user.phone || "").trim();

    if (!phone) {
      return res.status(400).json({ message: "No phone number on file." });
    }

    if (!code) {
      return res.status(400).json({ message: "Verification code is required." });
    }

    const approved = await twilioVerify.checkVerification(phone, code);
    if (!approved) {
      return res.status(400).json({ message: "Invalid or expired verification code." });
    }

    req.user.phoneVerified = true;
    await req.user.save();

    res.json({
      message: "Phone number verified successfully.",
      user: {
        id: req.user._id,
        phone: req.user.phone,
        phoneVerified: req.user.phoneVerified,
      },
    });
  } catch (error) {
    console.error("Twilio Verify check failed:", error.message);
    res.status(502).json({
      message: twilioVerify.formatPhoneError(error),
    });
  }
};

// Invalidate the current server-side session and clear auth cookie
const logout = async (req, res) => {
  try {
    if (req.user?._id) {
      await User.findByIdAndUpdate(req.user._id, { activeSessionId: null });
    }

    clearAuthCookie(res);

    await logActivity({
      req,
      user: req.user,
      action: "logout",
      sessionId: req.authSessionId,
    });

    res.json({ message: "Logged out successfully" });
  } catch (error) {
    res.status(500).json({ message: "Logout failed" });
  }
};

// Deprecated first-login endpoint. Users must choose their own password now.
const autoGeneratePasswordOnFirstLogin = async (req, res) => {
  res.status(410).json({
    message: "Automatic password generation is no longer supported. Please set a new password to complete first login.",
  });
};

module.exports = {
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
};
