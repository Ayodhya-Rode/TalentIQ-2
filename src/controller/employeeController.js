import prisma from "../config/db.js";
import { Prisma } from "../generated/prisma/index.js";

// ============================================================
// CREATE EMPLOYEE PROFILE
// ============================================================

export const createEmployeeProfile = async (req, res) => {
  try {
    const {
      education,
      skills,
      location,
      experience,
      company,
      designation,
      categoryIds,
    } = req.body;

    // Validate categoryIds
    if (!Array.isArray(categoryIds) || categoryIds.length === 0) {
      return res.status(400).json({
        success: false,
        message: "At least one categoryId is required",
      });
    }

    if (categoryIds.some((id) => typeof id !== "string" || !id.trim())) {
      return res.status(400).json({
        success: false,
        message: "Invalid categoryIds",
      });
    }

    // Remove duplicate category IDs
    const uniqueCategoryIds = [
      ...new Set(categoryIds.map((id) => id.trim())),
    ];

    // Check if profile already exists
    const existingProfile = await prisma.employeeProfile.findUnique({
      where: {
        userId: req.user.userId,
      },
    });

    if (existingProfile) {
      return res.status(409).json({
        success: false,
        message: "Employee profile already exists",
      });
    }

    // Check whether all categories exist
    const validCategories = await prisma.category.findMany({
      where: {
        id: {
          in: uniqueCategoryIds,
        },
      },
      select: {
        id: true,
      },
    });

    if (validCategories.length !== uniqueCategoryIds.length) {
      return res.status(400).json({
        success: false,
        message: "One or more categoryIds are invalid",
      });
    }

    // Create profile + category relationships
    const profile = await prisma.employeeProfile.create({
      data: {
        userId: req.user.userId,

        education: education?.trim() || null,
        skills: skills?.trim() || null,
        location: location?.trim() || null,
        experience: experience?.trim() || null,
        company: company?.trim() || null,
        designation: designation?.trim() || null,

        categories: {
          create: uniqueCategoryIds.map((categoryId) => ({
            categoryId,
          })),
        },
      },

      include: {
        categories: {
          include: {
            category: true,
          },
        },
      },
    });

    return res.status(201).json({
      success: true,
      message: "Employee profile created successfully",
      data: profile,
    });
  } catch (err) {
    if (
      err instanceof Prisma.PrismaClientKnownRequestError &&
      err.code === "P2002"
    ) {
      return res.status(409).json({
        success: false,
        message: "Employee profile or category assignment already exists",
      });
    }

    console.error("Create employee profile error:", err);

    return res.status(500).json({
      success: false,
      message: "Failed to create employee profile",
      error: err.message,
    });
  }
};

// ============================================================
// GET MY EMPLOYEE PROFILE
// ============================================================

export const getEmployeeProfile = async (req, res) => {
  try {
    const profile = await prisma.employeeProfile.findUnique({
      where: {
        userId: req.user.userId,
      },

      include: {
        categories: {
          include: {
            category: true,
          },
        },

        slots: {
          orderBy: {
            startTime: "asc",
          },
        },

        user: {
          select: {
            name: true,
            email: true,
            status: true,
          },
        },
      },
    });

    if (!profile) {
      return res.status(404).json({
        success: false,
        message: "Employee profile not found",
      });
    }

    return res.status(200).json({
      success: true,
      data: profile,
    });
  } catch (err) {
    console.error("Get employee profile error:", err);

    return res.status(500).json({
      success: false,
      message: "Failed to fetch employee profile",
      error: err.message,
    });
  }
};

// ============================================================
// UPDATE EMPLOYEE PROFILE
// ============================================================

