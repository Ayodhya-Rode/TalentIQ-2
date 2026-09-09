import prisma from "../config/db.js";
import { sendEmail } from "../utils/sendEmail.js";

/**
 * Escape user-controlled values before inserting them into HTML.
 */
const escapeHtml = (value = "") => {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
};

/**
 * Remove CR/LF characters from values that are used in email subjects.
 */
const cleanEmailSubject = (value = "") => {
  return String(value)
    .replace(/[\r\n]/g, " ")
    .trim();
};

/**
 * Validate a string field.
 */
const isValidString = (value) => {
  return typeof value === "string" && value.trim().length > 0;
};

/**
 * Safely convert query pagination values to integers.
 */
const parsePagination = (pageValue, limitValue) => {
  const parsedPage = Number.parseInt(pageValue, 10);
  const parsedLimit = Number.parseInt(limitValue, 10);

  const page = Number.isInteger(parsedPage) && parsedPage > 0 ? parsedPage : 1;

  // Prevent clients from requesting huge result sets.
  const limit =
    Number.isInteger(parsedLimit) && parsedLimit > 0
      ? Math.min(parsedLimit, 50)
      : 20;

  return {
    page,
    limit,
    skip: (page - 1) * limit,
  };
};

/**
 * Gets a list of candidates based on search and category filters.
 * @desc This endpoint retrieves a paginated list of candidates based on optional search and category filters. It ensures that only approved candidates are returned and supports case-insensitive search on skills and designation.
 * @route GET /api/recruiter/candidates
 * @access Private (Recruiter only)
 */

