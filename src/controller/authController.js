import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import prisma from "../config/db.js";
import config from "../config/config.js";
import crypto from "crypto";
import { sendEmail } from "../utils/sendEmail.js";

/**
 * Controller for user registration
 * @desc Handles user registration, ensuring that the user cannot self-register as a Super Admin and that all required fields are provided. It hashes the password before storing it in the database.
 * @route POST /api/auth/register
 * @access Public
 */
export const register = async (req, res) => {
  try {
    const { name, email, password, role } = req.body;

    if (!email || !password || !role || !name) {
      return res.status(400).json({
        success: false,
        message: "All fields are required",
      });
    }

    const cleanName = name?.trim();
    const normalizedEmail = email.trim().toLowerCase();

    if (!cleanName) {
      return res.status(400).json({
        success: false,
        message: "Name cannot be empty",
      });
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    if (!emailRegex.test(normalizedEmail)) {
      return res.status(400).json({
        success: false,
        message: "Invalid email format",
      });
    }

    const passwordRegex = /^(?=.*[A-Za-z])(?=.*\d)(?=.*[^A-Za-z\d\s]).{8,64}$/;

    if (!passwordRegex.test(password)) {
      return res.status(400).json({
        success: false,
        message:
          "Password must be at least 8 characters long and contain letters, special characters, and numbers",
      });
    }

    const allowedRoles = ["CANDIDATE", "EMPLOYEE", "RECRUITER"];

    if (!allowedRoles.includes(role)) {
      return res.status(400).json({
        success: false,
        message: "Invalid role specified",
      });
    }

    const existingUser = await prisma.user.findUnique({
      where: { email: normalizedEmail },
    });
    if (existingUser) {
      return res
        .status(409)
        .json({ success: false, message: "Email already registered" });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const user = await prisma.user.create({
      data: {
        name: cleanName,
        email: normalizedEmail,
        password: hashedPassword,
        role,
        status: "PENDING",
      },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        status: true,
        createdAt: true,
      },
    });

    res.status(201).json({
      success: true,
      message: "Registration successful. Waiting for Super Admin approval.",
      user,
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      message: "Registration failed",
      error: err.message,
    });
  }
};

/**
 * Controller for user login
 * @desc Handles user login, verifying credentials and generating a JWT token
 * @route POST /api/auth/login
 * @access Public
 */
export const login = async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res
        .status(400)
        .json({ success: false, message: "Email and password are required" });
    }

    const normalizedEmail = email.trim().toLowerCase();
    const user = await prisma.user.findUnique({
      where: { email: normalizedEmail },
    });
    if (!user) {
      return res
        .status(401)
        .json({ success: false, message: "Invalid credentials" });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res
        .status(401)
        .json({ success: false, message: "Invalid credentials" });
    }

    if (user.status === "PENDING") {
      return res.status(403).json({
        success: false,
        message: "Account pending Super Admin approval",
      });
    }
    if (user.status === "REJECTED") {
      return res
        .status(403)
        .json({ success: false, message: "Account has been rejected" });
    }

    const accessToken = jwt.sign(
      { userId: user.id, role: user.role },
      config.jwt_access_secret,
      { expiresIn: "15m" },
    );

    const refreshToken = jwt.sign(
      { userId: user.id },
      config.jwt_refresh_secret,
      {
        expiresIn: "7d",
      },
    );

    res.cookie("refreshToken", refreshToken, {
      httpOnly: true,
      secure: true,
      sameSite: "strict",
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });

    res.status(200).json({
      success: true,
      message: "Login successful",
      data: {
        accessToken,
        user: {
          userId: user.id,
          name: user.name,
          email: user.email,
          role: user.role,
        },
      },
    });
  } catch (err) {
    res.status(500).json({ success: false, message: "Login failed" });
  }
};

/**
 * Refreshes the access token using the refresh token stored in cookies.
 * @desc Validates the refresh token and issues a new access token if valid.
 * @route POST /api/auth/refresh
 * @access Public
 */
