import React, {useEffect, useRef, useState} from 'react'; // Import useEffect and useRef
import {ActionFunctionArgs, json} from "@remix-run/node";
// Import useSubmit
import {Form, useActionData, useNavigation, useSubmit} from "@remix-run/react";
import {Button} from "~/components/ui/button";
import {Textarea} from "~/components/ui/textarea";
import {Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle} from "~/components/ui/card";
import {ScrollArea} from "~/components/ui/scroll-area";
import {Database as DatabaseIcon, MessageSquare, PanelLeft, SendHorizontal, Sparkles} from "lucide-react";
import {Badge} from "~/components/ui/badge";
// Separator removed as it's unused
import {Alert, AlertDescription, AlertTitle} from "~/components/ui/alert";
import {createClient} from "@supabase/supabase-js";
import {GoogleGenerativeAI, HarmBlockThreshold, HarmCategory} from "@google/generative-ai";
import {Database, Json} from "~/types/database.types";
import {ClientOnly} from "~/components/client-only";
import {cn} from "~/lib/utils";
import retrieveDatabaseStructure, {formatSchemaAsMarkdown} from "~/utils/retrieve.db.strructure"; // Import cn utility

// --- Cache for Database Schema Description ---
let cachedSchemaDescription: string | null = null;
let cachedSchemaTimestamp: number | null = null;
const CACHE_DURATION_MS = 60 * 60 * 1000; // 1 hour in milliseconds
// --- End Cache ---


// Example questions for the UI
const exampleQuestions = [
    "How much sales tax has been collected in Q1?",
    "What was the total revenue from monthly payments in March?",
    "How many students are registered in each belt rank?",
    "What product has the highest sales this year?",
    "How many new families registered last month?"
];

// Type for the response format from the action
type ActionResponse = {
    success: boolean;
    data?: Json | null; // Use Json type for DB data
    error?: string;
    sql?: string; // The generated SQL query
    summary?: string; // The AI-generated summary of the results
    executionTime?: number; // DB query execution time
    originalQuery?: string; // The user's natural language query
};

// Helper function to format currency values
function formatCurrency(amount: number): string {
    return new Intl.NumberFormat('en-CA', {style: 'currency', currency: 'CAD'}).format(amount / 100);
}


// --- Function to get (and cache) database schema description ---
async function getAndCacheSchemaDescription(): Promise<string> {
    const now = Date.now();

    // Check cache validity
    if (cachedSchemaDescription && cachedSchemaTimestamp && (now - cachedSchemaTimestamp < CACHE_DURATION_MS)) {
        console.log("Using cached schema description.");
        return cachedSchemaDescription;
    }

    console.log("Fetching fresh schema description from database...");

    try {
        const schema = await retrieveDatabaseStructure();
        let schemaString = await formatSchemaAsMarkdown(schema);
        // console.log("Formatted schema description:", schemaString);

        // --- Append Essential Static Notes ---
        // These notes provide context/logic not easily derived from raw schema
        schemaString += `

-- General Notes:
  - Assume PK/FK relationships exist where names suggest (e.g., family_id -> families.id).
  - Monetary amounts (amount, price) are stored in CENTS (integer). Divide by 100.0 for dollar values in SQL.
  - Dates are typically DATE or TIMESTAMPTZ.
  - Current Date for relative calculations: ${new Date().toISOString().split('T')[0]}

-- Important Logic Notes:
  - Belt Ranks: To find a student's *current* belt rank, join 'students' with 'belt_awards' on 'student_id' and select the 'type' associated with the most recent 'awarded_date' for that student (e.g., using ROW_NUMBER() OVER (PARTITION BY student_id ORDER BY awarded_date DESC) as rn WHERE rn = 1).
  - Payments & Orders: Payments of type 'store_purchase' are linked to an order via 'payments.order_id'. Other payment types likely have NULL for 'order_id'.
`;
        // --- End Static Notes ---

        // Update cache
        cachedSchemaDescription = schemaString;
        cachedSchemaTimestamp = now;
        console.log("Schema description fetched and cached.");

        return cachedSchemaDescription;

    } catch (error) {
        console.error("Error fetching or formatting schema description:", error);
        // Fallback to a basic error message or potentially re-throw
        // For now, return a message indicating failure, the AI calls might fail subsequently
        return "Error: Could not retrieve database schema description.";
        // Or consider throwing the error: throw error;
    }
}
// --- End Schema Fetch Function ---


