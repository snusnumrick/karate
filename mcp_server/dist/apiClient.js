"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.apiClient = apiClient;
const config_1 = __importDefault(require("./config"));
/**
 * Makes a request to the Karate Class API.
 * Handles JSON request/response and basic error handling.
 *
 * @param endpoint The API endpoint path (e.g., '/api/v1/auth/register').
 * @param options Request options including method, body, headers, token.
 * @returns The JSON response from the API.
 * @throws {Error} Throws an error if the request fails or returns a non-OK status.
 */
// Use unknown as the default type for T, forcing callers to specify expected type
async function apiClient(endpoint, options = {}) {
    const { method = 'GET', body, authToken } = options;
    const url = `${config_1.default.karateApiBaseUrl}${endpoint}`;
    const headers = {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        ...options.headers, // Allow overriding default headers
    };
    if (authToken) {
        headers['Authorization'] = `Bearer ${authToken}`;
    }
    console.error(`[API Client] Requesting: ${method} ${url}`); // Ensure this uses console.error
    if (body) {
        console.error(`[API Client] Body: ${JSON.stringify(body)}`); // Ensure this uses console.error
    }
    try {
        const response = await fetch(url, {
            method: method,
            headers: headers,
            body: body ? JSON.stringify(body) : undefined,
        });
        console.error(`[API Client] Response Status: ${response.status} ${response.statusText}`); // Ensure this uses console.error
        // Attempt to parse JSON regardless of status code, as errors might be JSON
        let responseBody;
        try {
            responseBody = await response.json();
            console.error(`[API Client] Response Body: ${JSON.stringify(responseBody)}`); // Ensure this uses console.error
        }
        catch {
            // If JSON parsing fails, read as text (for non-JSON errors)
            const textBody = await response.text();
            console.error(`[API Client] Response Body (non-JSON): ${textBody}`); // Ensure this uses console.error
            // If status was OK but JSON failed, that's unexpected
            if (response.ok) {
                throw new Error(`API request succeeded (${response.status}) but failed to parse JSON response.`);
            }
            // If status was not OK and JSON failed, throw error with text body
            throw new Error(`API request failed with status ${response.status}: ${textBody || response.statusText}`);
        }
        if (!response.ok) {
            // If response was not OK but JSON parsing succeeded, use the error from the body if available
            let errorMessage = `API request failed with status ${response.status}`;
            // Type guard to safely access the error property
            if (typeof responseBody === 'object' && responseBody !== null && 'error' in responseBody && typeof responseBody.error === 'string') {
                errorMessage = responseBody.error;
            }
            throw new Error(errorMessage);
        }
        return responseBody;
    }
    catch (error) {
        console.error(`[API Client] Network or processing error for ${method} ${url}:`, error);
        // Re-throw the error to be handled by the caller
        throw error;
    }
}
//# sourceMappingURL=apiClient.js.map