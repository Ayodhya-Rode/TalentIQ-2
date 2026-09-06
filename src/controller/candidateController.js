import prisma from "../config/db.js";
import { Prisma } from "../generated/prisma/index.js";

// HELPERS

// works for both date and datetime strings, returns null for invalid or empty values
const parseOptionalDate = (value) => {
  if (value === undefined || value === null || value === "") {
    return null;
  }

  const parsed = new Date(value);

  if (Number.isNaN(parsed.getTime())) {
    return null;
  }

  return parsed;
};

const isValidUrl = (value) => {
  if (!value) return true;

  try {
    new URL(value);
    return true;
  } catch {
    return false;
  }
};

/**
 * Creates a candidate profile for the authenticated user.
 * @desc Creates a candidate profile with optional projects and certificates.
 * @route POST /api/candidate/profile
 * @access Private - Candidate
 */
export const createCandidateProfile = async (req, res) => {
  try {
    const {
      education,
      skills,
      location,
      designation,
      projects,
      certificates,
    } = req.body;

    const userId = req.user.userId;

    // Check if profile already exists
    const existingProfile = await prisma.candidateProfile.findUnique({
      where: { userId },
    });

    if (existingProfile) {
      return res.status(409).json({
        success: false,
        message: "Candidate profile already exists",
      });
    }

    // Validate projects
    if (projects !== undefined && !Array.isArray(projects)) {
      return res.status(400).json({
        success: false,
        message: "projects must be an array",
      });
    }

    if (
      Array.isArray(projects) &&
      projects.some(
        (project) =>
          !project.title ||
          typeof project.title !== "string" ||
          !project.title.trim()
      )
    ) {
      return res.status(400).json({
        success: false,
        message: "Each project requires a valid title",
      });
    }

    // Validate certificates
    if (certificates !== undefined && !Array.isArray(certificates)) {
      return res.status(400).json({
        success: false,
        message: "certificates must be an array",
      });
    }

    if (
      Array.isArray(certificates) &&
      certificates.some(
        (certificate) =>
          !certificate.title ||
          typeof certificate.title !== "string" ||
          !certificate.title.trim()
      )
    ) {
      return res.status(400).json({
        success: false,
        message: "Each certificate requires a valid title",
      });
    }

    // Validate project dates
    if (Array.isArray(projects)) {
      for (const project of projects) {
        if (project.date) {
          const parsedDate = parseOptionalDate(project.date);

          if (!parsedDate) {
            return res.status(400).json({
              success: false,
              message: `Invalid date for project "${project.title}"`,
            });
          }
        }

        if (project.link && !isValidUrl(project.link)) {
          return res.status(400).json({
            success: false,
            message: `Invalid link for project "${project.title}"`,
          });
        }
      }
    }

    // Validate certificate dates
    if (Array.isArray(certificates)) {
      for (const certificate of certificates) {
        if (certificate.date) {
          const parsedDate = parseOptionalDate(certificate.date);

          if (!parsedDate) {
            return res.status(400).json({
              success: false,
              message: `Invalid date for certificate "${certificate.title}"`,
            });
          }
        }

        if (certificate.link && !isValidUrl(certificate.link)) {
          return res.status(400).json({
            success: false,
            message: `Invalid link for certificate "${certificate.title}"`,
          });
        }
      }
    }

    const profile = await prisma.candidateProfile.create({
      data: {
        userId,

        education:
          typeof education === "string" && education.trim()
            ? education.trim()
            : null,

        skills:
          typeof skills === "string" && skills.trim()
            ? skills.trim()
            : null,

        location:
          typeof location === "string" && location.trim()
            ? location.trim()
            : null,

        designation:
          typeof designation === "string" && designation.trim()
            ? designation.trim()
            : null,

        projects: {
          create: (projects || []).map((project) => ({
            title: project.title.trim(),
            description:
              typeof project.description === "string" &&
              project.description.trim()
                ? project.description.trim()
                : null,
            link:
              typeof project.link === "string" && project.link.trim()
                ? project.link.trim()
                : null,
            date: project.date
              ? parseOptionalDate(project.date)
              : null,
          })),
        },

        certificates: {
          create: (certificates || []).map((certificate) => ({
            title: certificate.title.trim(),
            description:
              typeof certificate.description === "string" &&
              certificate.description.trim()
                ? certificate.description.trim()
                : null,
            link:
              typeof certificate.link === "string" &&
              certificate.link.trim()
                ? certificate.link.trim()
                : null,
            date: certificate.date
              ? parseOptionalDate(certificate.date)
              : null,
          })),
        },
      },

      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            status: true,
            role: true,
          },
        },
        projects: {
          orderBy: {
            createdAt: "desc",
          },
        },
        certificates: {
          orderBy: {
            createdAt: "desc",
          },
        },
      },
    });

    return res.status(201).json({
      success: true,
      message: "Candidate profile created successfully",
      data: profile,
    });
  } catch (err) {
    if (
      err instanceof Prisma.PrismaClientKnownRequestError &&
      err.code === "P2002"
    ) {
      return res.status(409).json({
        success: false,
        message: "Candidate profile already exists",
      });
    }

    console.error("Create candidate profile error:", err);

    return res.status(500).json({
      success: false,
      message: "Failed to create candidate profile",
    });
  }
};


