const bcrypt = require("bcryptjs");
const mongoose = require("mongoose");
const User = require("../model/user");
const {
  generateRandomPassword,
  generateOTPCode,
  getOTPExpiry,
} = require("../utils/authUtils");
const {
  sendOTPWithPasswordEmail,
} = require("../services/emailService");

const getUsers = async (req, res) => {
  try {
    const users = await User.find().select("-password").sort({ createdAt: -1 }).lean();
    const normalizedUsers = users.map((user) => ({
      ...user,
      id: user._id?.toString(),
    }));
    res.json(normalizedUsers);
  } catch (error) {
    res.status(500).json({ message: "Failed to fetch users", error: error.message });
  }
};

const VALID_SPECIALIZATIONS = [
  "murder",
  "robbery",
  "terrorism",
  "sexual_assault",
  "financial_fraud",
  "drug_crimes",
  "cybercrime",
  "general",
];

const parseSpecializations = (raw) => {
  if (!raw) return [];
  try {
    const parsed = typeof raw === "string" ? JSON.parse(raw) : raw;
    if (Array.isArray(parsed)) {
      return parsed.filter((s) => VALID_SPECIALIZATIONS.includes(s));
    }
  } catch {
    // fallback: comma-separated string
    if (typeof raw === "string") {
      return raw.split(",").map((s) => s.trim()).filter((s) => VALID_SPECIALIZATIONS.includes(s));
    }
  }
  return [];
};

const createInvestigator = async (req, res) => {
  try {
    const { name, email, badgeNumber, station, phone, specializations: rawSpec } = req.body;
    const specializations = parseSpecializations(rawSpec);

    if (!name || !email) {
      return res.status(400).json({ message: "Name and email are required" });
    }

    if (phone) {
      const phoneExists = await User.findOne({
        phone,
        email: { $ne: email.trim().toLowerCase() },
      });
      if (phoneExists) {
        return res.status(400).json({
          message: "This phone number is already registered to another user.",
        });
      }
    }

    const normalizedEmail = email.trim().toLowerCase();
    const exists = await User.findOne({ email: normalizedEmail });
    if (exists) {
      if (!exists.emailVerified) {
        // Regenerate OTP and a new password for the pending account
        const emailVerificationOTP = generateOTPCode();
        const emailVerificationOTPExpiry = getOTPExpiry();
        const newPassword = generateRandomPassword();
        const hashedPassword = await bcrypt.hash(newPassword, 10);

        exists.name = name;
        exists.badgeNumber = badgeNumber;
        exists.station = station;
        exists.phone = phone;
        if (specializations.length) exists.specializations = specializations;
        if (req.file) {
          exists.profileImage = `/uploads/investigator/${req.file.filename}`;
        }
        exists.password = hashedPassword;
        exists.emailVerificationOTP = emailVerificationOTP;
        exists.emailVerificationOTPExpiry = emailVerificationOTPExpiry;
        exists.isPasswordChangeRequired = true;
        exists.passwordChangedAt = null;
        await exists.save();

        try {
          await sendOTPWithPasswordEmail(
            normalizedEmail,
            emailVerificationOTP,
            newPassword,
            exists.name,
            exists.role
          );
        } catch (emailError) {
          console.error("Failed to resend OTP+password email:", emailError.message);
          return res.json({
            message: "This email is already pending verification. Email could not be sent. Please check email settings and resend the OTP.",
            emailSent: false,
            user: {
              _id: exists._id,
              name: exists.name,
              email: exists.email,
              role: exists.role,
              badgeNumber: exists.badgeNumber,
              station: exists.station,
              phone: exists.phone,
              profileImage: exists.profileImage,
              emailVerified: exists.emailVerified,
              isPasswordChangeRequired: exists.isPasswordChangeRequired,
              createdAt: exists.createdAt,
            },
          });
        }

        const response = {
          message: "This email was already pending verification. A new verification code and password have been sent.",
          emailSent: true,
          user: {
            _id: exists._id,
            name: exists.name,
            email: exists.email,
            role: exists.role,
            badgeNumber: exists.badgeNumber,
            station: exists.station,
            phone: exists.phone,
            profileImage: exists.profileImage,
            specializations: exists.specializations,
            emailVerified: exists.emailVerified,
            isPasswordChangeRequired: exists.isPasswordChangeRequired,
            createdAt: exists.createdAt,
          },
        };

        return res.json(response);
      }

      return res.status(400).json({ message: "Email already exists" });
    }

    // Generate password and OTP upfront — both sent in a single email
    const plainPassword = generateRandomPassword();
    const hashedPassword = await bcrypt.hash(plainPassword, 10);

    const emailVerificationOTP = generateOTPCode();
    const emailVerificationOTPExpiry = getOTPExpiry();

    const profileImage = req.file ? `/uploads/investigator/${req.file.filename}` : null;

    const investigator = await User.create({
      name,
      email: normalizedEmail,
      password: hashedPassword,
      role: "investigator",
      badgeNumber,
      station,
      phone,
      profileImage,
      specializations,
      emailVerified: false,
      emailVerificationOTP,
      emailVerificationOTPExpiry,
      isPasswordChangeRequired: true,
      passwordChangedAt: null,
    });

    // Send one email with OTP + password
    try {
      await sendOTPWithPasswordEmail(
        normalizedEmail,
        emailVerificationOTP,
        plainPassword,
        name,
        "investigator"
      );
    } catch (emailError) {
      console.error("Failed to send OTP+password email:", emailError.message);
      return res.status(201).json({
        message: "Investigator created, but the email could not be sent. Please check email settings and resend the OTP.",
        emailSent: false,
        user: {
          _id: investigator._id,
          name: investigator.name,
          email: investigator.email,
          role: investigator.role,
          badgeNumber: investigator.badgeNumber,
          station: investigator.station,
          phone: investigator.phone,
          profileImage: investigator.profileImage,
          specializations: investigator.specializations,
          emailVerified: investigator.emailVerified,
          isPasswordChangeRequired: investigator.isPasswordChangeRequired,
          createdAt: investigator.createdAt,
        },
      });
    }

    const response = {
      message: "Investigator created successfully. Verification code and password have been sent to their email.",
      emailSent: true,
      user: {
        _id: investigator._id,
        name: investigator.name,
        email: investigator.email,
        role: investigator.role,
        badgeNumber: investigator.badgeNumber,
        station: investigator.station,
        phone: investigator.phone,
        profileImage: investigator.profileImage,
        specializations: investigator.specializations,
        emailVerified: investigator.emailVerified,
        isPasswordChangeRequired: investigator.isPasswordChangeRequired,
        createdAt: investigator.createdAt,
      },
    };

    res.status(201).json(response);
  } catch (error) {
    res.status(500).json({ message: "Failed to create investigator", error: error.message });
  }
};

