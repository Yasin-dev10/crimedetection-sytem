const express = require("express");
const multer = require("multer");
const path = require("path");
const fs = require("fs");

const {
  getUsers,
  createInvestigator,
  updateUser,
  deleteUser,
  deleteUserByEmail,
} = require("../controllers/userController");

const {
  protect,
  adminOnly,
} = require("../middleware/authMiddleware");

const router = express.Router();

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    const uploadPath = path.join(__dirname, "..", "uploads", "investigator");
    fs.mkdirSync(uploadPath, { recursive: true });
    cb(null, uploadPath);
  },

  filename: function (req, file, cb) {
    cb(
      null,
      Date.now() + "-" + file.originalname
    );
  },
});

const upload = multer({ storage });

router.get("/", protect, adminOnly, getUsers);

router.post(
  "/create-investigator",
  protect,
  adminOnly,
  upload.single("profileImage"),
  createInvestigator
);

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
