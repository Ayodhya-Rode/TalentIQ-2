import crypto from "crypto";
import prisma from "../config/db.js"; // same prisma import as aiQuestionController.js

const MAX_SCORE = 10;

// To converte a full name into a short display name.
// "Ayodhya Rode" -> "Ayodhya R."
const displayName = (fullName = "") => {
  const parts = fullName.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "Candidate";
  if (parts.length === 1) return parts[0];
  return `${parts[0]} ${parts[parts.length - 1][0].toUpperCase()}.`;
};

// PATCH /api/bookings/:bookingId/share   body: { enabled: true|false }
export const toggleShare = async (req, res) => {
  try {
    const { bookingId } = req.params;
    const { enabled } = req.body;

    if (typeof enabled !== "boolean")
      return res
        .status(400)
        .json({ message: "'enabled' must be true or false" });

    const booking = await prisma.booking.findUnique({
      where: { id: bookingId },
      include: { candidateProfile: true },
    });

    if (!booking) return res.status(404).json({ message: "Booking not found" });

    if (booking.candidateProfile.userId !== req.user.userId)
      return res.status(403).json({ message: "Not your interview" });

    if (booking.status !== "COMPLETED")
      return res
        .status(400)
        .json({ message: "Only completed interviews can be shared" });

    if (booking.score === null || booking.score === undefined)
      return res
        .status(400)
        .json({ message: "This interview has no score yet" });

    // Enabling: fresh random token. Disabling: token deleted, so the old link dies.
    const data = enabled
      ? {
          shareEnabled: true,
          shareToken: crypto.randomBytes(18).toString("base64url"),
          sharedAt: new Date(),
        }
      : { shareEnabled: false, shareToken: null };

    // If already enabled, keep the existing link stable
    if (enabled && booking.shareEnabled && booking.shareToken) {
      return res.json({
        shareEnabled: true,
        shareToken: booking.shareToken,
        sharedAt: booking.sharedAt,
      });
    }

    const updated = await prisma.booking.update({
      where: { id: bookingId },
      data,
    });

    res.json({
      shareEnabled: updated.shareEnabled,
      shareToken: updated.shareToken,
      sharedAt: updated.sharedAt,
    });
  } catch (err) {
    console.error("toggleShare:", err);
    res.status(500).json({ message: "Failed to update sharing" });
  }
};

// GET /api/public/scorecards/:token   (no auth, wired up in step 3)
export const getPublicScorecard = async (req, res) => {
  try {
    const { token } = req.params;

    // Reject junk early: our tokens are 24 chars of base64url
    if (!/^[A-Za-z0-9_-]{24}$/.test(token))
      return res.status(404).json({ message: "Scorecard not found" });

    const booking = await prisma.booking.findUnique({
      where: { shareToken: token },
      select: {
        shareEnabled: true,
        status: true,
        score: true,
        category: { select: { name: true } },
        slot: { select: { date: true } },
        candidateProfile: { select: { user: { select: { name: true } } } },
        employeeProfile: {
          select: {
            designation: true,
            company: true,
            categories: { select: { category: { select: { name: true } } } },
          },
        },
      },
    });

    // Same 404 for missing, disabled, or not-completed: reveals nothing
    if (!booking || !booking.shareEnabled || booking.status !== "COMPLETED")
      return res.status(404).json({ message: "Scorecard not found" });

    // Revocation must take effect immediately, so never cache
    res.set("Cache-Control", "no-store");

    res.json({
      candidateName: displayName(booking.candidateProfile.user.name),
      score: booking.score,
      maxScore: MAX_SCORE,
      date: booking.slot.date,
      domains: booking.category
        ? [booking.category.name]
        : booking.employeeProfile.categories.length === 1
          ? [booking.employeeProfile.categories[0].category.name]
          : [],
      interviewer: {
        designation: booking.employeeProfile.designation,
        company: booking.employeeProfile.company,
      },
    });
  } catch (err) {
    console.error("getPublicScorecard:", err);
    res.status(500).json({ message: "Failed to load scorecard" });
  }
};
