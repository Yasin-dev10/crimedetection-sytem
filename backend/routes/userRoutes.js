const express = require("express");
const multer = require("multer");
const path = require("path");
const fs = require("fs");
const crypto = require("crypto");

const {
  getUsers,
  createInvestigator,
  updateUser,
  deleteUser,
  deleteUserByEmail,
  updateAccountStatus,
} = require("../controllers/userController");

const {
  protect,
  adminOnly,
} = require("../middleware/authMiddleware");

const router = express.Router();

const ALLOWED_IMAGE_MIME = {
  "image/jpeg": ".jpg",
  "image/png": ".png",
  "image/webp": ".webp",
  "image/gif": ".gif",
};

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    const uploadPath = path.join(__dirname, "..", "uploads", "investigator");
    fs.mkdirSync(uploadPath, { recursive: true });
    cb(null, uploadPath);
  },

  filename: function (req, file, cb) {
    const ext = ALLOWED_IMAGE_MIME[file.mimetype] || "";
    cb(
      null,
      `${Date.now()}-${crypto.randomBytes(8).toString("hex")}${ext}`
    );
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 2 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (ALLOWED_IMAGE_MIME[file.mimetype]) {
      return cb(null, true);
    }
    return cb(new Error("Only jpeg, png, webp, and gif images are allowed"));
  },
});

router.get("/", protect, adminOnly, getUsers);

router.post(
  "/create-investigator",
  protect,
  adminOnly,
  upload.single("profileImage"),
  createInvestigator
);

router.patch("/:id/account-status", protect, adminOnly, updateAccountStatus);

router.patch(
  "/:id",
  protect,
  adminOnly,
  upload.single("profileImage"),
  updateUser
);

router.delete("/by-email/:email", protect, adminOnly, deleteUserByEmail);

router.delete("/:id", protect, adminOnly, deleteUser);

module.exports = router;