/**
 * Gets the candidate profile for the authenticated user.
 * @desc Fetches the candidate profile along with associated projects and certificates.
 * @route GET /api/candidate/profile
 * @access Private - Candidate
 */
export const getCandidateProfile = async (req, res) => {
  try {
    const userId = req.user.userId;

    const profile = await prisma.candidateProfile.findUnique({
      where: { userId },

      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            role: true,
            status: true,
          },
        },

        projects: {
          orderBy: {
            createdAt: "desc",
          },
        },

        certificates: {
          orderBy: {
            createdAt: "desc",
          },
        },
      },
    });

    if (!profile) {
      return res.status(404).json({
        success: false,
        message: "Candidate profile not found",
      });
    }

    return res.status(200).json({
      success: true,
      message: "Candidate profile fetched successfully",
      data: profile,
    });
  } catch (err) {
    console.error("Get candidate profile error:", err);

    return res.status(500).json({
      success: false,
      message: "Failed to fetch candidate profile",
    });
  }
};

/**
 * Updates the candidate profile for the authenticated user.
 * @desc Updates the candidate profile with optional projects and certificates.
 * @route PUT /api/candidate/profile
 * @access Private - Candidate
 */
export const updateCandidateProfile = async (req, res) => {
  try {
    const userId = req.user.userId;

    const {
      education,
      skills,
      location,
      designation,
    } = req.body;

    const existingProfile = await prisma.candidateProfile.findUnique({
      where: { userId },
    });

    if (!existingProfile) {
      return res.status(404).json({
        success: false,
        message: "Candidate profile not found",
      });
    }

    const data = {};

    if (education !== undefined) {
      data.education =
        typeof education === "string" && education.trim()
          ? education.trim()
          : null;
    }

    if (skills !== undefined) {
      data.skills =
        typeof skills === "string" && skills.trim()
          ? skills.trim()
          : null;
    }

    if (location !== undefined) {
      data.location =
        typeof location === "string" && location.trim()
          ? location.trim()
          : null;
    }

    if (designation !== undefined) {
      data.designation =
        typeof designation === "string" && designation.trim()
          ? designation.trim()
          : null;
    }

    const updatedProfile = await prisma.candidateProfile.update({
      where: { userId },

      data,

      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            role: true,
            status: true,
          },
        },

        projects: {
          orderBy: {
            createdAt: "desc",
          },
        },

        certificates: {
          orderBy: {
            createdAt: "desc",
          },
        },
      },
    });

    return res.status(200).json({
      success: true,
      message: "Candidate profile updated successfully",
      data: updatedProfile,
    });
  } catch (err) {
    console.error("Update candidate profile error:", err);

    return res.status(500).json({
      success: false,
      message: "Failed to update candidate profile",
    });
  }
};