// The action function to process the query and generate a summary
export async function action({request}: ActionFunctionArgs): Promise<Response> {
    const formData = await request.formData();
    const originalQuery = formData.get("query") as string;

    if (!originalQuery) {
        return json({success: false, error: "No query provided"} satisfies ActionResponse);
    }

    try {
        // Create a direct database connection
        const supabaseUrl = process.env.SUPABASE_URL;
        const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

        if (!supabaseUrl || !supabaseServiceKey) {
            throw new Error('Missing Supabase environment variables required for database query.');
        }

        const supabaseAdmin = createClient<Database>(supabaseUrl, supabaseServiceKey);

        // 1. Get the (potentially cached) schema description
        const schemaDescription = await getAndCacheSchemaDescription();
        if (schemaDescription.startsWith("Error:")) {
             // Handle schema fetch failure - maybe return an error immediately
             return json({ success: false, error: schemaDescription, originalQuery: originalQuery } satisfies ActionResponse);
        }


        // 2. Process the natural language query to SQL, passing the schema
        const sqlQuery = await processNaturalLanguageQuery(originalQuery, schemaDescription);

        if (!sqlQuery) {
            // This now catches both UNSUPPORTED and non-SELECT generations from the LLM
            return json({
                success: false,
                error: "Sorry, I couldn't translate your request into a valid database query. Please try rephrasing it or ask a different question.",
                originalQuery: originalQuery,
            } satisfies ActionResponse);
        }

        // Start timing the query execution
        const startTime = performance.now();

        // Execute the SQL query
        // Specify the expected return type for better type safety, although it's broad (Json | null)
        const {data, error} = await supabaseAdmin.rpc('execute_admin_query', {query_text: sqlQuery});

        // Calculate execution time
        const executionTime = (performance.now() - startTime) / 1000;

        if (error) {
            // Log the specific SQL error for debugging
            console.error(`SQL execution error for query "${sqlQuery}": ${error.message}`);
            // Construct a more user-friendly error message, potentially including the DB error reason
            let userErrorMessage = "The database query failed.";
            // Check for the specific error message from the execute_admin_query function
            if (error.message && error.message.toLowerCase().includes('only select statements are allowed')) {
                userErrorMessage = "The generated query was not a permitted read-only query. Please try rephrasing your request.";
            } else if (error.message) {
                // Include a generic hint of the DB error without exposing too much detail
                userErrorMessage = `The database query failed. Please check your question or try again later. (Hint: ${error.code || 'DB Error'})`;
            }
            // Throw the user-friendly error to be caught by the outer catch block
            // Throw the user-friendly error to be caught by the outer catch block
            // Throw the user-friendly error to be caught by the outer catch block
            throw new Error(userErrorMessage);
        }

        // Note: Removed the check for `data.error`. The primary `error` object from the rpc call
        // is the standard way to catch execution errors. The function itself returns Json | null.
        // If the function *logic* needs to return structured errors within the JSON,
        // that would require specific handling based on the expected JSON structure.

        // 4. Generate a summary of the results using Gemini, passing the schema
        const summary = await generateResultSummary(originalQuery, data, schemaDescription);

        return json({
            success: true,
            data,
            sql: sqlQuery,
            summary: summary ?? "Could not generate summary.", // Provide fallback text
            executionTime,
            originalQuery: originalQuery,
        } satisfies ActionResponse);

    } catch (error: unknown) { // Use unknown for caught errors
        console.error("Error in DB Chat action:", error); // Log the caught error
        // Type check the error before accessing properties
        const errorMessage = error instanceof Error ? error.message : "An unknown error occurred during the action.";
        return json({
            success: false,
            error: errorMessage, // Return the error message to the client
            // Removed duplicate error key which also caused TS18046
            originalQuery: originalQuery,
        } satisfies ActionResponse);
    }
}

