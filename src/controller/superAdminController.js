import prisma from "../config/db.js";
import { sendEmail } from "../utils/sendEmail.js";

/**
 * Controller for getting pending users
 * @desc Retrieves all users waiting for Super Admin approval
 * @route GET /api/admin/users/pending
 * @access Private - Super Admin
 */
export const getPendingUsers = async (req, res) => {
  try {
    const page = Math.max(parseInt(req.query.page) || 1, 1);
    const limit = Math.min(parseInt(req.query.limit) || 20, 100);

    const pendingUsers = await prisma.user.findMany({
      where: { status: "PENDING" },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        status: true,
        createdAt: true,
      },
      orderBy: {
        createdAt: "desc",
      },
      skip: (page - 1) * limit,
      take: limit,
    });

    res.status(200).json({
      success: true,
      message: "Pending users fetched successfully",
      data: pendingUsers,
      page,
      limit,
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      message: "Failed to fetch pending users",
      error: err.message,
    });
  }
};

/**
 * Controller for approving a user
 * @desc Approves a pending user and changes their status to APPROVED
 * @route PATCH /api/admin/users/:id/approve
 * @access Private - Super Admin
 */
export const approveUser = async (req, res) => {
  try {
    const { id } = req.params;

    const user = await prisma.user.findUnique({
      where: { id },
    });

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    if (user.role === "SUPER_ADMIN") {
      return res.status(403).json({
        success: false,
        message: "Cannot modify Super Admin status",
      });
    }

    if (user.status !== "PENDING") {
      return res.status(400).json({
        success: false,
        message: `User is already in ${user.status.toLowerCase()}`,
      });
    }

    const updatedUser = await prisma.user.update({
      where: { id },
      data: { status: "APPROVED" },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        status: true,
        createdAt: true,
      },
    });

    // Send welcome email
    try {
      sendEmail({
        to: updatedUser.email,
        subject: "Welcome to TalentIQ!",
        htmlContent: `
          <h2>Hi ${updatedUser.name},</h2>

          <p>
            Your TalentIQ account has been approved.
            You can now log in and start using TalentIQ.
          </p>

          <p>
            Welcome to TalentIQ!
          </p>
        `,
      });
    } catch (emailError) {
      console.error(
        `Welcome email failed for ${updatedUser.email}:`,
        emailError.message,
      );
    }
    res.status(200).json({
      success: true,
      message: "User approved successfully",
      data: updatedUser,
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      message: "Failed to approve user",
      error: err.message,
    });
  }
};

/**
 * Controller for rejecting a user
 * @desc Rejects a pending user and changes their status to REJECTED
 * @route PATCH /api/admin/users/:id/reject
 * @access Private - Super Admin
 */
export const rejectUser = async (req, res) => {
  try {
    const { id } = req.params;

    const user = await prisma.user.findUnique({
      where: { id },
    });

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    if (user.role === "SUPER_ADMIN") {
      return res.status(403).json({
        success: false,
        message: "Cannot modify Super Admin status",
      });
    }

    if (user.status !== "PENDING") {
      return res.status(400).json({
        success: false,
        message: `User is already in ${user.status.toLowerCase()}`,
      });
    }

    const updatedUser = await prisma.user.update({
      where: { id },
      data: { status: "REJECTED" },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        status: true,
        createdAt: true,
      },
    });

    res.status(200).json({
      success: true,
      message: "User rejected successfully",
      data: updatedUser,
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      message: "Failed to reject user",
      error: err.message,
    });
  }
};

/**
 * Controller for getting all users
 * @desc Retrieves all users with optional role and status filters
 * @route GET /api/admin/users
 * @access Private - Super Admin
 */
export const getAllUsers = async (req, res) => {
  try {
    const { role, status } = req.query;

    const page = Math.max(parseInt(req.query.page) || 1, 1);
const limit = Math.min(parseInt(req.query.limit) || 20, 100);

    // Prevent fetching Super Admin users
    if (role === "SUPER_ADMIN") {
      return res.status(400).json({
        success: false,
        message: "Super Admin users cannot be fetched",
      });
    }

    const users = await prisma.user.findMany({
      where: {
        role: { not: "SUPER_ADMIN" },
        ...(role && { role }),
        ...(status && { status }),
      },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        status: true,
        createdAt: true,
      },
      orderBy: {
        createdAt: "desc",
      },
        skip: (page - 1) * limit,
  take: limit,
    });

    res.status(200).json({
      success: true,
      message: "Users fetched successfully",
      data: users,
      page,
      limit,
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      message: "Failed to fetch users",
      error: err.message,
    });
  }
};