export const getCandidates = async (req, res) => {
  try {
    const { search, page: pageParam, limit: limitParam } = req.query;

    // Validate query parameters
    if (search !== undefined && typeof search !== "string") {
      return res.status(400).json({
        success: false,
        message: "Search must be a string",
      });
    }

    const normalizedSearch = typeof search === "string" ? search.trim() : "";

    if (normalizedSearch.length > 100) {
      return res.status(400).json({
        success: false,
        message: "Search query cannot exceed 100 characters",
      });
    }

    const { page, limit, skip } = parsePagination(pageParam, limitParam);

    // Build candidate filters
    const where = {
      // Only approved candidates are visible to recruiters.
      user: {
        status: "APPROVED",
      },
      ...(normalizedSearch && {
        OR: [
          {
            skills: {
              contains: normalizedSearch,
              mode: "insensitive",
            },
          },
          {
            designation: {
              contains: normalizedSearch,
              mode: "insensitive",
            },
          },
        ],
      }),
    };

    // Get recruiter profile
    const recruiterProfile = await prisma.recruiterProfile.findUnique({
      where: {
        userId: req.user.userId,
      },
      select: {
        id: true,
      },
    });

    if (!recruiterProfile) {
      return res.status(404).json({
        success: false,
        message: "Recruiter profile not found",
      });
    }

    // Fetch candidates + total count
    const [candidates, total] = await prisma.$transaction([
      prisma.candidateProfile.findMany({
        where,
        select: {
          id: true,
          designation: true,
          skills: true,
          createdAt: true,
          user: {
            select: {
              name: true,
              email: true,
            },
          },
          projects: true,
          certificates: true,
        },
        orderBy: {
          createdAt: "desc",
        },
        skip,
        take: limit,
      }),
      prisma.candidateProfile.count({
        where,
      }),
    ]);

    // Find candidates already contacted by this recruiter
    const candidateIds = candidates.map((candidate) => candidate.id);

    let contactedIds = new Set();
    if (candidateIds.length > 0) {
      const contactedLogs = await prisma.recruiterEmailLog.findMany({
        where: {
          recruiterProfileId: recruiterProfile.id,
          candidateProfileId: {
            in: candidateIds,
          },
        },
        select: {
          candidateProfileId: true,
        },
        distinct: ["candidateProfileId"],
      });
      contactedIds = new Set(
        contactedLogs.map((log) => log.candidateProfileId),
      );
    }

    // Add alreadyContacted flag
    const candidatesWithFlag = candidates.map((candidate) => ({
      ...candidate,
      alreadyContacted: contactedIds.has(candidate.id),
    }));

    return res.status(200).json({
      success: true,
      data: candidatesWithFlag,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (err) {
    console.error("Get candidates error:", err);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch candidates",
    });
  }
};

/**
 * Gets the email history for a specific candidate.
 * @desc This endpoint retrieves the email history for a specific candidate profile. It ensures that the candidate exists, is approved, and that the authenticated recruiter has access to view the email history.
 * @route GET /api/recruiter/candidates/:candidateProfileId/email-history
 * @access Private (Recruiter only)
 */
export const getEmailHistory = async (req, res) => {
  try {
    const { candidateProfileId } = req.params;

    if (!candidateProfileId || typeof candidateProfileId !== "string") {
      return res.status(400).json({
        success: false,
        message: "Invalid candidate profile ID",
      });
    }

    // Find the authenticated recruiter's profile.
    const recruiterProfile = await prisma.recruiterProfile.findUnique({
      where: {
        userId: req.user.userId,
      },
      select: {
        id: true,
      },
    });

    if (!recruiterProfile) {
      return res.status(404).json({
        success: false,
        message: "Recruiter profile not found",
      });
    }

    // Verify that the candidate exists and is approved.
    const candidate = await prisma.candidateProfile.findUnique({
      where: {
        id: candidateProfileId,
      },
      select: {
        id: true,
        user: {
          select: {
            status: true,
          },
        },
      },
    });

    if (!candidate) {
      return res.status(404).json({
        success: false,
        message: "Candidate not found",
      });
    }

    if (candidate.user.status !== "APPROVED") {
      return res.status(403).json({
        success: false,
        message: "Candidate is not available",
      });
    }

    // IMPORTANT:
    // recruiterProfileId prevents one recruiter from seeing another recruiter's email history.
    const logs = await prisma.recruiterEmailLog.findMany({
      where: {
        recruiterProfileId: recruiterProfile.id,
        candidateProfileId,
      },

      orderBy: {
        sentAt: "desc",
      },
    });

    return res.status(200).json({
      success: true,
      data: logs,
    });
  } catch (err) {
    console.error("Get email history error:", err);

    return res.status(500).json({
      success: false,
      message: "Failed to fetch email history",
    });
  }
};

/**
 * Sends an outreach email to a candidate.
 * @desc This endpoint allows a recruiter to send an outreach email to a specific candidate. It validates the input, checks for duplicate outreach attempts within the last 24 hours, and logs the email history.
 * @route POST /api/recruiter/candidates/:candidateProfileId/outreach-email
 * @access Private (Recruiter only)
 */
export const sendOutreachEmail = async (req, res) => {
  try {
    const { candidateProfileId } = req.params;
    const { role, skillsRequired } = req.body;

    // Validate candidate ID
    if (!candidateProfileId || typeof candidateProfileId !== "string") {
      return res.status(400).json({
        success: false,
        message: "Invalid candidate profile ID",
      });
    }

    // Validate request body
    if (!isValidString(role)) {
      return res.status(400).json({
        success: false,
        message: "Role is required",
      });
    }

    if (!isValidString(skillsRequired)) {
      return res.status(400).json({
        success: false,
        message: "Skills required are required",
      });
    }

    const normalizedRole = role.trim();
    const normalizedSkills = skillsRequired.trim();

    if (normalizedRole.length > 100) {
      return res.status(400).json({
        success: false,
        message: "Role cannot exceed 100 characters",
      });
    }

    if (normalizedSkills.length > 500) {
      return res.status(400).json({
        success: false,
        message: "Skills required cannot exceed 500 characters",
      });
    }

    // Get recruiter profile
    const recruiterProfile = await prisma.recruiterProfile.findUnique({
      where: {
        userId: req.user.userId,
      },
      select: {
        id: true,
        company: true,
        location: true,
        user: {
          select: {
            name: true,
          },
        },
      },
    });

    if (!recruiterProfile) {
      return res.status(404).json({
        success: false,
        message: "Recruiter profile not found",
      });
    }

    // Get candidate
    const candidateProfile = await prisma.candidateProfile.findUnique({
      where: {
        id: candidateProfileId,
      },
      select: {
        id: true,
        user: {
          select: {
            name: true,
            email: true,
            status: true,
          },
        },
      },
    });

    if (!candidateProfile) {
      return res.status(404).json({
        success: false,
        message: "Candidate not found",
      });
    }

    // Never rely only on getCandidates() to enforce visibility.
    if (candidateProfile.user.status !== "APPROVED") {
      return res.status(403).json({
        success: false,
        message: "Candidate is not available for outreach",
      });
    }

    // Check for duplicate outreach within the last 24 hours, same recruiter, same candidate, same role.
    const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);

    const recentOutreach = await prisma.recruiterEmailLog.findFirst({
      where: {
        recruiterProfileId: recruiterProfile.id,
        candidateProfileId,
        role: normalizedRole,
        sentAt: {
          gte: twentyFourHoursAgo,
        },
      },
      select: {
        id: true,
      },
    });

    if (recentOutreach) {
      return res.status(429).json({
        success: false,
        message:
          "You have already contacted this candidate for this role within the last 24 hours",
      });
    }

    // Prepare safe HTML values
    const candidateName = escapeHtml(candidateProfile.user.name || "Candidate");
    const recruiterName = escapeHtml(recruiterProfile.user.name || "Recruiter");

    const company = escapeHtml(
      recruiterProfile.company?.trim() || "our company",
    );

    const location = escapeHtml(
      recruiterProfile.location?.trim() || "Not specified",
    );

    const safeRole = escapeHtml(normalizedRole);
    const safeSkills = escapeHtml(normalizedSkills);

    // Email subject should not contain CR/LF.
    const subjectRole = cleanEmailSubject(normalizedRole);
    const subjectCompany = cleanEmailSubject(
      recruiterProfile.company || "our company",
    );

    const subject = `Job Opportunity: ${subjectRole} at ${subjectCompany}`;

    // Send email
    await sendEmail({
      to: candidateProfile.user.email,
      subject,
      htmlContent: `
        <div style="font-family: Arial, sans-serif; line-height: 1.6;">
          <h2>Hi ${candidateName},</h2>

          <p>
            ${recruiterName} from
            <strong>${company}</strong>
            found your profile on TalentIQ and thinks you may be a good fit
            for an opening.
          </p>

          <p>
            <strong>Role:</strong>
            ${safeRole}
          </p>

          <p>
            <strong>Skills required:</strong>
            ${safeSkills}
          </p>

          <p>
            <strong>Location:</strong>
            ${location}
          </p>

          <p>
            If you're interested, reply to this email or reach out directly.
          </p>

          <p>
            Regards,<br />
            ${recruiterName}<br />
            ${company}
          </p>
        </div>
      `,
    });

    // Log the email history in the database. This is done after sending the email to ensure that we only log successful sends. If logging fails, we still return a success response for the email send, but we log the error for debugging purposes.
    try {
      await prisma.recruiterEmailLog.create({
        data: {
          recruiterProfileId: recruiterProfile.id,
          candidateProfileId,
          role: normalizedRole,
          skillsRequired: normalizedSkills,
        },
      });
    } catch (logError) {
      console.error(
        "Outreach email sent but failed to create email log:",
        logError,
      );

      return res.status(500).json({
        success: false,
        message:
          "Email was sent successfully, but the email history could not be saved",
      });
    }

    return res.status(200).json({
      success: true,
      message: "Email sent successfully",
    });
  } catch (err) {
    console.error("Send outreach email error:", err);

    return res.status(500).json({
      success: false,
      message: "Failed to send outreach email",
    });
  }
};

