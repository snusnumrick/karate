"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const process_1 = __importDefault(require("process"));
const mcp_1 = require("@modelcontextprotocol/sdk/server/mcp");
const stdio_1 = require("@modelcontextprotocol/sdk/server/stdio");
const zod_1 = require("zod");
const apiClient_1 = require("./apiClient"); // Import our existing API client
// Define Zod schema for a student
const StudentInputSchema = zod_1.z.object({
    firstName: zod_1.z.string().min(1, "Student first name is required"),
    lastName: zod_1.z.string().min(1, "Student last name is required"),
    gender: zod_1.z.string().min(1, "Student gender is required"), // Consider enum if possible: z.enum(['Male', 'Female', 'Other'])
    birthDate: zod_1.z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Invalid birth date format (YYYY-MM-DD)"),
    t_shirt_size: zod_1.z.string().min(1, "T-shirt size is required"), // Consider enum
    school: zod_1.z.string().min(1, "School is required"),
    grade_level: zod_1.z.string().min(1, "Grade level is required"), // Consider enum
    special_needs: zod_1.z.string().nullish(),
    allergies: zod_1.z.string().nullish(),
    medications: zod_1.z.string().nullish(),
    immunizations_up_to_date: zod_1.z.string().nullish(), // Consider enum ['Yes', 'No']
    immunization_notes: zod_1.z.string().nullish(),
    belt_rank: zod_1.z.string().nullish(), // Consider z.nativeEnum(Database["public"]["Enums"]["belt_rank_enum"]).nullish() if Database type is accessible here
    cell_phone: zod_1.z.string().nullish(),
    email: zod_1.z.string().email("Invalid student email format").nullish(),
});
// Define Zod schema for Guardian 2 (optional)
const Guardian2InputSchema = zod_1.z.object({
    firstName: zod_1.z.string().min(1, "Guardian 2 first name required if provided"),
    lastName: zod_1.z.string().min(1, "Guardian 2 last name required if provided"),
    relationship: zod_1.z.string().min(1, "Guardian 2 relationship required if provided"),
    homePhone: zod_1.z.string().nullish(),
    workPhone: zod_1.z.string().nullish(),
    cellPhone: zod_1.z.string().min(1, "Guardian 2 cell phone required if provided"),
    email: zod_1.z.string().email("Invalid Guardian 2 email format").min(1, "Guardian 2 email required if provided"),
    employer: zod_1.z.string().nullish(),
    employerPhone: zod_1.z.string().nullish(),
    employerNotes: zod_1.z.string().nullish(),
}).nullish(); // Make the whole object optional
// Define the expanded schema for the registration tool's arguments using Zod
const RegisterUserArgsSchema = zod_1.z.object({
    // User Auth
    email: zod_1.z.string().email("Invalid email format"),
    password: zod_1.z.string().min(8, "Password must be at least 8 characters"), // Match web form
    marketingEmails: zod_1.z.boolean().optional().default(false),
    // Family Info
    familyName: zod_1.z.string().min(1, "Family name is required"),
    address: zod_1.z.string().min(1, "Address is required"),
    city: zod_1.z.string().min(1, "City is required"),
    province: zod_1.z.string().min(1, "Province is required"), // Consider enum
    postalCode: zod_1.z.string().min(1, "Postal code is required"),
    primaryPhone: zod_1.z.string().min(1, "Primary phone is required"),
    referralSource: zod_1.z.string().nullish(),
    referralName: zod_1.z.string().nullish(),
    emergencyContact: zod_1.z.string().nullish(),
    healthInfo: zod_1.z.string().nullish(),
    // Guardian 1 Info
    guardian1FirstName: zod_1.z.string().min(1, "Guardian 1 first name is required"),
    guardian1LastName: zod_1.z.string().min(1, "Guardian 1 last name is required"),
    guardian1Relationship: zod_1.z.string().min(1, "Guardian 1 relationship is required").default('Parent/Guardian'),
    guardian1HomePhone: zod_1.z.string().nullish(),
    guardian1WorkPhone: zod_1.z.string().nullish(),
    guardian1CellPhone: zod_1.z.string().min(1, "Guardian 1 cell phone is required"),
    guardian1Employer: zod_1.z.string().nullish(),
    guardian1EmployerPhone: zod_1.z.string().nullish(),
    guardian1EmployerNotes: zod_1.z.string().nullish(),
    // Guardian 2 Info (Optional)
    guardian2: Guardian2InputSchema,
    // Students Array (Optional, but usually expected)
    students: zod_1.z.array(StudentInputSchema).optional().default([]),
});
async function startMcpServer() {
    // Removed startup log: console.error("Starting MCP Server...");
    // Create an MCP server instance
    const server = new mcp_1.McpServer({
        name: "KarateAppConnector",
        version: "1.0.0",
        // Add capabilities if needed, e.g., for resources or prompts
        capabilities: {
            tools: {} // Indicate tool capability
        }
    });
    // Define the 'registerUser' tool
    server.tool("registerUser", // Tool name
    RegisterUserArgsSchema.shape, // Pass the raw shape of the Zod schema
    async (args) => {
        // args are already validated against the schema here
        console.error(`[MCP Tool: registerUser] Received request with args: ${JSON.stringify(args)}`); // Ensure this uses console.error
        try {
            // Call our existing API client to interact with the Karate app's API
            const result = await (0, apiClient_1.apiClient)('/api/v1/auth/register', {
                method: 'POST',
                body: args, // Pass validated arguments directly
            });
            // Check if the API call was successful (based on structure)
            if ('userId' in result) {
                console.error(`[MCP Tool: registerUser] Karate API registration successful.`); // Ensure this uses console.error
                // Return success result in MCP format
                return {
                    content: [{ type: "text", text: `Registration successful: ${result.message} (User ID: ${result.userId}, Family ID: ${result.familyId})` }]
                };
            }
            else {
                // Handle cases where the API might return 200 OK but with an error structure
                console.error(`[MCP Tool: registerUser] Karate API returned OK status but error structure: ${result.error}`);
                return {
                    content: [{ type: "text", text: `Registration failed (API Error): ${result.error}` }],
                    isError: true
                };
            }
        }
        catch (error) {
            // Handle errors thrown by the apiClient (e.g., network errors, non-OK status codes)
            console.error(`[MCP Tool: registerUser] Error calling Karate API:`, error);
            const errorMessage = error instanceof Error ? error.message : "Unknown error during API call";
            // Return error result in MCP format
            return {
                content: [{ type: "text", text: `Registration failed: ${errorMessage}` }],
                isError: true
            };
        }
    });
    // Removed configuration log: console.error("MCP Server configured with 'registerUser' tool.");
    // Start receiving messages on stdin and sending messages on stdout
    const transport = new stdio_1.StdioServerTransport();
    // Removed connection logs:
    // console.error("Connecting MCP Server to StdioTransport...");
    await server.connect(transport);
    // console.error("MCP Server connected and listening via stdio.");
}
// Start the server when the script is run
startMcpServer().catch(err => {
    console.error("Failed to start MCP server:", err);
    process_1.default.exit(1);
});
//# sourceMappingURL=server.js.map