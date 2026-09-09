import prisma from "../config/db.js";

const userSelect = {
  select: { id: true, name: true, email: true, role: true },
};

export const getSupportDashboard = async (req, res) => {
  try {
    const [total, solved, pending] = await Promise.all([
      prisma.supportQuery.count(),
      prisma.supportQuery.count({ where: { status: "RESOLVED" } }),
      prisma.supportQuery.count({ where: { status: "OPEN" } }),
    ]);
    return res.status(200).json({ success: true, data: { total, solved, pending } });
  } catch (err) {
    console.error("Get support dashboard error:", err);
    return res.status(500).json({ success: false, message: "Failed to fetch support dashboard", error: err.message });
  }
};

export const getQueries = async (req, res) => {
  try {
    const { status } = req.query;

    if (status && !["OPEN", "RESOLVED"].includes(status)) {
      return res.status(400).json({ success: false, message: "Invalid status. Use OPEN or RESOLVED" });
    }

    const queries = await prisma.supportQuery.findMany({
      where: status ? { status } : {},
      include: { user: userSelect, resolvedBy: userSelect },
      orderBy: { createdAt: "desc" },
    });

    return res.status(200).json({ success: true, data: queries });
  } catch (err) {
    console.error("Get queries error:", err);
    return res.status(500).json({ success: false, message: "Failed to fetch queries", error: err.message });
  }
};

export const resolveQuery = async (req, res) => {
  try {
    const { id } = req.params;
    const { resolutionNote } = req.body;

    const query = await prisma.supportQuery.findUnique({ where: { id } });
    if (!query) {
      return res.status(404).json({ success: false, message: "Query not found" });
    }
    if (query.status === "RESOLVED") {
      return res.status(400).json({ success: false, message: "This query has already been resolved" });
    }

    const updated = await prisma.supportQuery.update({
      where: { id },
      data: {
        status: "RESOLVED",
        resolvedById: req.user.userId,
        resolutionNote: typeof resolutionNote === "string" && resolutionNote.trim() ? resolutionNote.trim() : null,
        resolvedAt: new Date(),
      },
      include: { user: userSelect, resolvedBy: userSelect },
    });

    return res.status(200).json({ success: true, message: "Query marked as resolved", data: updated });
  } catch (err) {
    console.error("Resolve query error:", err);
    return res.status(500).json({ success: false, message: "Failed to resolve query", error: err.message });
  }
};  