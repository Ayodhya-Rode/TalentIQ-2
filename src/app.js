import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import authRoutes from "./routes/authRoutes.js";
import superAdminRoutes from "./routes/superAdminRoutes.js";
import rateLimit from "express-rate-limit";
import categoryRoutes from "./routes/categoryRoutes.js";
import employeeRoutes from "./routes/employeeRoutes.js";
import candidateRoutes from "./routes/candidateRoutes.js";
import bookingRoutes from "./routes/bookingRoutes.js";
import interviewRoutes from "./routes/interviewRoutes.js";
import config from "./config/config.js";
import recruiterRoutes from "./routes/recruiterRoutes.js";
import queryRoutes from "./routes/queryRoutes.js";
import supportRoutes from "./routes/supportRoutes.js";
import multer from "multer";
import prisma from "./config/db.js";

const app = express();

// To prevent brute-force attacks, we can limit the number of requests to authentication routes
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 min
  max: process.env.NODE_ENV === "development" ? 1000 : 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: "Too many attempts, try again later" },
});

app.use(express.json());
app.use(cookieParser());

const allowedOrigins = [
  "http://localhost:5173",
  config.frontend_url,
].filter(Boolean); // drops undefined/empty entries instead of silently allowing "undefined" as an origin

app.use(
  cors({
    origin: function (origin, callback) {
      // no origin = server-to-server / curl / Postman, allow it
      if (!origin || allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        callback(new Error(`CORS blocked: ${origin}`));
      }
    },
    credentials: true,
  })
);

app.use("/api/auth", authLimiter, authRoutes);
app.use("/api/super-admin", superAdminRoutes);
app.use("/api/categories", categoryRoutes);
app.use("/api/employee", employeeRoutes);
app.use("/api/candidate", candidateRoutes);
app.use("/api/candidate/bookings", bookingRoutes);
app.use("/api/interviews", interviewRoutes);
app.use("/api/recruiter", recruiterRoutes);
app.use("/api/queries", queryRoutes);
app.use("/api/support", supportRoutes);

app.get("/api/health", async (req, res) => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    res.status(200).json({ status: "ok", db: "connected" });
  } catch (err) {
    res.status(500).json({ status: "error", db: "disconnected" });
  }
});

// 404 handler — must come after all real routes
app.use((req, res) => {
  res.status(404).json({ success: false, message: "Route not found" });
});

// Global error handler — must be LAST, and must come after routes
// so it actually catches errors thrown by them (including Multer's)
app.use((err, req, res, next) => {
  if (err instanceof multer.MulterError) {
    if (err.code === "LIMIT_FILE_SIZE") {
      return res
        .status(400)
        .json({ success: false, message: "File must be under 5MB" });
    }
    return res.status(400).json({ success: false, message: err.message });
  }

  if (err.message === "Only PDF files are allowed") {
    return res.status(400).json({ success: false, message: err.message });
  }

  console.error(err.stack);
  res.status(err.status || 500).json({
    success: false,
    message: err.message || "Internal server error",
  });
});

export default app;