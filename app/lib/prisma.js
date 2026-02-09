import "dotenv/config";
import { PrismaMariaDb } from "@prisma/adapter-mariadb";
import { PrismaClient } from "@/generated/prisma/client";

const adapter = new PrismaMariaDb(
  {
    host: "localhost",
    port: 3306,
    user: "root",
    database: "analyzer",
    connectionLimit: 5,
  },
  { schema: "analyzer" }, // Optional: specify the default schema/database
);
const globalForPrisma = globalThis;
const prisma = globalForPrisma.prisma || new PrismaClient({ adapter });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}

export default prisma;
