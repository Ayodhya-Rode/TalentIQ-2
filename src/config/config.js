import dotenv from "dotenv";
dotenv.config();

// Required environment variables list
const requiredEnvVars = [
  "PORT",
  "DB_URl",
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
};

export default config;