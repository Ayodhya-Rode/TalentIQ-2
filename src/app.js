import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import authRoutes from "./routes/authRoutes.js";
import superAdminRoutes from "./routes/superAdminRoutes.js";


const app = express();
app.use(express.json());
app.use(cors());
app.use(cookieParser());
app.use("/api/auth", authRoutes);
app.use("/api/super-admin", superAdminRoutes);



export default app;