/**
 * Adds a project to the candidate's profile.
 * @desc Creates a new project entry associated with the candidate's profile.
 * @route POST /api/candidate/projects
 * @access Private - Candidate
 */
export const addProject = async (req, res) => {
  try {
    const userId = req.user.userId;

    const {
      title,
      description,
      link,
      date,
    } = req.body;

    // Validate title
    if (
      !title ||
      typeof title !== "string" ||
      !title.trim()
    ) {
      return res.status(400).json({
        success: false,
        message: "Project title is required",
      });
    }

    // Validate link
    if (link && !isValidUrl(link)) {
      return res.status(400).json({
        success: false,
        message: "Invalid project link",
      });
    }

    // Validate date
    let parsedDate = null;

    if (date) {
      parsedDate = parseOptionalDate(date);

      if (!parsedDate) {
        return res.status(400).json({
          success: false,
          message: "Invalid project date",
        });
      }
    }

    const profile = await prisma.candidateProfile.findUnique({
      where: { userId },
    });

    if (!profile) {
      return res.status(404).json({
        success: false,
        message: "Complete your candidate profile before adding projects",
      });
    }

    const project = await prisma.project.create({
      data: {
        candidateProfileId: profile.id,
        title: title.trim(),
        description:
          typeof description === "string" && description.trim()
            ? description.trim()
            : null,
        link:
          typeof link === "string" && link.trim()
            ? link.trim()
            : null,
        date: parsedDate,
      },
    });

    return res.status(201).json({
      success: true,
      message: "Project added successfully",
      data: project,
    });
  } catch (err) {
    console.error("Add project error:", err);

    return res.status(500).json({
      success: false,
      message: "Failed to add project",
    });
  }
};

/**
 * Updates a project in the candidate's profile.
 * @desc Modifies an existing project entry associated with the candidate's profile.
 * @route PUT /api/candidate/projects/:id
 * @access Private - Candidate
 */
export const updateProject = async (req, res) => {
  try {
    const userId = req.user.userId;
    const { id } = req.params;

    const {
      title,
      description,
      link,
      date,
    } = req.body;

    const profile = await prisma.candidateProfile.findUnique({
      where: { userId },
    });

    if (!profile) {
      return res.status(404).json({
        success: false,
        message: "Candidate profile not found",
      });
    }

    const project = await prisma.project.findUnique({
      where: { id },
    });

    if (!project || project.candidateProfileId !== profile.id) {
      return res.status(404).json({
        success: false,
        message: "Project not found",
      });
    }

    const data = {};

    if (title !== undefined) {
      if (
        typeof title !== "string" ||
        !title.trim()
      ) {
        return res.status(400).json({
          success: false,
          message: "Project title cannot be empty",
        });
      }

      data.title = title.trim();
    }

    if (description !== undefined) {
      data.description =
        typeof description === "string" && description.trim()
          ? description.trim()
          : null;
    }

    if (link !== undefined) {
      if (link && !isValidUrl(link)) {
        return res.status(400).json({
          success: false,
          message: "Invalid project link",
        });
      }

      data.link =
        typeof link === "string" && link.trim()
          ? link.trim()
          : null;
    }

    if (date !== undefined) {
      if (date === null || date === "") {
        data.date = null;
      } else {
        const parsedDate = parseOptionalDate(date);

        if (!parsedDate) {
          return res.status(400).json({
            success: false,
            message: "Invalid project date",
          });
        }

        data.date = parsedDate;
      }
    }

    const updatedProject = await prisma.project.update({
      where: { id },
      data,
    });

    return res.status(200).json({
      success: true,
      message: "Project updated successfully",
      data: updatedProject,
    });
  } catch (err) {
    console.error("Update project error:", err);

    return res.status(500).json({
      success: false,
      message: "Failed to update project",
    });
  }
};

