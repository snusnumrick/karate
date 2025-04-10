# MCP Server for Karate Class Application

This server acts as a bridge between the Karate Class application's API and the Model Context Protocol (MCP). It exposes functionalities of the Karate Class application as MCP tools and resources, allowing MCP clients (like AI models or other tools) to interact with the application data in a standardized way.

## Setup

1.  **Navigate to Directory:**
    ```bash
    cd mcp_server
    ```
2.  **Install Dependencies:**
    ```bash
    npm install
    ```
3.  **Configure Environment:**
    - Copy the example environment file:
      ```bash
      cp .env.example .env
      ```
    - Edit the `.env` file and set `KARATE_API_BASE_URL` to the URL where your main Karate Class Remix application is running (e.g., `http://localhost:5173` for local development).

## Running the Server

Ensure the main Karate Class Remix application is running first. Then, start the MCP server in development mode:

```bash
npm run dev
```

The server will connect using the `StdioServerTransport`, meaning it listens for MCP messages on standard input (stdin) and sends responses to standard output (stdout).

## Exposed MCP Tools

Currently, the following MCP tool is exposed:

### `registerUser`

-   **Description:** Registers a new user account, family, and guardian in the Karate Class application by calling its internal API (`/api/v1/auth/register`).
-   **Arguments:** (Matches the full web registration form)
    -   `email` (string, required, email format): User's login email.
    -   `password` (string, required, min 8 chars): User's login password.
    -   `marketingEmails` (boolean, optional): Consent to receive marketing emails (defaults to `false`).
    -   `familyName` (string, required): Family last name.
    -   `address` (string, required): Street address.
    -   `city` (string, required): City.
    -   `province` (string, required): Province/State code.
    -   `postalCode` (string, required): Postal/Zip code.
    -   `primaryPhone` (string, required): Main family phone number.
    -   `referralSource` (string, optional): How they heard about the class.
    -   `referralName` (string, optional): Name of the referrer.
    -   `emergencyContact` (string, optional): Emergency contact details (name/phone).
    -   `healthInfo` (string, optional): Family health number or related info.
    -   `guardian1FirstName` (string, required): Guardian 1 first name.
    -   `guardian1LastName` (string, required): Guardian 1 last name.
    -   `guardian1Relationship` (string, required): Guardian 1 relationship (defaults to 'Parent/Guardian').
    -   `guardian1HomePhone` (string, required): Guardian 1 home phone.
    -   `guardian1WorkPhone` (string, optional): Guardian 1 work phone.
    -   `guardian1CellPhone` (string, required): Guardian 1 cell phone.
    -   `guardian1Employer` (string, optional): Guardian 1 employer name.
    -   `guardian1EmployerPhone` (string, optional): Guardian 1 employer phone.
    -   `guardian1EmployerNotes` (string, optional): Guardian 1 employer notes.
    // Guardian 2 and Students removed from arguments
-   **Returns:** A text message indicating success (including user and family IDs) or failure, potentially including specific error details.

## Interacting with the Server

Since the server uses the stdio transport, you need an MCP client capable of communicating over stdin/stdout.

