import config from "../config/config.js";
import jwt from "jsonwebtoken";

/**
 * Middleware to verify JWT token and attach user info to request object
 */
export const verifyToken = (req, res, next) => {
  const authHeader = req.headers.authorization;
  console.log("Authorization:", authHeader);

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({ error: "No token provided" });
  }

  const token = authHeader.split(" ")[1];
  try {
    const decoded = jwt.verify(token, config.jwt_access_secret);
    req.user = decoded;
    next();
  } catch (err) {
    return res.status(401).json({ success: false, message: "Invalid or expired token" });
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