/**
 * Deletes a project from the candidate's profile.
 * @desc Removes an existing project entry associated with the candidate's profile.
 * @route DELETE /api/candidate/projects/:id
 * @access Private - Candidate
 */

export const deleteProject = async (req, res) => {
  try {
    const userId = req.user.userId;
    const { id } = req.params;

    const profile = await prisma.candidateProfile.findUnique({
      where: { userId },
    });

    if (!profile) {
      return res.status(404).json({
        success: false,
        message: "Candidate profile not found",
      });
    }

    const project = await prisma.project.findUnique({
      where: { id },
    });

    if (!project || project.candidateProfileId !== profile.id) {
      return res.status(404).json({
        success: false,
        message: "Project not found",
      });
    }

    await prisma.project.delete({
      where: { id },
    });

    return res.status(200).json({
      success: true,
      message: "Project deleted successfully",
    });
  } catch (err) {
    console.error("Delete project error:", err);

    return res.status(500).json({
      success: false,
      message: "Failed to delete project",
    });
  }
};

/**
 * Adds a certificate to the candidate's profile.
 * @desc Creates a new certificate entry associated with the candidate's profile.
 * @route POST /api/candidate/certificates
 * @access Private - Candidate
 */
export const addCertificate = async (req, res) => {
  try {
    const userId = req.user.userId;

    const {
      title,
      description,
      link,
      date,
    } = req.body;

    // Validate title
    if (
      !title ||
      typeof title !== "string" ||
      !title.trim()
    ) {
      return res.status(400).json({
        success: false,
        message: "Certificate title is required",
      });
    }

    // Validate link
    if (link && !isValidUrl(link)) {
      return res.status(400).json({
        success: false,
        message: "Invalid certificate link",
      });
    }

    // Validate date
    let parsedDate = null;

    if (date) {
      parsedDate = parseOptionalDate(date);

      if (!parsedDate) {
        return res.status(400).json({
          success: false,
          message: "Invalid certificate date",
        });
      }
    }

    const profile = await prisma.candidateProfile.findUnique({
      where: { userId },
    });

    if (!profile) {
      return res.status(404).json({
        success: false,
        message:
          "Complete your candidate profile before adding certificates",
      });
    }

    const certificate = await prisma.certificate.create({
      data: {
        candidateProfileId: profile.id,
        title: title.trim(),
        description:
          typeof description === "string" && description.trim()
            ? description.trim()
            : null,
        link:
          typeof link === "string" && link.trim()
            ? link.trim()
            : null,
        date: parsedDate,
      },
    });

    return res.status(201).json({
      success: true,
      message: "Certificate added successfully",
      data: certificate,
    });
  } catch (err) {
    console.error("Add certificate error:", err);

    return res.status(500).json({
      success: false,
      message: "Failed to add certificate",
    });
  }
};

/**
 * Updates a certificate in the candidate's profile.
 * @desc Modifies an existing certificate entry associated with the candidate's profile.
 * @route PUT /api/candidate/certificates/:id
 * @access Private - Candidate
 */

