import prisma from "../config/db.js";

export const raiseQuery = async (req, res) => {
  try { 
    const { subject, message } = req.body;

    if (!subject || !subject.trim()) {
      return res.status(400).json({ success: false, message: "Subject is required" });
    }
    if (!message || !message.trim()) {
      return res.status(400).json({ success: false, message: "Message is required" });
    }

    const cleanSubject = subject.trim();
    const cleanMessage = message.trim();

    if (cleanSubject.length > 150) {
      return res.status(400).json({ success: false, message: "Subject cannot exceed 150 characters" });
    }
    if (cleanMessage.length > 2000) {
      return res.status(400).json({ success: false, message: "Message cannot exceed 2000 characters" });
    }

    const query = await prisma.supportQuery.create({
      data: {
        userId: req.user.userId,
        subject: cleanSubject,
        message: cleanMessage,
      },
    });

    return res.status(201).json({
      success: true,
      message: "Your query has been submitted. Our support team will get back to you.",
      data: query,
    });
  } catch (err) {
    console.error("Raise query error:", err);
    return res.status(500).json({ success: false, message: "Failed to submit query", error: err.message });
  }
};

export const getMyQueries = async (req, res) => {
  try {
    const queries = await prisma.supportQuery.findMany({
      where: { userId: req.user.userId },
      orderBy: { createdAt: "desc" },
    });
    return res.status(200).json({ success: true, data: queries });
  } catch (err) {
    console.error("Get my queries error:", err);
    return res.status(500).json({ success: false, message: "Failed to fetch your queries", error: err.message });
  }
};