export const updateEmployeeProfile = async (req, res) => {
  try {
    const {
      education,
      skills,
      location,
      experience,
      company,
      designation,
      categoryIds,
    } = req.body;

    const userId = req.user.userId;

    // Find existing profile
    const existingProfile = await prisma.employeeProfile.findUnique({
      where: {
        userId,
      },
    });

    if (!existingProfile) {
      return res.status(404).json({
        success: false,
        message: "Employee profile not found",
      });
    }

    // Build update data dynamically
    const data = {};

    if (education !== undefined) {
      data.education = education?.trim() || null;
    }

    if (skills !== undefined) {
      data.skills = skills?.trim() || null;
    }

    if (location !== undefined) {
      data.location = location?.trim() || null;
    }

    if (experience !== undefined) {
      data.experience = experience?.trim() || null;
    }

    if (company !== undefined) {
      data.company = company?.trim() || null;
    }

    if (designation !== undefined) {
      data.designation = designation?.trim() || null;
    }

    let uniqueCategoryIds = null;

    // Validate categoryIds if provided
    if (categoryIds !== undefined) {
      if (!Array.isArray(categoryIds) || categoryIds.length === 0) {
        return res.status(400).json({
          success: false,
          message: "At least one categoryId is required",
        });
      }

      if (categoryIds.some((id) => typeof id !== "string" || !id.trim())) {
        return res.status(400).json({
          success: false,
          message: "Invalid categoryIds",
        });
      }

      // Remove duplicates
      uniqueCategoryIds = [
        ...new Set(categoryIds.map((id) => id.trim())),
      ];

      // Validate category IDs
      const validCategories = await prisma.category.findMany({
        where: {
          id: {
            in: uniqueCategoryIds,
          },
        },
        select: {
          id: true,
        },
      });

      if (validCategories.length !== uniqueCategoryIds.length) {
        return res.status(400).json({
          success: false,
          message: "One or more categoryIds are invalid",
        });
      }
    }

    // Update profile + categories atomically
    const updatedProfile = await prisma.$transaction(async (tx) => {
      // Replace categories only if categoryIds were provided
      if (uniqueCategoryIds !== null) {
        await tx.employeeCategory.deleteMany({
          where: {
            employeeProfileId: existingProfile.id,
          },
        });

        await tx.employeeCategory.createMany({
          data: uniqueCategoryIds.map((categoryId) => ({
            employeeProfileId: existingProfile.id,
            categoryId,
          })),
        });
      }

      return tx.employeeProfile.update({
        where: {
          id: existingProfile.id,
        },

        data,

        include: {
          categories: {
            include: {
              category: true,
            },
          },
        },
      });
    });

    return res.status(200).json({
      success: true,
      message: "Employee profile updated successfully",
      data: updatedProfile,
    });
  } catch (err) {
    if (
      err instanceof Prisma.PrismaClientKnownRequestError &&
      err.code === "P2002"
    ) {
      return res.status(409).json({
        success: false,
        message: "Duplicate employee profile or category assignment",
      });
    }

    console.error("Update employee profile error:", err);

    return res.status(500).json({
      success: false,
      message: "Failed to update employee profile",
      error: err.message,
    });
  }
};

// ============================================================
// CREATE SLOT
// ============================================================

export const createSlot = async (req, res) => {
  try {
    const { date, startTime, endTime } = req.body;

    // Required fields
    if (!date || !startTime || !endTime) {
      return res.status(400).json({
        success: false,
        message: "date, startTime and endTime are required",
      });
    }

    // Parse date/time
    const parsedDate = new Date(date);
    const parsedStart = new Date(startTime);
    const parsedEnd = new Date(endTime);

    // Validate date/time
    if (
      isNaN(parsedDate.getTime()) ||
      isNaN(parsedStart.getTime()) ||
      isNaN(parsedEnd.getTime())
    ) {
      return res.status(400).json({
        success: false,
        message: "Invalid date/time format",
      });
    }

    // Date must match startTime date
    const dateOnly = parsedDate.toISOString().split("T")[0];
    const startDateOnly = parsedStart.toISOString().split("T")[0];

    if (dateOnly !== startDateOnly) {
      return res.status(400).json({
        success: false,
        message: "date must match the date of startTime",
      });
    }

    // End time must be after start time
    if (parsedEnd <= parsedStart) {
      return res.status(400).json({
        success: false,
        message: "endTime must be after startTime",
      });
    }

    // Slot cannot start in the past
    if (parsedStart < new Date()) {
      return res.status(400).json({
        success: false,
        message: "Cannot create a slot in the past",
      });
    }

    // Find employee profile
    const profile = await prisma.employeeProfile.findUnique({
      where: {
        userId: req.user.userId,
      },
    });

    if (!profile) {
      return res.status(404).json({
        success: false,
        message: "Complete your employee profile before adding slots",
      });
    }

    // Check overlapping slot
    const overlapping = await prisma.slot.findFirst({
      where: {
        employeeProfileId: profile.id,

        AND: [
          {
            startTime: {
              lt: parsedEnd,
            },
          },
          {
            endTime: {
              gt: parsedStart,
            },
          },
        ],
      },
    });

    if (overlapping) {
      return res.status(409).json({
        success: false,
        message: "This slot overlaps with an existing slot",
      });
    }

    // Create slot
    const slot = await prisma.slot.create({
      data: {
        employeeProfileId: profile.id,
        date: parsedDate,
        startTime: parsedStart,
        endTime: parsedEnd,
      },
    });

    return res.status(201).json({
      success: true,
      message: "Slot created successfully",
      data: slot,
    });
  } catch (err) {
    if (
      err instanceof Prisma.PrismaClientKnownRequestError &&
      err.code === "P2002"
    ) {
      return res.status(409).json({
        success: false,
        message: "A slot already exists starting at this time",
      });
    }

    console.error("Create slot error:", err);

    return res.status(500).json({
      success: false,
      message: "Failed to create slot",
      error: err.message,
    });
  }
};

// ============================================================
// GET MY SLOTS
// ============================================================

export const getMySlots = async (req, res) => {
  try {
    const { status } = req.query;

    // Validate status
    if (status && !["OPEN", "BOOKED"].includes(status)) {
      return res.status(400).json({
        success: false,
        message: "Invalid slot status. Use OPEN or BOOKED",
      });
    }

    // Find employee profile
    const profile = await prisma.employeeProfile.findUnique({
      where: {
        userId: req.user.userId,
      },
    });

    if (!profile) {
      return res.status(404).json({
        success: false,
        message: "Employee profile not found",
      });
    }

    // Fetch slots
    const slots = await prisma.slot.findMany({
      where: {
        employeeProfileId: profile.id,
        ...(status ? { status } : {}),
      },

      orderBy: [
        {
          date: "asc",
        },
        {
          startTime: "asc",
        },
      ],
    });

    return res.status(200).json({
      success: true,
      data: slots,
    });
  } catch (err) {
    console.error("Get slots error:", err);

    return res.status(500).json({
      success: false,
      message: "Failed to fetch slots",
      error: err.message,
    });
  }
};

