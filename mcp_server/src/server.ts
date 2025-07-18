import process from 'process'; // Added import
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js"; // Reverted import path
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js"; // Reverted import path
import { z } from "zod";
import { apiClient } from './apiClient'; // Import our existing API client

// Define Zod schema for a student
const StudentInputSchema = z.object({
    firstName: z.string().min(1, "Student first name is required"),
    lastName: z.string().min(1, "Student last name is required"),
    gender: z.string().min(1, "Student gender is required"), // Consider enum if possible: z.enum(['Male', 'Female', 'Other'])
    birthDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Invalid birth date format (YYYY-MM-DD)"),
    t_shirt_size: z.string().min(1, "T-shirt size is required"), // Consider enum
    school: z.string().min(1, "School is required"),
    grade_level: z.string().min(1, "Grade level is required"), // Consider enum
    special_needs: z.string().nullish(),
    allergies: z.string().nullish(),
    medications: z.string().nullish(),
    immunizations_up_to_date: z.string().nullish(), // Consider enum ['Yes', 'No']
    immunization_notes: z.string().nullish(),
    belt_rank: z.string().nullish(), // Consider z.nativeEnum(Database["public"]["Enums"]["belt_rank_enum"]).nullish() if Database type is accessible here
    cell_phone: z.string().nullish(),
    email: z.string().email("Invalid student email format").nullish(),
});

// Define Zod schema for Guardian 2 (optional)
const Guardian2InputSchema = z.object({
    firstName: z.string().min(1, "Guardian 2 first name required if provided"),
    lastName: z.string().min(1, "Guardian 2 last name required if provided"),
    relationship: z.string().min(1, "Guardian 2 relationship required if provided"),
    homePhone: z.string().nullish(),
    workPhone: z.string().nullish(),
    cellPhone: z.string().min(1, "Guardian 2 cell phone required if provided"),
    email: z.string().email("Invalid Guardian 2 email format").min(1, "Guardian 2 email required if provided"),
    employer: z.string().nullish(),
    employerPhone: z.string().nullish(),
    employerNotes: z.string().nullish(),
}).nullish(); // Make the whole object optional

// Define the expanded schema for the registration tool's arguments using Zod
const RegisterUserArgsSchema = z.object({
    // User Auth
    email: z.string().email("Invalid email format"),
    password: z.string().min(8, "Password must be at least 8 characters"), // Match web form
    marketingEmails: z.boolean().optional().default(false),

    // Family Info
    familyName: z.string().min(1, "Family name is required"),
    address: z.string().min(1, "Address is required"),
    city: z.string().min(1, "City is required"),
    province: z.string().min(1, "Province is required"), // Consider enum
    postalCode: z.string().min(1, "Postal code is required"),
    primaryPhone: z.string().min(1, "Primary phone is required"),
    referralSource: z.string().nullish(),
    referralName: z.string().nullish(),
    emergencyContact: z.string().nullish(),
    healthInfo: z.string().nullish(),

    // Guardian 1 Info
    guardian1FirstName: z.string().min(1, "Guardian 1 first name is required"),
    guardian1LastName: z.string().min(1, "Guardian 1 last name is required"),
    guardian1Relationship: z.string().min(1, "Guardian 1 relationship is required").default('Parent/Guardian'),
    guardian1HomePhone: z.string().nullish(),
    guardian1WorkPhone: z.string().nullish(),
    guardian1CellPhone: z.string().min(1, "Guardian 1 cell phone is required"),
    guardian1Employer: z.string().nullish(),
    guardian1EmployerPhone: z.string().nullish(),
    guardian1EmployerNotes: z.string().nullish(),

    // Guardian 2 Info (Optional)
    guardian2: Guardian2InputSchema,

    // Students Array (Optional, but usually expected)
    students: z.array(StudentInputSchema).optional().default([]),
});


// Define the expected success response structure from the Karate API
interface KarateApiRegisterSuccessResponse {
    userId: string;
    familyId: string;
    message: string;
}

// Define the expected error response structure from the Karate API
interface KarateApiRegisterErrorResponse {
    error: string;
}

async function startMcpServer() {
    // Removed startup log: console.error("Starting MCP Server...");

    // Create an MCP server instance
    const server = new McpServer({
        name: "KarateAppConnector",
        version: "1.0.0",
        // Add capabilities if needed, e.g., for resources or prompts
        capabilities: {
            tools: {} // Indicate tool capability
        }
    });

    // Define the 'registerUser' tool
    server.tool(
        "registerUser", // Tool name
        RegisterUserArgsSchema.shape, // Pass the raw shape of the Zod schema
        async (args) => { // Handler function for the tool
            // args are already validated against the schema here
            console.error(`[MCP Tool: registerUser] Received request with args: ${JSON.stringify(args)}`); // Ensure this uses console.error

            try {
                // Call our existing API client to interact with the Karate app's API
                const result = await apiClient<KarateApiRegisterSuccessResponse | KarateApiRegisterErrorResponse>(
                    '/api/v1/auth/register',
                    {
                        method: 'POST',
                        body: args, // Pass validated arguments directly
                    }
                );

                // Check if the API call was successful (based on structure)
                if ('userId' in result) {
                    console.error(`[MCP Tool: registerUser] Karate API registration successful.`); // Ensure this uses console.error
                    // Return success result in MCP format
                    return {
                        content: [{ type: "text", text: `Registration successful: ${result.message} (User ID: ${result.userId}, Family ID: ${result.familyId})` }]
                    };
                } else {
                    // Handle cases where the API might return 200 OK but with an error structure
                    console.error(`[MCP Tool: registerUser] Karate API returned OK status but error structure: ${result.error}`);
                     return {
                        content: [{ type: "text", text: `Registration failed (API Error): ${result.error}` }],
                        isError: true
                    };
                }

            } catch (error) {
                // Handle errors thrown by the apiClient (e.g., network errors, non-OK status codes)
                console.error(`[MCP Tool: registerUser] Error calling Karate API:`, error);
                const errorMessage = error instanceof Error ? error.message : "Unknown error during API call";
                // Return error result in MCP format
                return {
                    content: [{ type: "text", text: `Registration failed: ${errorMessage}` }],
                    isError: true
                };
            }
        }
    );

    // Removed configuration log: console.error("MCP Server configured with 'registerUser' tool.");

    // Start receiving messages on stdin and sending messages on stdout
    const transport = new StdioServerTransport();
    // Removed connection logs:
    // console.error("Connecting MCP Server to StdioTransport...");
    await server.connect(transport);
    // console.error("MCP Server connected and listening via stdio.");
}

// Start the server when the script is run
startMcpServer().catch(err => {
    console.error("Failed to start MCP server:", err);
    process.exit(1);
});
