import dotenv from "dotenv";
dotenv.config();

// Required environment variables list
const requiredEnvVars = [
  "PORT",
  "DB_URl",
  "JWT_SECRET_ACCESS",
  "JWT_SECRET_REFRESH",
  "BREVO_API_KEY",
  "BREVO_SENDER_EMAIL",
  "RAZORPAY_KEY_ID",
  "RAZORPAY_KEY_SECRET",
  "FRONTEND_URL",
  "LIVEKIT_URL",
  "LIVEKIT_API_KEY",
  "LIVEKIT_API_SECRET",
  "IMAGEKIT_PUBLIC_KEY",
  "IMAGEKIT_PRIVATE_KEY",
  "IMAGEKIT_URL_ENDPOINT",
  
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
  brevo:{
    brevo_api_key: process.env.BREVO_API_KEY,
    brevo_sender_email: process.env.BREVO_SENDER_EMAIL,
    
  },
  razorpay: {
    razorpay_key_id: process.env.RAZORPAY_KEY_ID,
    razorpay_key_secret: process.env.RAZORPAY_KEY_SECRET,
  },
  frontend_url: process.env.FRONTEND_URL,
  livekit: {
    livekit_url: process.env.LIVEKIT_URL,
    livekit_api_key: process.env.LIVEKIT_API_KEY,
    livekit_api_secret: process.env.LIVEKIT_API_SECRET,
  },
  imagekit:{
    imagekit_url: process.env.IMAGEKIT_URL_ENDPOINT,
    imagekit_public: process.env.IMAGEKIT_PUBLIC_KEY,
    imagekit_private: process.env.IMAGEKIT_PRIVATE_KEY
  }
};

export default config;