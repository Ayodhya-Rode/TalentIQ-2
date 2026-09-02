import dotenv from "dotenv";
dotenv.config();

// Required environment variables list
const requiredEnvVars = [
  "PORT",
  "DB_URl",
  "JWT_SECRET_ACCESS",
  "JWT_SECRET_REFRESH"
];
// Checks all required variables are present in the environment
requiredEnvVars.forEach((key) => {
  if (!process.env[key]) {
    throw new Error(`Missing required environment variable: ${key}`);
  }
});

const config = {
  port: process.env.PORT || 4000,
  database_url: process.env.DB_URl,
  jwt_access_secret: process.env.JWT_SECRET_ACCESS,
  jwt_refresh_secret: process.env.JWT_SECRET_REFRESH,
};

export default config;