import dotenv from "dotenv";

// Load environment variables
dotenv.config();

// Set required environment variables for production if not already set
if (!process.env.KNOWBE4_BASE_URL) {
  process.env.KNOWBE4_BASE_URL = "https://us.api.knowbe4.com/v1";
}

process.env.NODE_ENV = "production";

// Import and start the server
import("./dist/index.js");