export const refresh = async (req, res) => {
  const token = req.cookies.refreshToken;
  if (!token) {
    return res
      .status(401)
      .json({ success: false, message: "No refresh token" });
  }

  try {
    const decoded = jwt.verify(token, config.jwt_refresh_secret);
    const user = await prisma.user.findUnique({
      where: { id: decoded.userId },
    });

    if (!user || user.status !== "APPROVED") {
      return res
        .status(403)
        .json({ success: false, message: "User not eligible" });
    }

    const accessToken = jwt.sign(
      { userId: user.id, role: user.role },
      config.jwt_access_secret,
      { expiresIn: "15m" },
    );

    res.status(200).json({ success: true, data: { accessToken } });
  } catch (err) {
    return res
      .status(401)
      .json({ success: false, message: "Invalid or expired refresh token" });
  }
};

/**
 * Logs the user out by clearing the refresh token cookie.
 * @desc Clears the refresh token cookie and returns a success message.
 * @route POST /api/auth/logout
 * @access Public
 */
export const logout = (req, res) => {
  res.clearCookie("refreshToken", {
    httpOnly: true,
    secure: true,
    sameSite: "strict",
  });
  res.status(200).json({ success: true, message: "Logged out" });
};

/**
 * Returns the currently authenticated user's identity.
 * @desc Fetches the logged-in user's profile using the verified token payload
 * @route GET /api/auth/me
 * @access Private - Any authenticated, approved user
 */
export const getMe = async (req, res) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user.userId },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        status: true,
      },
    });

    if (!user) {
      return res
        .status(404)
        .json({ success: false, message: "User not found" });
    }

    res.status(200).json({ success: true, data: { user } });
  } catch (err) {
    res.status(500).json({ success: false, message: "Failed to fetch user" });
  }
};

const OTP_EXPIRY_MINUTES = 10;

const generateOtp = () => crypto.randomInt(100000, 999999).toString();

/**
 * Sends a password reset OTP to the user's email.
 * @desc Generates a one-time password (OTP) for password reset, stores it in the database with an expiration time, and sends it to the user's email. Does not reveal whether the email exists for security reasons.
 * @route POST /api/auth/forgot-password
 * @access Public
 */
export const forgotPassword = async (req, res) => {
  try {
    const { email } = req.body;

    if (!email || !email.trim()) {
      return res
        .status(400)
        .json({ success: false, message: "Email is required" });
    }

    const normalizedEmail = email.trim().toLowerCase();
    const user = await prisma.user.findUnique({
      where: { email: normalizedEmail },
    });

    // Don't reveal whether the email exists — always return success.
    if (!user) {
      return res.status(200).json({
        success: true,
        message: "If an account exists with this email, an OTP has been sent.",
      });
    }

    const otp = generateOtp();
    const expiresAt = new Date(Date.now() + OTP_EXPIRY_MINUTES * 60 * 1000);

    await prisma.user.update({
      where: { id: user.id },
      data: { resetOtp: otp, resetOtpExpiresAt: expiresAt },
    });

    try {
      await sendEmail({
        to: user.email,
        subject: "Your TalentIQ password reset OTP",
        htmlContent: `
          <h2>Hi ${user.name},</h2>
          <p>Your OTP to reset your password is:</p>
          <h1>${otp}</h1>
          <p>This code expires in ${OTP_EXPIRY_MINUTES} minutes. If you didn't request this, ignore this email.</p>
        `,
      });
    } catch (emailErr) {
      console.error("Forgot password email failed:", emailErr.message);
    }

    return res.status(200).json({
      success: true,
      message: "If an account exists with this email, an OTP has been sent.",
    });
  } catch (err) {
    console.error("Forgot password error:", err);
    return res.status(500).json({
      success: false,
      message: "Failed to process request",
      error: err.message,
    });
  }
};

/**
 * Verifies the OTP provided by the user for password reset.
 * @desc Checks if the provided OTP matches the one stored in the database and is not expired. Returns success if valid, otherwise returns an error.
 * @route POST /api/auth/verify-otp
 * @access Public
 */
export const verifyOtp = async (req, res) => {
  try {
    const { email, otp } = req.body;

    if (!email || !otp) {
      return res
        .status(400)
        .json({ success: false, message: "Email and OTP are required" });
    }

    const normalizedEmail = email.trim().toLowerCase();
    const user = await prisma.user.findUnique({
      where: { email: normalizedEmail },
    });

    if (!user || !user.resetOtp || !user.resetOtpExpiresAt) {
      return res
        .status(400)
        .json({ success: false, message: "Invalid or expired OTP" });
    }

    if (user.resetOtp !== otp) {
      return res
        .status(400)
        .json({ success: false, message: "Invalid or expired OTP" });
    }

    if (user.resetOtpExpiresAt < new Date()) {
      // Clear expired OTP so it can't be reused/retried indefinitely.
      await prisma.user.update({
        where: { id: user.id },
        data: { resetOtp: null, resetOtpExpiresAt: null },
      });
      return res
        .status(400)
        .json({ success: false, message: "Invalid or expired OTP" });
    }

    return res.status(200).json({ success: true, message: "OTP verified" });
  } catch (err) {
    console.error("Verify OTP error:", err);
    return res.status(500).json({
      success: false,
      message: "Failed to verify OTP",
      error: err.message,
    });
  }
};