-   **MCP Inspector:** The [MCP Inspector](https://github.com/modelcontextprotocol/inspector) is a useful tool for testing and debugging MCP servers. You can configure it to run this server script and send `callTool` requests.
-   **Custom Client:** You can write your own MCP client using the `@modelcontextprotocol/sdk` client library (see the SDK documentation for examples).

**Example Interaction (Conceptual):**

An MCP client would send a JSON message like this to the server's stdin:

```json
{
  "mcp": "1.0",
  "type": "request",
  "id": "req-123",
  "method": "callTool",
  "params": {
    "name": "registerUser",
    "arguments": {
      "email": "test.parent@example.com",
      "password": "password1234",
      "marketingEmails": true,
      "familyName": "TestFamily",
      "address": "123 Dojo Lane",
      "city": "Karateville",
      "province": "BC",
      "postalCode": "V1V 1V1",
      "primaryPhone": "555-100-1000",
      "guardian1FirstName": "Test",
      "guardian1LastName": "ParentOne",
      "guardian1Relationship": "Mother",
      "guardian1HomePhone": "555-100-1001",
      "guardian1CellPhone": "555-100-1002"
      // students array removed
    }
  }
}
```

The server would process this, call the Karate app API, and send a response JSON message back via stdout, for example:

```json
{
  "mcp": "1.0",
  "type": "response",
  "id": "req-123",
  "result": {
    "content": [
      {
        "type": "text",
        "text": "Registration successful: Registration successful. Please check your email to confirm your account. (User ID: ..., Family ID: ...)"
      }
    ]
  }
}
```

## Integrating with AI Models (e.g., Claude)

This MCP server currently uses the `StdioServerTransport`, meaning it communicates over standard input (stdin) and standard output (stdout). AI models like Anthropic's Claude cannot directly configure or run local scripts via stdio.

To enable an AI model like Claude to use the tools exposed by this server (e.g., `registerUser`), you need an **intermediary application layer** that acts as an MCP client:

1.  **Your Application Code:** The application that interacts with the Claude API (e.g., your main backend, a dedicated service) needs to be responsible for managing the MCP server process.
2.  **Start MCP Server Subprocess:** Your application code should start the MCP server script (`node dist/server.js` or `ts-node src/server.ts`) as a child process.
3.  **MCP Client Implementation:** Your application code needs to use an MCP client library (like `@modelcontextprotocol/sdk`'s client components) with an `StdioClientTransport`. This transport will be configured to communicate with the stdin and stdout streams of the child process started in step 2.
4.  **Claude Tool Use:** When Claude indicates (via its API response) that it wants to use a tool (e.g., `registerUser`), your application code intercepts this.
5.  **Proxy Request:** Your application code (acting as the MCP client) sends the corresponding `callTool` request (with the arguments provided by Claude) to the MCP server subprocess via its stdin, using the `StdioClientTransport`.
6.  **Receive Response:** Your application code reads the MCP response message from the MCP server subprocess's stdout.
7.  **Return to Claude:** Your application code formats the result from the MCP response and sends it back to the Claude API to fulfill the tool use request.

**In summary:** You don't configure Claude *directly* with this stdio-based server. Instead, your application code acts as the bridge, running the MCP server locally and managing the communication between the AI model and the MCP server using the MCP SDK's client transport.

*(Note: If the MCP server were configured to use an HTTP/SSE transport instead of stdio, direct interaction from certain AI platforms might be possible via HTTP requests, depending on their specific tool integration capabilities.)*

### Usage with Claude Desktop (Example)

To configure the Claude Desktop application to launch and communicate with this MCP server, add an entry to your `claude_desktop_config.json` file under the `mcpServers` key. This tells Claude Desktop how to start the server process using its stdio transport.

Assuming your `claude_desktop_config.json` resides at the root of your Karate Class project directory:

```json
{
  "mcpServers": {
    "karate": {
      "command": "npm",
      "args": [
        "run",
        "start",
        "--prefix",
        "mcp_server"
      ]
      // "cwd": "/path/to/your/karate/project/root" // Optional: Specify if needed
    }
    // ... other servers
  }
}
```

**Explanation:**

*   `"karate"`: This is the name you give the server within Claude Desktop.
*   `"command": "npm"`: Specifies that `npm` should be used to launch the server.
*   `"args": [...]`: Provides the arguments to `npm`.
    *   `"run", "start"`: Tells npm to execute the `start` script defined in `mcp_server/package.json`. This script runs the compiled JavaScript version (`node dist/server.js`).
    *   `"--prefix", "mcp_server"`: Tells npm to run the script from the `mcp_server` subdirectory.
*   `"cwd"` (Optional): If Claude Desktop doesn't automatically run the command from the directory containing the config file, you might need to specify the absolute path to your project's root directory here.

**Important:** This configuration assumes:
1.  You have run `npm install --prefix mcp_server` to install dependencies.
2.  You have run `npm run build --prefix mcp_server` to compile the TypeScript code to JavaScript (`dist/server.js`).
3.  The MCP server process launched by Claude Desktop can access the necessary environment variables (specifically `KARATE_API_BASE_URL`), either through a `.env` file in the `mcp_server` directory or system-wide environment variables.
