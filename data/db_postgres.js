import pg from "pg";
import dotenv from "dotenv";

// Load environment variables
dotenv.config();

// PostgreSQL connection configuration using Neon
const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false, // Required for Neon
  },
});

// Test connection function
async function testConnection() {
  try {
    const client = await pool.connect();
    console.log("Successfully connected to PostgreSQL database");
    client.release();
  } catch (error) {
    console.error("Error connecting to PostgreSQL database:", error);
  }
}

// Test the connection
testConnection();

export default pool;
