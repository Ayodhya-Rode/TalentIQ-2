import config from "../config/config.js";
import jwt from "jsonwebtoken";
import prisma from "../config/db.js";

/**
 * Middleware to verify JWT token and attach user info to request object
 */
export const verifyToken = async (req, res, next) => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({ error: "No token provided" });
  }

  const token = authHeader.split(" ")[1];
  try {
    const decoded = jwt.verify(token, config.jwt_access_secret);

    /**
     * Check if the user exists and is approved. If not, return an error.
     * This ensures that only approved users can access protected routes.
     */
    const user = await prisma.user.findUnique({
      where: { id: decoded.userId },
      select: { id: true, role: true, status: true },
    });

    if (!user || user.status !== "APPROVED") {
      return res.status(403).json({ success: false, message: "Account not active" });
    }
    // req.user = decoded;
    req.user = { userId: user.id, role: user.role };
    next();
  } catch (err) {
    return res.status(401).json({ success: false, message: "Invalid or expired token" , error: err.message });
  }
};


/**
 * Middleware to check if the user has one of the allowed roles 
 */
export const authorize = (...allowedRoles) => {
  return (req, res, next) => {

    if (!req.user) {
      return res.status(401).json({ success: false, message: "Not authenticated" });
    }
    
    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({ error: "Access denied for this role" });
    }
    next();
  };
};