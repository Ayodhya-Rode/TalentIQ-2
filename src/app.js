import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import authRoutes from "./routes/authRoutes.js";
import superAdminRoutes from "./routes/superAdminRoutes.js";
import rateLimit from "express-rate-limit";
import categoryRoutes from "./routes/categoryRoutes.js";
import employeeRoutes from "./routes/employeeRoutes.js";





const app = express();

// To prevent brute-force attacks, we can limit the number of requests to authentication routes
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 min
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: "Too many attempts, try again later" },
});
app.use(express.json());
app.use(cors());
app.use(cookieParser());
app.use("/api/auth", authLimiter, authRoutes);
app.use("/api/super-admin", superAdminRoutes);
app.use("/api/categories", categoryRoutes);
app.use("/api/employee", employeeRoutes);




// Global error handling middleware
app.use((req, res) => {
  res.status(404).json({ success: false, message: "Route not found" });
});

// Global error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(err.status || 500).json({
    success: false,
    message: err.message || "Internal server error",
  });
});

export default app;