// Process the natural language query into SQL using Gemini API
async function processNaturalLanguageQuery(query: string, schemaDescription: string): Promise<string | null> {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
        console.error("GEMINI_API_KEY environment variable not set.");
        throw new Error("Server configuration error: Missing API Key.");
    }

    const genAI = new GoogleGenerativeAI(apiKey);
    // Switch to a potentially more capable model
    const model = genAI.getGenerativeModel({model: "gemini-2.5-pro-exp-03-25"});

    // Use the dynamically generated schema description passed as a parameter
    const prompt = `
    ${schemaDescription}

    Based on the schema provided above, convert the following natural language query into a single, read-only PostgreSQL SELECT statement.
    - ONLY generate the SQL query. Do not include any explanations, markdown formatting (like \`\`\`sql), or introductory text.
    - Ensure the query is safe and does not modify data (no INSERT, UPDATE, DELETE, DROP, etc.).
    - If the query is ambiguous or cannot be answered with a SELECT statement based on the schema, return only the text: UNSUPPORTED
    - Pay attention to dates and time periods mentioned (e.g., "last month", "Q1", "this year"). Use the current date provided for relative calculations.
    - **PostgreSQL Date Calculations:** For relative dates, use \`CURRENT_DATE\` and \`INTERVAL\`. Examples:
        - "last month": \`created_at >= date_trunc('month', CURRENT_DATE - INTERVAL '1 month') AND created_at < date_trunc('month', CURRENT_DATE)\`
        - "yesterday": \`created_at >= CURRENT_DATE - INTERVAL '1 day' AND created_at < CURRENT_DATE\`
        - "this year": \`created_at >= date_trunc('year', CURRENT_DATE) AND created_at < date_trunc('year', CURRENT_DATE + INTERVAL '1 year')\`
        - "Q1": \`EXTRACT(QUARTER FROM created_at) = 1\` (adjust year as needed, e.g., \`AND EXTRACT(YEAR FROM created_at) = EXTRACT(YEAR FROM CURRENT_DATE)\`)
    - **Enum Handling:**
        - **Comparison:** When comparing an enum column (like \`belt_awards.type\`) with a text value, cast the enum to text: \`enum_column::text = 'text_value'\`.
        - **Listing All Values:** To get all possible values of an enum type (e.g., to count occurrences for each rank including zeros), use \`unnest(enum_range(NULL::your_enum_type))\`. Example for belt ranks: \`SELECT rank_value FROM unnest(enum_range(NULL::belt_rank_enum)) AS rank_value\`. You can then LEFT JOIN other tables to this.
    - **Case-Insensitive Text Comparison:** For comparing text fields like names (e.g., \`families.name\`, \`students.first_name\`) where casing might vary, use the \`LOWER()\` function on both the column and the value: \`LOWER(column_name) = LOWER('value')\`. Use \`ILIKE\` for pattern matching instead of \`LIKE\`.
    - **Exact Name Matching:** When a specific name (like a family name 'Smith' or student name 'John Doe') is mentioned in the query, use that *exact* name in the SQL comparison value (applying \`LOWER()\` if needed for case-insensitivity). Do *not* add suffixes like "Family" or assume variations unless explicitly stated in the query. Example: If the query says "messages from Smith", use \`LOWER(f.name) = LOWER('Smith')\`, not \`LOWER('Smith Family')\`.
    - Assume amounts in 'payments', 'payment_taxes', 'orders', 'order_items' are stored in cents and should often be summed or averaged. Format currency output appropriately if possible within SQL (e.g., SUM(total_amount) / 100.0).
    - **Important:** When using aggregate functions like SUM, COUNT, AVG, ensure they return 0 instead of NULL if no rows match the criteria. Use COALESCE for this (e.g., COALESCE(SUM(column), 0)).

    Natural Language Query: "${query}"

    SQL Query:
  `;

    try {
        const generationConfig = {
            // temperature: 0.7, // Adjust creativity vs. precision
            maxOutputTokens: 500, // Limit output length
        };

        const safetySettings = [
            {category: HarmCategory.HARM_CATEGORY_HARASSMENT, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE},
            {category: HarmCategory.HARM_CATEGORY_HATE_SPEECH, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE},
            {
                category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT,
                threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE
            },
            {
                category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT,
                threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE
            },
        ];

        let result;
        try {
            result = await model.generateContent({
                contents: [{role: "user", parts: [{text: prompt}]}],
                generationConfig,
                safetySettings,
            });
        } catch (error: unknown) {
            if (error instanceof Error && 'status' in error && (error as { status?: number }).status === 429) {
                console.warn("Primary model failed with 429 status. Retrying with backup model...");
                const backupModel = genAI.getGenerativeModel({model: "gemini-1.5-pro"});
                result = await backupModel.generateContent({
                    contents: [{role: "user", parts: [{text: prompt}]}],
                    generationConfig,
                    safetySettings,
                });
            } else {
                throw error;
            }
        }
        const response = result.response;
        let sql = response.text()?.trim(); // Use let as we might modify it

        if (!sql || sql.toUpperCase() === 'UNSUPPORTED') {
            console.warn(`LLM could not generate SQL for query: "${query}"`);
            return null; // Indicate failure to generate SQL
        }

        // Remove potential markdown fences (```sql ... ``` or ``` ... ```)
        sql = sql.replace(/^```sql\s*/i, '').replace(/```\s*$/, '').trim();

        // Remove SQL comments (-- to end of line)
        sql = sql.replace(/--.*$/gm, '').trim();

        // Basic check to ensure it's likely a SELECT query AFTER removing fences and comments
        const trimmedSql = sql.toUpperCase(); // No need for extra trim() here
        if (!trimmedSql.startsWith('SELECT')) {
            console.warn(`LLM generated non-SELECT statement (after fence/comment removal): ${sql}`);
            // Return null instead of throwing, let the action function handle the user message
            return null;
        }

        // Remove trailing semicolon if present AFTER removing comments
        const finalSql = sql.replace(/;\s*$/, '');

        console.log(`Generated SQL for query "${query}":\n${finalSql}`); // Log generated SQL for debugging
        return finalSql;

    } catch (error: unknown) { // Use unknown for caught errors
        console.error("Error calling Gemini API:", error);
        // Check for specific safety blocking errors
        if (error instanceof Error && error.message && error.message.includes('response was blocked due to safety')) {
            throw new Error("The query could not be processed due to safety filters.");
        }
        throw new Error("Failed to generate SQL query from natural language.");
    }
}