/**
 * Resets the user's password after verifying the OTP.
 * @desc Updates the user's password in the database if the OTP is valid and not expired.
 * @route POST /api/auth/reset-password
 * @access Public
 */
export const resetPassword = async (req, res) => {
  try {
    const { email, otp, newPassword } = req.body;

    if (!email || !otp || !newPassword) {
      return res.status(400).json({
        success: false,
        message: "Email, OTP, and new password are required",
      });
    }

    const passwordRegex =
      /^(?=.*[A-Za-z])(?=.*\d)(?=.*[@$!%*#?&])[A-Za-z\d@$!%*#?&]{8,}$/;
    if (!passwordRegex.test(newPassword)) {
      return res.status(400).json({
        success: false,
        message:
          "Password must be at least 8 characters with letters, numbers, and a special character",
      });
    }

    const normalizedEmail = email.trim().toLowerCase();
    const user = await prisma.user.findUnique({
      where: { email: normalizedEmail },
    });

    if (!user || !user.resetOtp || !user.resetOtpExpiresAt) {
      return res
        .status(400)
        .json({ success: false, message: "Invalid or expired OTP" });
    }

    if (user.resetOtp !== otp || user.resetOtpExpiresAt < new Date()) {
      // Clear on failed attempt too — prevents indefinite retry on a stale/expired OTP.
      await prisma.user.update({
        where: { id: user.id },
        data: { resetOtp: null, resetOtpExpiresAt: null },
      });
      return res
        .status(400)
        .json({ success: false, message: "Invalid or expired OTP" });
    }

    const hashedPassword = await bcrypt.hash(newPassword, 10);

    await prisma.user.update({
      where: { id: user.id },
      data: {
        password: hashedPassword,
        resetOtp: null,
        resetOtpExpiresAt: null,
      },
    });

    return res
      .status(200)
      .json({ success: true, message: "Password reset successfully" });
  } catch (err) {
    console.error("Reset password error:", err);
    return res.status(500).json({
      success: false,
      message: "Failed to reset password",
      error: err.message,
    });
  }
};

/**
 * Changes the password of the currently logged-in user.
 * @desc Verifies the current password before setting a new one — used by
 *       Support (and anyone) to replace an admin-issued temporary password.
 * @route PUT /api/auth/change-password
 * @access Private - Any authenticated, approved user
 */
export const changePassword = async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword) {
      return res.status(400).json({
        success: false,
        message: "Current password and new password are required",
      });
    }

    const passwordRegex =
      /^(?=.*[A-Za-z])(?=.*\d)(?=.*[@$!%*#?&])[A-Za-z\d@$!%*#?&]{8,}$/;
    if (!passwordRegex.test(newPassword)) {
      return res.status(400).json({
        success: false,
        message:
          "New password must be at least 8 characters with letters, numbers, and a special character",
      });
    }

    const user = await prisma.user.findUnique({
      where: { id: req.user.userId },
    });

    if (!user) {
      return res
        .status(404)
        .json({ success: false, message: "User not found" });
    }

    const isMatch = await bcrypt.compare(currentPassword, user.password);
    if (!isMatch) {
      return res
        .status(401)
        .json({ success: false, message: "Current password is incorrect" });
    }

    const isSamePassword = await bcrypt.compare(newPassword, user.password);
    if (isSamePassword) {
      return res.status(400).json({
        success: false,
        message: "New password must be different from the current password",
      });
    }

    const hashedPassword = await bcrypt.hash(newPassword, 10);

    await prisma.user.update({
      where: { id: user.id },
      data: { password: hashedPassword },
    });

    return res
      .status(200)
      .json({ success: true, message: "Password changed successfully" });
  } catch (err) {
    console.error("Change password error:", err);
    return res.status(500).json({
      success: false,
      message: "Failed to change password",
      error: err.message,
    });
  }
};
