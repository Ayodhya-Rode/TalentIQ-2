import express from "express";
import {
  register,
  login,
  refresh,
  logout,
  getMe,
  forgotPassword,
  verifyOtp,
  resetPassword,
} from "../controller/authController.js";
import { verifyToken } from "../middlewares/authMiddleware.js";

const router = express.Router();

router.post("/register", register);
router.post("/login", login);
router.post("/refresh", refresh);
router.post("/logout", logout);
router.get("/me", verifyToken, getMe);
router.post("/forgot-password", forgotPassword);
router.post("/verify-otp", verifyOtp);
router.post("/reset-password", resetPassword);

export default router;