// Generate a natural language summary of the query results using Gemini API
async function generateResultSummary(originalQuery: string, results: Json | null, schemaDescription: string): Promise<string | null> { // Use Json | null type
    console.log(`Generating summary for query result "${JSON.stringify(results, null, 2)}":`);
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
        console.error("GEMINI_API_KEY environment variable not set for summary generation.");
        // Don't throw, just return null so the UI can handle it gracefully
        return "Error: Summary generation failed due to missing API Key.";
    }

    // Handle cases where results might be null or not an array
    const resultsString = results ? JSON.stringify(results, null, 2) : "No data returned.";
    // Truncate potentially very large results to avoid exceeding token limits
    const maxResultsLength = 4000; // Adjust as needed
    const truncatedResults = resultsString.length > maxResultsLength
        ? resultsString.substring(0, maxResultsLength) + "\n... (results truncated)"
        : resultsString;


    const genAI = new GoogleGenerativeAI(apiKey);
    // Use the faster flash model for summarization
    const model = genAI.getGenerativeModel({model: "gemini-2.0-flash"});

    // Use the dynamically generated schema description passed as a parameter
    const prompt = `
    ${schemaDescription}

    Original Question: "${originalQuery}"

    Query Results (JSON format, potentially truncated):
    \`\`\`json
    ${truncatedResults}
    \`\`\`

    Based on the original question and the query results provided above, generate a concise and direct natural language summary answering the question.
    - Focus *only* on answering the original question based *strictly* on the provided data.
    - **Interpreting Empty Results:** If the results indicate no data was found (e.g., an empty array \`[]\` or results showing zero counts/sums), state that the query found no matching records, rather than implying a schema limitation. Examples: "No students were found matching the criteria.", "Zero sales tax was collected in that period.", "No families registered last month."
    - If the results were explicitly truncated (indicated by "... (results truncated)"), briefly mention that the provided data might be incomplete.
    - Do *not* add generic disclaimers like "according to the available data" or "based on the schema" unless the data truncation note is present or the query itself failed.
    - Do *not* repeat the raw data values unless necessary for the answer (e.g., "The total revenue was $X.").
    - Keep the summary brief and factual, typically 1-2 sentences.
    - Output *only* the plain text summary, with no markdown formatting, headers, or introductory phrases.

    Summary:
  `;

    try {
        const generationConfig = {
            // temperature: 0.5, // Lower temperature for more factual summary
            maxOutputTokens: 150, // Limit summary length
        };
        const safetySettings = [
            {category: HarmCategory.HARM_CATEGORY_HARASSMENT, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE},
            {category: HarmCategory.HARM_CATEGORY_HATE_SPEECH, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE},
            {
                category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT,
                threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE
            },
            {
                category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT,
                threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE
            },
        ];


        const result = await model.generateContent({
            contents: [{role: "user", parts: [{text: prompt}]}],
            generationConfig,
            safetySettings,
        });
        const response = result.response;
        const summaryText = response.text()?.trim();

        if (!summaryText) {
            console.warn(`LLM could not generate summary for query: "${originalQuery}"`);
            return "Could not generate a summary for these results.";
        }

        console.log(`Generated summary for query "${originalQuery}":\n${summaryText}`);
        return summaryText;

    } catch (error: unknown) { // Use unknown for caught errors
        console.error("Error calling Gemini API for summary generation:", error);
        if (error instanceof Error && error.message && error.message.includes('response was blocked due to safety')) {
            return "The summary could not be generated due to safety filters.";
        }
        // Return an error message instead of throwing, allowing the UI to display it
        return "Error: Failed to generate summary.";
    }
}


