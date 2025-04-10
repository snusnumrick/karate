import process from 'process'; // Added import
import dotenv from 'dotenv';
import path from 'path';

// Load environment variables from .env file located in the mcp_server directory,
// assuming the command is run from the project root.
// dotenv.config({ path: path.resolve(__dirname, '../.env') }); // Original path
dotenv.config({ path: path.resolve(process.cwd(), 'mcp_server/.env') }); // Load relative to CWD


const config = {
    karateApiBaseUrl: process.env.KARATE_API_BASE_URL,
};

// Validate essential config
if (!config.karateApiBaseUrl) {
    console.error("FATAL ERROR: KARATE_API_BASE_URL is not defined in the environment variables.");
    process.exit(1);
}

export default config;
