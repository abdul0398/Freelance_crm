import mysql from "mysql2/promise";
import dotenv from "dotenv";
import fs from "fs";
dotenv.config();

const dbConfig = {
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  port: process.env.DB_PORT,
  waitForConnections: true,
  multipleStatements: true,
  connectionLimit: 10,
  queueLimit: 0,
};

const db = mysql.createPool(dbConfig);

async function runSeedSQL() {
  try {
    const seedSQL = fs.readFileSync("./config/start.sql", "utf8");
    await db.query(seedSQL);
    console.log("✅ SQL file executed successfully!");
  } catch (err) {
    console.error("❌ Error running SQL file:", err);
  }
}

export default db;