const updateUser = async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ message: "Invalid user ID" });
    }

    const { name, email, password, badgeNumber, station, phone, specializations: rawSpec } = req.body;

    const user = await User.findById(req.params.id);
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    // Check email uniqueness if changed
    if (email && email !== user.email) {
      const exists = await User.findOne({ email, _id: { $ne: req.params.id } });
      if (exists) {
        return res.status(400).json({ message: "Email already in use" });
      }
    }

    // Check phone uniqueness if changed
    if (phone && phone !== user.phone) {
      const phoneExists = await User.findOne({ phone, _id: { $ne: req.params.id } });
      if (phoneExists) {
        return res.status(400).json({ message: "Phone number already in use" });
      }
    }

    if (name) user.name = name;
    if (email) user.email = email;
    if (badgeNumber !== undefined) user.badgeNumber = badgeNumber;
    if (station !== undefined) user.station = station;
    if (phone !== undefined) user.phone = phone;
    if (rawSpec !== undefined) user.specializations = parseSpecializations(rawSpec);

    if (req.file) {
      user.profileImage = `/uploads/investigator/${req.file.filename}`;
    }

    if (password && password.trim()) {
      user.password = await bcrypt.hash(password, 10);
      user.isPasswordChangeRequired = true;
      user.passwordChangedAt = null;
    }

    await user.save();

    res.json({
      message: "User updated successfully",
      user: {
        _id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        badgeNumber: user.badgeNumber,
        station: user.station,
        phone: user.phone,
        profileImage: user.profileImage,
        specializations: user.specializations,
        isPasswordChangeRequired: user.isPasswordChangeRequired,
        createdAt: user.createdAt,
      },
    });
  } catch (error) {
    res.status(500).json({ message: "Failed to update user", error: error.message });
  }
};

const deleteUser = async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ message: "Invalid user ID" });
    }

    const deletedUser = await User.findByIdAndDelete(req.params.id);
    if (!deletedUser) {
      return res.status(404).json({ message: "User not found" });
    }
    res.json({ message: "User deleted successfully" });
  } catch (error) {
    res.status(500).json({ message: "Failed to delete user", error: error.message });
  }
};

const deleteUserByEmail = async (req, res) => {
  try {
    const email = decodeURIComponent(req.params.email || "").trim().toLowerCase();
    if (!email) {
      return res.status(400).json({ message: "User email is required" });
    }

    const deletedUser = await User.findOneAndDelete({ email });
    if (!deletedUser) {
      return res.status(404).json({ message: "User not found" });
    }

    res.json({ message: "User deleted successfully" });
  } catch (error) {
    res.status(500).json({ message: "Failed to delete user", error: error.message });
  }
};

module.exports = { getUsers, createInvestigator, updateUser, deleteUser, deleteUserByEmail };