// ============================================================
// UPDATE SLOT
// ============================================================

export const updateSlot = async (req, res) => {
  try {
    const { id } = req.params;
    const { date, startTime, endTime } = req.body;

    // Find employee profile
    const profile = await prisma.employeeProfile.findUnique({
      where: {
        userId: req.user.userId,
      },
    });

    if (!profile) {
      return res.status(404).json({
        success: false,
        message: "Employee profile not found",
      });
    }

    // Find slot
    const slot = await prisma.slot.findUnique({
      where: {
        id,
      },
    });

    // Check ownership
    if (!slot || slot.employeeProfileId !== profile.id) {
      return res.status(404).json({
        success: false,
        message: "Slot not found",
      });
    }

    // Booked slot cannot be edited
    if (slot.status === "BOOKED") {
      return res.status(400).json({
        success: false,
        message: "Cannot edit a booked slot. Cancel it instead",
      });
    }

    // Use existing values if fields are not provided
    const parsedDate = date ? new Date(date) : slot.date;

    const parsedStart = startTime
      ? new Date(startTime)
      : slot.startTime;

    const parsedEnd = endTime
      ? new Date(endTime)
      : slot.endTime;

    // Validate date/time
    if (
      isNaN(parsedDate.getTime()) ||
      isNaN(parsedStart.getTime()) ||
      isNaN(parsedEnd.getTime())
    ) {
      return res.status(400).json({
        success: false,
        message: "Invalid date/time format",
      });
    }

    // Date must match startTime date
    const dateOnly = parsedDate.toISOString().split("T")[0];
    const startDateOnly = parsedStart.toISOString().split("T")[0];

    if (dateOnly !== startDateOnly) {
      return res.status(400).json({
        success: false,
        message: "date must match the date of startTime",
      });
    }

    // End time must be after start time
    if (parsedEnd <= parsedStart) {
      return res.status(400).json({
        success: false,
        message: "endTime must be after startTime",
      });
    }

    // Updated slot cannot start in the past
    if (parsedStart < new Date()) {
      return res.status(400).json({
        success: false,
        message: "Cannot update slot to a time in the past",
      });
    }

    // Check overlap with other slots
    const overlapping = await prisma.slot.findFirst({
      where: {
        employeeProfileId: profile.id,

        // Exclude current slot
        id: {
          not: id,
        },

        AND: [
          {
            startTime: {
              lt: parsedEnd,
            },
          },
          {
            endTime: {
              gt: parsedStart,
            },
          },
        ],
      },
    });

    if (overlapping) {
      return res.status(409).json({
        success: false,
        message: "Updated slot overlaps with an existing slot",
      });
    }

    // Update slot
    const updated = await prisma.slot.update({
      where: {
        id,
      },

      data: {
        date: parsedDate,
        startTime: parsedStart,
        endTime: parsedEnd,
      },
    });

    return res.status(200).json({
      success: true,
      message: "Slot updated successfully",
      data: updated,
    });
  } catch (err) {
    if (
      err instanceof Prisma.PrismaClientKnownRequestError &&
      err.code === "P2002"
    ) {
      return res.status(409).json({
        success: false,
        message: "A slot already exists starting at this time",
      });
    }

    console.error("Update slot error:", err);

    return res.status(500).json({
      success: false,
      message: "Failed to update slot",
      error: err.message,
    });
  }
};

// ============================================================
// DELETE SLOT
// ============================================================

export const deleteSlot = async (req, res) => {
  try {
    const { id } = req.params;

    // Find employee profile
    const profile = await prisma.employeeProfile.findUnique({
      where: {
        userId: req.user.userId,
      },
    });

    if (!profile) {
      return res.status(404).json({
        success: false,
        message: "Employee profile not found",
      });
    }

    // Find slot
    const slot = await prisma.slot.findUnique({
      where: {
        id,
      },
    });

    // Check ownership
    if (!slot || slot.employeeProfileId !== profile.id) {
      return res.status(404).json({
        success: false,
        message: "Slot not found",
      });
    }

    // Booked slot cannot be deleted
    if (slot.status === "BOOKED") {
      return res.status(400).json({
        success: false,
        message:
          "Cannot delete a booked slot. Use the cancellation flow instead",
      });
    }

    // Delete slot
    await prisma.slot.delete({
      where: {
        id,
      },
    });

    return res.status(200).json({
      success: true,
      message: "Slot deleted successfully",
    });
  } catch (err) {
    console.error("Delete slot error:", err);

    return res.status(500).json({
      success: false,
      message: "Failed to delete slot",
      error: err.message,
    });
  }
};