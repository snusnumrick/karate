"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const process_1 = __importDefault(require("process")); // Added import
const dotenv_1 = __importDefault(require("dotenv"));
const path_1 = __importDefault(require("path"));
// Load environment variables from .env file located in the mcp_server directory,
// assuming the command is run from the project root.
// dotenv.config({ path: path.resolve(__dirname, '../.env') }); // Original path
dotenv_1.default.config({ path: path_1.default.resolve(process_1.default.cwd(), 'mcp_server/.env') }); // Load relative to CWD
const config = {
    karateApiBaseUrl: process_1.default.env.KARATE_API_BASE_URL,
};
// Validate essential config
if (!config.karateApiBaseUrl) {
    console.error("FATAL ERROR: KARATE_API_BASE_URL is not defined in the environment variables.");
    process_1.default.exit(1);
}
exports.default = config;
//# sourceMappingURL=config.js.map