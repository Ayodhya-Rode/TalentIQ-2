import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import config from "./config/config.js"

const app = express();
app.use(express.json());
app.use(cors({
  origin: config.frontend_url,
  credentials: true,
}));
app.use(cookieParser())

app.get("/", (req, res) => {
  res.send("Hello World!");
});



export default app;