// Helper to render results: Displays AI summary and a generic data table
function renderQueryResults(summary: string | undefined | null, data: Json | null): React.ReactNode {
    // Check if data is a non-empty array of objects
    const isArrayOfObjects = (d: Json | null): d is Record<string, Json | null>[] =>
        Array.isArray(d) && d.length > 0 && typeof d[0] === 'object' && d[0] !== null;

    const tableData = isArrayOfObjects(data) ? data : null;
    const hasData = !!tableData; // Simplified check based on tableData
    const firstRowKeys = tableData ? Object.keys(tableData[0]) : []; // Safe access to keys

    return (
        <div className="space-y-4">
            {/* Display AI Summary */}
            {summary && (
                <Card
                    className="bg-green-100 dark:bg-green-900/30 border-green-200 dark:border-green-700"> {/* Use green shades */}
                    <CardHeader className="pb-2 pt-3">
                        <CardTitle
                            className="text-base font-medium flex items-center text-green-800 dark:text-green-200"> {/* Use green text */}
                            <Sparkles
                                className="h-4 w-4 mr-2 text-green-600 dark:text-green-400"/> {/* Use green icon color */}
                            Summary
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="pb-3">
                        <p className="text-sm">{summary}</p>
                    </CardContent>
                </Card>
            )}

            {/* Display Raw Data Table */}
            {!hasData && !summary ? ( // Only show "No results" if there's no data AND no summary
                <Alert>
                    <AlertTitle>No results found</AlertTitle>
                    <AlertDescription>
                        The query returned no data. Try adjusting your question or time period.
                    </AlertDescription>
                </Alert>
            ) : tableData ? ( // Use the refined tableData check
                <div className="rounded-md border">
                    <div className="p-4">
                        <h4 className="text-sm font-medium mb-2 text-muted-foreground">Raw Data</h4>
                        <table className="w-full text-sm">
                            <thead>
                            <tr className="border-b">
                                {/* Use firstRowKeys derived safely */}
                                {firstRowKeys.map((key) => (
                                    <th key={key} className="py-3 px-2 text-left font-medium">
                                        {key.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
                                    </th>
                                ))}
                            </tr>
                            </thead>
                            <tbody>
                            {/* Map over the refined tableData */}
                            {tableData.map((row, rowIndex) => (
                                <tr key={rowIndex} className="border-b last:border-b-0">
                                    {/* Use firstRowKeys to ensure consistent column order and access */}
                                    {firstRowKeys.map((key, colIndex) => {
                                        const value = row[key]; // Access value using the key
                                        return (
                                            <td key={colIndex} className="py-3 px-2 align-top">
                                                {/* Attempt to format currency if column name suggests it and value is number */}
                                                {typeof value === 'number' && (key.includes('amount') || key.includes('revenue') || key.includes('tax'))
                                                    ? formatCurrency(value)
                                                    : value === null ?
                                                        <span className="text-muted-foreground italic">null</span>
                                                        : String(value)}
                                            </td>
                                        );
                                    })}
                                </tr>
                            ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            ) : null}
        </div>
    );
}


// Main component
export default function AdminDbChat() {
    const [question, setQuestion] = useState("");
    // Update chat history type to include 'thinking' state
    const [chatHistory, setChatHistory] = useState<{
        type: 'query' | 'response' | 'thinking'; // Add 'thinking' type
        content?: string; // Make content optional for 'thinking' state
        data?: Json | null; // Use Json type for DB data
        sql?: string; // Generated SQL
        summary?: string; // AI summary of results
        error?: string; // Error message, if any
        timestamp: Date;
        originalQuery?: string; // Store the original query text for context
        executionTime?: number; // Add execution time here
    }[]>([]);

    const actionData = useActionData<ActionResponse>();
    const navigation = useNavigation();
    const submit = useSubmit(); // Initialize useSubmit
    const isSubmitting = navigation.state === "submitting";
    const formRef = useRef<HTMLFormElement>(null); // Ref for the main form
    const textareaRef = useRef<HTMLTextAreaElement>(null); // Ref for the textarea
    const processedQueryRef = useRef<string | null>(null); // Ref to track the last processed query

    // Function to handle adding query to history ONLY (optimistic update)
    const addQueryToHistory = (queryText: string) => {
        if (!queryText.trim()) return; // Don't add empty queries

        // Replace history with the current query and a thinking indicator
        setChatHistory([
            {
                type: 'query',
                content: queryText,
                timestamp: new Date(),
            },
            {
                type: 'thinking',
                timestamp: new Date(), // Add timestamp for consistency
            }
        ]);
        // Do not clear input here, clear it after successful actionData response
        // Do not submit the form here, let the Form's onSubmit handle it
    };


    // Add response to chat history when actionData changes and navigation is idle
    useEffect(() => {
        // Only process if actionData is present, navigation is idle, AND this specific query hasn't been processed yet
        if (actionData && navigation.state === "idle" && actionData.originalQuery !== processedQueryRef.current) {

            // Replace history with only the current response
            setChatHistory([
                {
                    type: 'response',
                    // Content can be empty or hold a generic status if needed, but error handling is separate.
                    content: actionData.success ? "" : `Error: ${actionData.error || 'An unknown error occurred.'}`,
                    data: actionData.data,
                    sql: actionData.sql,
                    summary: actionData.summary,
                    error: actionData.error,
                    timestamp: new Date(),
                    originalQuery: actionData.originalQuery,
                    executionTime: actionData.executionTime
                }
            ]);

            // Mark this query as processed, ensuring null if undefined
            processedQueryRef.current = actionData.originalQuery ?? null;

                // Clear the input field only after a successful response is processed
                if (actionData.success) {
                    setQuestion("");
                    // Refocus the textarea after clearing it
                    textareaRef.current?.focus();
                }
            // } // End of removed isResponseAlreadyAdded check
        }
        // Depend on actionData and navigation.state.
        // chatHistory dependency removed as it's no longer needed for the check.
    }, [actionData, navigation.state]);

    // Focus textarea on initial mount
    useEffect(() => {
        textareaRef.current?.focus();
    }, []);


    return (
        // Use flexbox for robust height management
        <div className="flex flex-col h-full">
            <h1 className="text-2xl font-bold mb-2">Database Assistant</h1>
            <p className="text-muted-foreground mb-4">
                Ask questions about the karate school&apos;s database in natural language.
            </p>

            {/* Use flex for main layout instead of grid for better height control */}
            <div className="flex flex-1 gap-6 min-h-0">
                {/* Left sidebar - make it a flex column to control vertical alignment */}
                <div className="hidden md:flex md:flex-col w-1/3 flex-shrink-0"> {/* Changed w-1/4 to w-1/3, added flex flex-col */}
                    {/* Example Questions Card */}
                    <Card className="flex-shrink-0"> {/* Prevent this card from growing */}
                        <CardHeader>
                            <CardTitle className="flex items-center">
                                    <Sparkles className="h-5 w-5 mr-2"/>
                                    Example Questions
                                </CardTitle>
                                <CardDescription>
                                    Click on any of these examples to try them out.
                                </CardDescription>
                            </CardHeader>
                            <CardContent className="pb-0">
                                <ul className="space-y-1"> {/* Reduced spacing slightly */}
                                    {exampleQuestions.map((q, i) => (
                                        <li key={i}>
                                            {/* Use Button onClick to set state and trigger main form submission */}
                                            {/* Adjusted button classes for wrapping and padding */}
                                            <Button
                                                variant="ghost"
                                                className="justify-start h-auto py-1 px-2 w-full text-left text-sm whitespace-normal" // Allow wrapping, reduce padding
                                                onClick={() => {
                                                    setQuestion(q); // Update the input field state visually
                                                    addQueryToHistory(q); // Add to history optimistically
                                                    // Use useSubmit to send data directly, bypassing form serialization timing issues
                                                    submit(
                                                        { query: q }, // Explicitly send the question
                                                        { method: "post", action: "/admin/db-chat" }
                                                    );
                                                }}
                                                disabled={isSubmitting} // Disable while submitting
                                            >
                                                {q}
                                            </Button>
                                        </li>
                                    ))}
                                </ul>
                            </CardContent>
                        </Card>

                        <div className="mt-6">
                            <Card>
                                <CardHeader className="pb-2">
                                    <CardTitle className="text-sm flex items-center">
                                        <PanelLeft className="h-4 w-4 mr-2"/>
                                        Features
                                    </CardTitle>
                                </CardHeader>
                                <CardContent>
                                    {/* Use flex-wrap and gap for better badge layout */}
                                    <div className="flex flex-wrap gap-1">
                                        <div className="w-full">
                                            <Badge variant="outline" className="mb-2 text-base">Sales Tax Analysis</Badge>
                                        </div>
                                        <div className="w-full">
                                            <Badge variant="outline" className="mb-2 text-base">Revenue Reports</Badge>
                                        </div>
                                        <div className="w-full">
                                            <Badge variant="outline" className="mb-2 text-base">Student Statistics</Badge>
                                        </div>
                                        <div className="w-full">
                                            <Badge variant="outline" className="mb-2 text-base">Product Performance</Badge>
                                        </div>
                                        <div className="w-full">
                                            <Badge variant="outline" className="mb-2 text-base">Enrollment Tracking</Badge>
                                        </div>
                                    </div>
                                </CardContent>
                            </Card>
                        </div>
                </div>

                {/* Chat area - Use flex-grow to take remaining space */}
                <div className="flex flex-col flex-1 min-w-0">
                    <Card className="flex-1 flex flex-col h-full"> {/* Ensure card fills the container */}
                        <CardHeader className="flex-shrink-0 pb-3"> {/* Prevent header from shrinking */}
                            <CardTitle>
                                <div className="flex items-center">
                                    <DatabaseIcon className="h-5 w-5 mr-2"/>
                                    DB Chat Interface
                                </div>
                            </CardTitle>
                            <CardDescription>
                                Questions are processed in real-time using the database.
                            </CardDescription>
                        </CardHeader>
                        {/* Chat history scrollable area - Use flex-grow and min-height */}
                        <CardContent className="flex-1 p-0 overflow-hidden"> {/* Allow content to scroll */}
                            <ClientOnly fallback={
                                <div className="h-full px-4 pt-2 flex items-center justify-center"> {/* Use h-full */}
                                    <div className="animate-pulse">Loading chat interface...</div>
                                </div>
                            }>
                                {() => (
                                    // Ensure ScrollArea takes full height of its container
                                    <ScrollArea className="h-full px-4 pt-2">
                                        {chatHistory.length === 0 ? (
                                            // Make sure the empty state message container takes full height too
                                            <div
                                                className="flex items-center justify-center h-full text-muted-foreground text-center px-8">
                                                <div className="max-w-md"> {/* Limit width of text */}
                                                    <MessageSquare className="h-8 w-8 mx-auto mb-2"/>
                                                    <p>Ask questions about the school&apos;s database, like &quot;How
                                                        much sales tax was collected in Q1?&quot;</p>
                                                </div>
                                            </div>
                                        ) : (
                                            <div className="space-y-4 pb-4">
                                                {chatHistory.map((entry, index) => (
                                                    <div key={index}>
                                                        {entry.type === 'query' ? (
                                                            <div className="flex justify-end mb-4">
                                                                {/* Use green background for user query */}
                                                                <div
                                                                    className="bg-green-600 text-white dark:bg-green-700 dark:text-green-50 rounded-lg py-2 px-3 max-w-[80%]">
                                                                    <p>{entry.content}</p> {/* Content is guaranteed for query type */}
                                                                </div>
                                                            </div>
                                                        ) : entry.type === 'thinking' ? (
                                                            // Render Thinking Indicator
                                                            <div className="flex justify-start mb-4">
                                                                {/* Use muted background, similar to response, but simpler content */}
                                                                <div className="bg-muted dark:bg-gray-700 rounded-lg py-3 px-4 max-w-[90%] w-auto inline-flex items-center">
                                                                    <div className="flex items-center space-x-2 text-sm text-muted-foreground">
                                                                        {/* Simple spinner */}
                                                                        <div className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent"></div>
                                                                        {/* Informative text */}
                                                                        <span>Thinking... (this might take a moment the first time)</span>
                                                                    </div>
                                                                </div>
                                                            </div>
                                                        ) : ( // This case handles entry.type === 'response'
                                                            <div className="flex justify-start mb-4">
                                                                <div
                                                                    className="bg-muted dark:bg-gray-700 rounded-lg py-3 px-4 max-w-[90%] w-full"> {/* Use dark background */}
                                                                    {/* Display the original question */}
                                                                    {entry.originalQuery && (
                                                                        <div
                                                                            className="mb-3 pb-2 border-b border-border dark:border-gray-600">
                                                                            <p className="text-sm font-medium text-muted-foreground dark:text-gray-400">Your
                                                                                Question:</p>
                                                                            <p className="text-sm">{entry.originalQuery}</p>
                                                                        </div>
                                                                    )}
                                                                    {/* Removed the redundant entry.content paragraph */}

                                                                    {entry.error ? (
                                                                        <Alert variant="destructive" className="mt-2">
                                                                            <AlertTitle>Error Processing
                                                                                Query</AlertTitle>
                                                                            <AlertDescription>
                                                                                {entry.error || "An unexpected error occurred."}
                                                                                {/* Optionally show the failed SQL if available */}
                                                                                {entry.sql && (
                                                                                    <pre
                                                                                        className="mt-2 text-xs bg-red-100/50 dark:bg-red-900/30 p-2 rounded overflow-x-auto border border-red-200 dark:border-red-800">
                                            Failed SQL: {entry.sql}
                                        </pre>
                                                                                )}
                                                                            </AlertDescription>
                                                                        </Alert>
                                                                    ) : (entry.summary || entry.data !== undefined) ? ( // Render if we have summary OR data is not undefined
                                                                        <div className="mt-4 space-y-4">
                                                                            {/* Render summary and data table, providing null if data is undefined */}
                                                                            {renderQueryResults(entry.summary, entry.data ?? null)}

                                                                            {/* Display SQL and execution time */}
                                                                            {entry.sql && (
                                                                                <div
                                                                                    className="mt-4 pt-3 border-t border-border">
                                                                                    <details className="text-xs">
                                                                                        <summary
                                                                                            className="cursor-pointer text-muted-foreground hover:text-foreground">
                                                                                            View SQL Query & Execution
                                                                                            Time
                                                                                        </summary>
                                                                                        <pre
                                                                                            className="mt-1 text-xs bg-muted/50 p-2 rounded overflow-x-auto border">
                                        {entry.sql}
                                      </pre>
                                                                                        <p className="text-xs text-muted-foreground mt-1">
                                                                                            Executed
                                                                                            in {entry.executionTime?.toFixed(2)}s
                                                                                        </p>
                                                                                    </details>
                                                                                    {/* Close the details element */}
                                                                                </div>
                                                                            )}
                                                                        </div>
                                                                    ) : null}
                                                                </div>
                                                            </div>
                                                        )}
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </ScrollArea>
                                )}
                            </ClientOnly>
                        </CardContent>
                        {/* Input area - Prevent footer from shrinking */}
                        <CardFooter className="flex-shrink-0 pt-4 border-t"> {/* Added border */}
                            {/* Assign ref to the form and handle submission */}
                            <Form
                                ref={formRef}
                                method="post"
                                action="/admin/db-chat"
                                className="w-full space-y-2"
                                onSubmit={() => {
                                    // Add the query to history optimistically just before submission
                                    // Do NOT prevent default, let Remix handle the fetch submission
                                    addQueryToHistory(question);
                                }}
                            >
                                <div className="flex items-start space-x-2">
                                    <Textarea
                                        ref={textareaRef} // Assign ref to textarea
                                        name="query" // Still needed for form data
                                        value={question}
                                        onChange={(e) => setQuestion(e.target.value)}
                                        onKeyDown={(e) => {
                                            // Submit on Enter press without Shift
                                            if (e.key === 'Enter' && !e.shiftKey && !isSubmitting && question.trim() !== "") {
                                                e.preventDefault(); // Prevent newline
                                                // Trigger the form submission, which will call onSubmit
                                                formRef.current?.requestSubmit();
                                            }
                                        }}
                                        placeholder="Type your database question here..."
                                        className={cn("input-custom-styles", "flex-1 min-h-[60px] max-h-[150px]")} // Applied custom style and merged classes
                                        rows={2} // Start with 2 rows
                                    />
                                    <Button
                                        type="submit" // Keep as submit to trigger form action
                                        size="icon"
                                        className="h-[60px] w-[60px] flex-shrink-0" // Prevent button shrinking
                                        disabled={isSubmitting || question.trim() === ""}
                                        // No onClick needed, type="submit" triggers the Form's onSubmit
                                    >
                                        {isSubmitting ? (
                                            <div
                                                className="h-5 w-5 animate-spin rounded-full border-2 border-current border-t-transparent"/>
                                        ) : (
                                            <SendHorizontal className="h-5 w-5"/>
                                        )}
                                    </Button>
                                </div>
                            </Form>
                        </CardFooter>
                    </Card>
                </div>
            </div>
        </div>
    );
}