export const updateCertificate = async (req, res) => {
  try {
    const userId = req.user.userId;
    const { id } = req.params;

    const {
      title,
      description,
      link,
      date,
    } = req.body;

    const profile = await prisma.candidateProfile.findUnique({
      where: { userId },
    });

    if (!profile) {
      return res.status(404).json({
        success: false,
        message: "Candidate profile not found",
      });
    }

    const certificate = await prisma.certificate.findUnique({
      where: { id },
    });

    if (
      !certificate ||
      certificate.candidateProfileId !== profile.id
    ) {
      return res.status(404).json({
        success: false,
        message: "Certificate not found",
      });
    }

    const data = {};

    if (title !== undefined) {
      if (
        typeof title !== "string" ||
        !title.trim()
      ) {
        return res.status(400).json({
          success: false,
          message: "Certificate title cannot be empty",
        });
      }

      data.title = title.trim();
    }

    if (description !== undefined) {
      data.description =
        typeof description === "string" && description.trim()
          ? description.trim()
          : null;
    }

    if (link !== undefined) {
      if (link && !isValidUrl(link)) {
        return res.status(400).json({
          success: false,
          message: "Invalid certificate link",
        });
      }

      data.link =
        typeof link === "string" && link.trim()
          ? link.trim()
          : null;
    }

    if (date !== undefined) {
      if (date === null || date === "") {
        data.date = null;
      } else {
        const parsedDate = parseOptionalDate(date);

        if (!parsedDate) {
          return res.status(400).json({
            success: false,
            message: "Invalid certificate date",
          });
        }

        data.date = parsedDate;
      }
    }

    const updatedCertificate = await prisma.certificate.update({
      where: { id },
      data,
    });

    return res.status(200).json({
      success: true,
      message: "Certificate updated successfully",
      data: updatedCertificate,
    });
  } catch (err) {
    console.error("Update certificate error:", err);

    return res.status(500).json({
      success: false,
      message: "Failed to update certificate",
    });
  }
};

/**
 * Deletes a certificate from the candidate's profile.
 * @desc Removes an existing certificate entry associated with the candidate's profile.
 * @route DELETE /api/candidate/certificates/:id
 * @access Private - Candidate
 */
export const deleteCertificate = async (req, res) => {
  try {
    const userId = req.user.userId;
    const { id } = req.params;

    const profile = await prisma.candidateProfile.findUnique({
      where: { userId },
    });

    if (!profile) {
      return res.status(404).json({
        success: false,
        message: "Candidate profile not found",
      });
    }

    const certificate = await prisma.certificate.findUnique({
      where: { id },
    });

    if (
      !certificate ||
      certificate.candidateProfileId !== profile.id
    ) {
      return res.status(404).json({
        success: false,
        message: "Certificate not found",
      });
    }

    await prisma.certificate.delete({
      where: { id },
    });

    return res.status(200).json({
      success: true,
      message: "Certificate deleted successfully",
    });
  } catch (err) {
    console.error("Delete certificate error:", err);

    return res.status(500).json({
      success: false,
      message: "Failed to delete certificate",
    });
  }
};

/**
 * Controller for fetching candidate dashboard summary
 * @desc Aggregate counts across bookings for candidate overview
 * @route GET /api/candidate/dashboard
 * @access Private - Candidate
 */
export const getDashboardSummary = async (req, res) => {
  try {
    const candidateProfile = await prisma.candidateProfile.findUnique({
      where: { userId: req.user.userId },
      include: { user: { select: { name: true, email: true } } },
    });

    if (!candidateProfile) {
      return res.status(404).json({ success: false, message: "Candidate profile not found" });
    }

    const [completedCount, upcomingConfirmedCount, paidBookings] = await Promise.all([
      prisma.booking.count({
        where: { candidateProfileId: candidateProfile.id, status: "COMPLETED" },
      }),

      prisma.booking.count({
        where: { candidateProfileId: candidateProfile.id, status: "CONFIRMED" },
      }),

      prisma.booking.aggregate({
        where: {
          candidateProfileId: candidateProfile.id,
          status: { in: ["CONFIRMED", "COMPLETED", "CANCELLED"  ] },
        },
        _sum: { amount: true },
      }),
    ]);

    return res.status(200).json({
      success: true,
      data: {
        name: candidateProfile.user.name,
        designation: candidateProfile.designation,
        totalInterviewsAttended: completedCount,
        upcomingConfirmedInterviews: upcomingConfirmedCount,
        totalAmountPaid: paidBookings._sum.amount || 0,
      },
    });
  } catch (err) {
    console.error("Get candidate dashboard error:", err);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch dashboard summary",
      error: err.message,
    });
  }
};