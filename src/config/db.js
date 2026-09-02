import config from "./config.js";
import { PrismaClient } from "../generated/prisma/index.js";
import { PrismaPg } from "@prisma/adapter-pg";

const adapter = new PrismaPg({ connectionString: config.database_url });
const prisma = new PrismaClient({ adapter });

export default prisma;