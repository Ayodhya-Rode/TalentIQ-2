import crypto from "crypto";
import prisma from "../config/db.js";
import config from "../config/config.js";

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
//To turn on/off sharing scorecard links for a completed interview.
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

// To load the public scorecard data for a given share token. Returns null if not found or not shareable.
// Shared by the JSON endpoint and the preview page
const loadPublicScorecard = async (token) => {
  // Our tokens are 24 chars of base64url
  if (!/^[A-Za-z0-9_-]{24}$/.test(token)) return null;

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

  // Same null for missing, disabled, or not-completed: reveals nothing
  if (!booking || !booking.shareEnabled || booking.status !== "COMPLETED")
    return null;

  return {
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
  };
};

// GET /api/public/scorecards/:token   (no auth)
// Returns the scorecard data for a given share token, or 404 if not found or not shareable.
export const getPublicScorecard = async (req, res) => {
  try {
    const data = await loadPublicScorecard(req.params.token);
    if (!data) return res.status(404).json({ message: "Scorecard not found" });

    // Revocation must take effect immediately, so never cache
    res.set("Cache-Control", "no-store");
    res.json(data);
  } catch (err) {
    console.error("getPublicScorecard:", err);
    res.status(500).json({ message: "Failed to load scorecard" });
  }
};

const escapeHtml = (s = "") =>
  String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");

// To social media preview card
// GET /s/:token   (no auth) - preview tags for link crawlers, then sends people to the app
export const getScorecardPreview = async (req, res) => {
  const base = (config.frontend_url || "").replace(/\/+$/, "");
  const token = req.params.token;
  const target = `${base}/scorecard/${encodeURIComponent(token)}`;

  try {
    res.set("Cache-Control", "no-store");

    const data = await loadPublicScorecard(token);

    // Missing or turned off: the app shows its own "not found" page
    if (!data) return res.redirect(302, target);

    const domain = data.domains[0];
    const title = `${data.candidateName} scored ${data.score}/${data.maxScore} in a${
      domain ? ` ${domain}` : ""
    } mock interview`;
    const description =
      "Practice interview scorecard on TalentIQ. Open the link to see the full scorecard.";
    const image = `${base}/og-image.png`;
    const pageUrl = `${base}/s/${encodeURIComponent(token)}`;
    const jsTarget = JSON.stringify(target).replace(/</g, "\\u003c");

    const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<title>${escapeHtml(title)}</title>
<meta name="robots" content="noindex, nofollow" />
<meta property="og:type" content="website" />
<meta property="og:site_name" content="TalentIQ" />
<meta property="og:title" content="${escapeHtml(title)}" />
<meta property="og:description" content="${escapeHtml(description)}" />
<meta property="og:url" content="${escapeHtml(pageUrl)}" />
<meta property="og:image" content="${escapeHtml(image)}" />
<meta property="og:image:width" content="1200" />
<meta property="og:image:height" content="630" />
<meta name="twitter:card" content="summary_large_image" />
<meta name="twitter:title" content="${escapeHtml(title)}" />
<meta name="twitter:description" content="${escapeHtml(description)}" />
<meta name="twitter:image" content="${escapeHtml(image)}" />
<script>window.location.replace(${jsTarget});</script>
<noscript><meta http-equiv="refresh" content="0;url=${escapeHtml(target)}" /></noscript>
</head>
<body>
<p><a href="${escapeHtml(target)}">Open scorecard</a></p>
</body>
</html>`;

    res.type("html").send(html);
  } catch (err) {
    console.error("getScorecardPreview:", err);
    res.redirect(302, target);
  }
};