/**
 * Creates a new recruiter profile.
 * @desc This endpoint allows a recruiter to create their profile. It validates the input and ensures that a profile does not already exist for the authenticated user.
 * @route POST /api/recruiter/profile
 * @access Private (Recruiter only)
 */
export const createRecruiterProfile = async (req, res) => {
  try {
    const { company, location } = req.body;

    // Validate input
    if (!isValidString(company)) {
      return res.status(400).json({
        success: false,
        message: "Company is required",
      });
    }

    if (!isValidString(location)) {
      return res.status(400).json({
        success: false,
        message: "Location is required",
      });
    }

    const normalizedCompany = company.trim();
    const normalizedLocation = location.trim();

    if (normalizedCompany.length > 150) {
      return res.status(400).json({
        success: false,
        message: "Company cannot exceed 150 characters",
      });
    }

    if (normalizedLocation.length > 150) {
      return res.status(400).json({
        success: false,
        message: "Location cannot exceed 150 characters",
      });
    }

    // Check existing profile
    const existing = await prisma.recruiterProfile.findUnique({
      where: {
        userId: req.user.userId,
      },
      select: {
        id: true,
      },
    });

    if (existing) {
      return res.status(409).json({
        success: false,
        message: "Recruiter profile already exists",
      });
    }

    // Create profile
    const profile = await prisma.recruiterProfile.create({
      data: {
        userId: req.user.userId,
        company: normalizedCompany,
        location: normalizedLocation,
      },
    });

    return res.status(201).json({
      success: true,
      message: "Profile created successfully",
      data: profile,
    });
  } catch (err) {
    console.error("Create recruiter profile error:", err);

    // Handles race condition if user submits twice and userId has a UNIQUE constraint.
    if (err?.code === "P2002") {
      return res.status(409).json({
        success: false,
        message: "Recruiter profile already exists",
      });
    }

    return res.status(500).json({
      success: false,
      message: "Failed to create recruiter profile",
    });
  }
};

