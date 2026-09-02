import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import prisma from "../config/db.js";
import config from "../config/config.js";

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

    const passwordRegex =
      /^(?=.*[A-Za-z])(?=.*\d)(?=.*[@$!%*#?&])[A-Za-z\d@$!%*#?&]{8,}$/;

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
    });

    res.status(201).json({
      success: true,
      message: "Registration successful. Waiting for Super Admin approval.",
      user
    });
  } catch (err) {
    res.status(500).json({ success: false, message: "Registration failed", error: err.message});
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
