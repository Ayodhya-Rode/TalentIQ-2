import prisma from "../config/db.js";
import { sendEmail } from "../utils/sendEmail.js";
import bcrypt from "bcryptjs";
import config from "../config/config.js";
import { generateTempPassword } from "../utils/generatePassword.js";

export const createSupportUser = async (req, res) => {
  try {
    const { name, email } = req.body;

    if (!name || !name.trim()) {
      return res
        .status(400)
        .json({ success: false, message: "Name is required" });
    }
    if (!email || !email.trim()) {
      return res
        .status(400)
        .json({ success: false, message: "Email is required" });
    }

    const cleanName = name.trim();
    const normalizedEmail = email.trim().toLowerCase();

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(normalizedEmail)) {
      return res
        .status(400)
        .json({ success: false, message: "Invalid email format" });
    }

    const existingUser = await prisma.user.findUnique({
      where: { email: normalizedEmail },
    });
    if (existingUser) {
      return res
        .status(409)
        .json({ success: false, message: "Email already registered" });
    }

    const tempPassword = generateTempPassword();
    const hashedPassword = await bcrypt.hash(tempPassword, 10);

    const supportUser = await prisma.user.create({
      data: {
        name: cleanName,
        email: normalizedEmail,
        password: hashedPassword,
        role: "SUPPORT",
        status: "APPROVED",
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

    const loginLink = `${config.frontend_url}/login`;

    try {
      await sendEmail({
        to: supportUser.email,
        subject: "Your TalentIQ Support account has been created",
        htmlContent: `
          <h2>Hi ${supportUser.name},</h2>
          <p>A Support account has been created for you on TalentIQ.</p>
          <p><strong>Email:</strong> ${supportUser.email}</p>
          <p><strong>Temporary Password:</strong> ${tempPassword}</p>
          <p>Please log in and consider using this account responsibly.</p>
          <p><a href="${loginLink}">Click here to log in</a></p>
        `,
      });
    } catch (emailErr) {
      console.error("Support account email failed:", emailErr.message);
    }

    return res.status(201).json({
      success: true,
      message: "Support account created and credentials emailed",
      data: supportUser,
    });
  } catch (err) {
    console.error("Create support user error:", err);
    return res
      .status(500)
      .json({
        success: false,
        message: "Failed to create support account",
        error: err.message,
      });
  }
};
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

/**
 * Controller for Super Admin dashboard summary
 * @desc Aggregate counts across users and bookings for platform overview
 * @route GET /api/admin/dashboard
 * @access Private - Super Admin
 */
export const getDashboardSummary = async (req, res) => {
  try {
    const [
      pendingCount,
      approvedByRole,
      rejectedByRole,
      completedBookingsCount,
      categoryCount,
      totalQueries,
      solvedQueries,
      pendingQueries,
    ] = await Promise.all([
      prisma.user.count({ where: { status: "PENDING" } }),
      prisma.user.groupBy({
        by: ["role"],
        where: { status: "APPROVED", role: { not: "SUPER_ADMIN" } },
        _count: { role: true },
      }),
      prisma.user.groupBy({
        by: ["role"],
        where: { status: "REJECTED" },
        _count: { role: true },
      }),
      prisma.booking.count({ where: { status: "COMPLETED" } }),
      prisma.category.count(),
      prisma.supportQuery.count(),
      prisma.supportQuery.count({ where: { status: "RESOLVED" } }),
      prisma.supportQuery.count({ where: { status: "OPEN" } }),
    ]);

    const PLATFORM_CUT_RUPEES = 50; // ₹100 collected - ₹50 employee payout

    const formatByRole = (grouped) => {
      const result = { RECRUITER: 0, EMPLOYEE: 0, CANDIDATE: 0, SUPPORT: 0 };
      grouped.forEach((g) => {
        result[g.role] = g._count.role;
      });
      return result;
    };

    return res.status(200).json({
      success: true,
      data: {
        pendingApprovals: pendingCount,
        activeAccounts: formatByRole(approvedByRole),
        rejectedAccounts: formatByRole(rejectedByRole),
        totalCategories: categoryCount,
        totalCompletedInterviews: completedBookingsCount,
        totalPlatformRevenue: completedBookingsCount * PLATFORM_CUT_RUPEES,
         supportQueries: {
          total: totalQueries,
          solved: solvedQueries,
          pending: pendingQueries,
        },
      },
    });
  } catch (err) {
    console.error("Get dashboard summary error:", err);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch dashboard summary",
      error: err.message,
    });
  }
};

/**
 * Controller for listing employees who've hit the monthly cancellation/
 * postponement limit, so Super Admin can review and take action.
 * @desc Fetches employees with 3+ cancellations/postponements in the current month
 * @route GET /api/super-admin/cancellation-warnings
 * @access Private - Super Admin
 */
export const getCancellationWarnings = async (req, res) => {
  try {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const startOfNextMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1);
    const MONTHLY_LIMIT = 3;

    const grouped = await prisma.cancellationLog.groupBy({
      by: ["employeeProfileId"],
      where: { createdAt: { gte: startOfMonth, lt: startOfNextMonth } },
      _count: { employeeProfileId: true },
      having: { employeeProfileId: { _count: { gte: MONTHLY_LIMIT } } },
    });

    const employeeProfiles = await prisma.employeeProfile.findMany({
      where: { id: { in: grouped.map((g) => g.employeeProfileId) } },
      include: {
        user: { select: { id: true, name: true, email: true, status: true } },
      },
    });

    const data = grouped.map((g) => {
      const profile = employeeProfiles.find(
        (p) => p.id === g.employeeProfileId,
      );
      return {
        employeeProfileId: g.employeeProfileId,
        userId: profile?.user.id,
        name: profile?.user.name,
        email: profile?.user.email,
        status: profile?.user.status,
        cancellationsThisMonth: g._count.employeeProfileId,
      };
    });

    return res.status(200).json({ success: true, data });
  } catch (err) {
    console.error("Get cancellation warnings error:", err);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch cancellation warnings",
      error: err.message,
    });
  }
};
