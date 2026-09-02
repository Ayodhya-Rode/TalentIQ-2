import config from "./src/config/config.js";
import app from "./src/app.js";
import prisma from "./src/config/db.js";


prisma.$connect()
  .then(() => console.log("Database connected"))
  .catch((err) => {
    console.error("Database connection failed:", err);
    process.exit(1);
  });

app.listen(config.port, () => {
  console.log(`Server is running on port ${config.port}`);
})