/**
 * Gets the recruiter profile for the authenticated user.
 * @desc This endpoint retrieves the recruiter profile associated with the authenticated user. If no profile exists, it returns a 404 error.
 * @route GET /api/recruiter/profile
 * @access Private (Recruiter only)
 */
export const getRecruiterProfile = async (req, res) => {
  try {
    const profile = await prisma.recruiterProfile.findUnique({
      where: {
        userId: req.user.userId,
      },
    });

    if (!profile) {
      return res.status(404).json({
        success: false,
        message: "Recruiter profile not found",
      });
    }

    return res.status(200).json({
      success: true,
      data: profile,
    });
  } catch (err) {
    console.error("Get recruiter profile error:", err);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch recruiter profile",
    });
  }
};

/**
 * Updates the recruiter profile for the authenticated user.
 * @desc This endpoint allows a recruiter to update their profile. It validates the input and ensures that at least one field is provided for the update. If the profile does not exist, it returns a 404 error.
 * @route PUT /api/recruiter/profile
 * @access Private (Recruiter only)
 */
export const updateRecruiterProfile = async (req, res) => {
  try {
    const { company, location } = req.body;

    // Validate that at least one
    // field was provided.

    if (company === undefined && location === undefined) {
      return res.status(400).json({
        success: false,
        message: "At least one profile field is required",
      });
    }

    // Build update object dynamically.This prevents undefined values from unintentionally overwriting existing data.

    const data = {};

    if (company !== undefined) {
      if (!isValidString(company)) {
        return res.status(400).json({
          success: false,
          message: "Company must be a non-empty string",
        });
      }

      const normalizedCompany = company.trim();

      if (normalizedCompany.length > 150) {
        return res.status(400).json({
          success: false,
          message: "Company cannot exceed 150 characters",
        });
      }
      data.company = normalizedCompany;
    }

    if (location !== undefined) {
      if (!isValidString(location)) {
        return res.status(400).json({
          success: false,
          message: "Location must be a non-empty string",
        });
      }

      const normalizedLocation = location.trim();
      if (normalizedLocation.length > 150) {
        return res.status(400).json({
          success: false,
          message: "Location cannot exceed 150 characters",
        });
      }
      data.location = normalizedLocation;
    }

    // Update
    const updated = await prisma.recruiterProfile.update({
      where: {
        userId: req.user.userId,
      },
      data,
    });

    return res.status(200).json({
      success: true,
      message: "Profile updated successfully",
      data: updated,
    });
  } catch (err) {
    console.error("Update recruiter profile error:", err);

    // Prisma P2025 = record not found.
    if (err?.code === "P2025") {
      return res.status(404).json({
        success: false,
        message: "Recruiter profile not found",
      });
    }

    return res.status(500).json({
      success: false,
      message: "Failed to update recruiter profile",
    });
  }
};

/**
 * Gets the full outreach email history for the authenticated recruiter.
 * @desc This endpoint returns every email the recruiter has sent, across all candidates, ordered by most recent first. Used to power the Outreach History tab so a recruiter can see their own activity without checking each candidate individually.
 * @route GET /api/recruiter/outreach-history
 * @access Private (Recruiter only)
 */
export const getMyOutreachHistory = async (req, res) => {
  try {
    const recruiterProfile = await prisma.recruiterProfile.findUnique({
      where: { userId: req.user.userId },
    });

    if (!recruiterProfile) {
      return res
        .status(404)
        .json({ success: false, message: "Recruiter profile not found" });
    }

    const logs = await prisma.recruiterEmailLog.findMany({
      where: { recruiterProfileId: recruiterProfile.id },
      include: {
        candidateProfile: { include: { user: { select: { name: true } } } },
      },
      orderBy: { sentAt: "desc" },
    });

    return res.status(200).json({ success: true, data: logs });
  } catch (err) {
    console.error("Get outreach history error:", err);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch outreach history",
      error: err.message,
    });
  }
};
