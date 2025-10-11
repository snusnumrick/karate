import { json, type LoaderFunctionArgs } from "@remix-run/node";
import { Form, useLoaderData } from "@remix-run/react";
import { Button } from "~/components/ui/button";
import { Alert, AlertDescription, AlertTitle } from "~/components/ui/alert";
import * as Sentry from "@sentry/remix";

export async function loader({ request }: LoaderFunctionArgs) {
  const url = new URL(request.url);
  const testType = url.searchParams.get("test");

  // Server-side test errors
  if (testType === "server-error") {
    console.error("[Sentry Test] Server-side console.error test");
    throw new Error("Test Server Error - This should appear in Sentry!");
  }

  if (testType === "server-explicit") {
    const testError = new Error("Test Explicit Capture - Server");
    console.error("[Sentry Test] Explicit server-side capture");

    Sentry.captureException(testError, {
      tags: {
        test: "server-explicit",
        location: "test-page"
      },
      level: "error",
      contexts: {
        testContext: {
          message: "This is a test error from the server",
          timestamp: new Date().toISOString()
        }
      }
    });

    return json({
      message: "Server explicit error captured! Check Sentry dashboard.",
      testType
    });
  }

  if (testType === "server-console") {
    console.error("[Sentry Test] This console.error should be captured by Sentry console integration");
    return json({
      message: "Server console.error logged! Check server terminal and Sentry dashboard.",
      testType
    });
  }

  return json({ message: null, testType: null });
}

export default function SentryTestPage() {
  const { message } = useLoaderData<typeof loader>();

  const triggerClientError = () => {
    console.error("[Sentry Test] Client-side console.error test");
    throw new Error("Test Client Error - This should appear in Sentry!");
  };

  const triggerClientExplicit = () => {
    const testError = new Error("Test Explicit Capture - Client");
    console.error("[Sentry Test] Explicit client-side capture");

    Sentry.captureException(testError, {
      tags: {
        test: "client-explicit",
        location: "test-page"
      },
      level: "warning",
      contexts: {
        testContext: {
          message: "This is a test error from the client",
          timestamp: new Date().toISOString()
        }
      }
    });

    alert("Client explicit error captured! Check Sentry dashboard.");
  };

  const triggerClientConsole = () => {
    console.error("[Sentry Test] Client console.error - should be captured by Sentry console integration");
    alert("Client console.error logged! Check browser console and Sentry dashboard in 1-2 minutes.");
  };

  return (
    <div className="max-w-4xl mx-auto p-8">
      <h1 className="text-3xl font-bold mb-6">Sentry Integration Test Page</h1>

      {message && (
        <Alert className="mb-6">
          <AlertTitle>Test Result</AlertTitle>
          <AlertDescription>{message}</AlertDescription>
        </Alert>
      )}

      <div className="space-y-6">
        {/* Instructions */}
        <Alert>
          <AlertTitle>Testing Instructions</AlertTitle>
          <AlertDescription className="space-y-2 mt-2">
            <p>1. Click a test button below</p>
            <p>2. Wait 1-2 minutes for Sentry to process the error</p>
            <p>3. Go to your Sentry dashboard: <a href="https://sentry.io" target="_blank" rel="noopener noreferrer" className="text-blue-600 underline">sentry.io</a></p>
            <p>4. Check for the test error with tag: <code className="bg-gray-100 px-1 rounded">test:*</code></p>
          </AlertDescription>
        </Alert>

        {/* Server-side tests */}
        <div className="border rounded-lg p-6">
          <h2 className="text-xl font-semibold mb-4">Server-Side Error Tests</h2>
          <p className="text-sm text-gray-600 mb-4">These errors are captured on the server and sent to Sentry</p>

          <div className="space-y-3">
            <Form method="get" className="inline-block">
              <input type="hidden" name="test" value="server-console" />
              <Button type="submit" variant="outline">
                Test Server console.error()
              </Button>
            </Form>
            <p className="text-sm text-gray-500 ml-4 inline-block">
              Tests automatic console integration (server) - likely won&apos;t appear in Sentry
            </p>
          </div>

          <div className="space-y-3 mt-3">
            <Form method="get" className="inline-block">
              <input type="hidden" name="test" value="server-explicit" />
              <Button type="submit" variant="outline">
                Test Server Explicit Capture
              </Button>
            </Form>
            <p className="text-sm text-gray-500 ml-4 inline-block">
              Tests Sentry.captureException() with custom tags (server)
            </p>
          </div>

          <div className="space-y-3 mt-3">
            <Form method="get" className="inline-block">
              <input type="hidden" name="test" value="server-error" />
              <Button type="submit" variant="destructive">
                Test Server Thrown Error
              </Button>
            </Form>
            <p className="text-sm text-gray-500 ml-4 inline-block">
              Tests unhandled exception catching (server)
            </p>
          </div>
        </div>

        {/* Client-side tests */}
        <div className="border rounded-lg p-6">
          <h2 className="text-xl font-semibold mb-4">Client-Side Error Tests</h2>
          <p className="text-sm text-gray-600 mb-4">These errors are captured in the browser and sent to Sentry</p>

          <div className="space-y-3">
            <Button onClick={triggerClientConsole} variant="outline">
              Test Client console.error()
            </Button>
            <p className="text-sm text-gray-500 ml-4 inline-block">
              Tests automatic console integration (client)
            </p>
          </div>

          <div className="space-y-3 mt-3">
            <Button onClick={triggerClientExplicit} variant="outline">
              Test Client Explicit Capture
            </Button>
            <p className="text-sm text-gray-500 ml-4 inline-block">
              Tests Sentry.captureException() with custom tags (client)
            </p>
          </div>

          <div className="space-y-3 mt-3">
            <Button onClick={triggerClientError} variant="destructive">
              Test Client Thrown Error
            </Button>
            <p className="text-sm text-gray-500 ml-4 inline-block">
              Tests ErrorBoundary catching (client)
            </p>
          </div>
        </div>

        {/* What to look for */}
        <Alert>
          <AlertTitle>What to Look For in Sentry Dashboard</AlertTitle>
          <AlertDescription className="space-y-2 mt-2">
            <p><strong>Console Integration Tests:</strong></p>
            <ul className="list-disc ml-6 space-y-1">
              <li>Error message starts with &quot;[Sentry Test]&quot;</li>
              <li>Captured automatically (no explicit captureException call needed)</li>
            </ul>

            <p className="mt-3"><strong>Explicit Capture Tests:</strong></p>
            <ul className="list-disc ml-6 space-y-1">
              <li>Custom tags: <code className="bg-gray-100 px-1 rounded">test:client-explicit</code> or <code className="bg-gray-100 px-1 rounded">test:server-explicit</code></li>
              <li>Custom context with timestamp</li>
              <li>Level: error or warning</li>
            </ul>

            <p className="mt-3"><strong>Thrown Error Tests:</strong></p>
            <ul className="list-disc ml-6 space-y-1">
              <li>Full stack trace</li>
              <li>Shows the exact line where error was thrown</li>
            </ul>
          </AlertDescription>
        </Alert>

        {/* Search instructions */}
        <Alert>
          <AlertTitle>How to Find Test Errors in Sentry</AlertTitle>
          <AlertDescription className="space-y-2 mt-2">
            <p>In your Sentry dashboard, use the search bar:</p>
            <ul className="list-disc ml-6 space-y-1">
              <li><code className="bg-gray-100 px-1 rounded">tags.test:*</code> - Show all test errors</li>
              <li><code className="bg-gray-100 px-1 rounded">tags.test:client-explicit</code> - Client explicit capture</li>
              <li><code className="bg-gray-100 px-1 rounded">tags.test:server-explicit</code> - Server explicit capture</li>
              <li><code className="bg-gray-100 px-1 rounded">message:&quot;Sentry Test&quot;</code> - All test messages</li>
            </ul>
          </AlertDescription>
        </Alert>

        {/* Cleanup */}
        <Alert variant="destructive">
          <AlertTitle>⚠️ Clean Up After Testing</AlertTitle>
          <AlertDescription>
            <p>After verifying Sentry works:</p>
            <ol className="list-decimal ml-6 mt-2 space-y-1">
              <li>Delete this test file: <code className="bg-gray-100 px-1 rounded">app/routes/test.sentry.tsx</code></li>
              <li>Or make it admin-only by adding authentication check</li>
              <li>Mark test errors as &quot;Resolved&quot; in Sentry dashboard</li>
            </ol>
          </AlertDescription>
        </Alert>
      </div>
    </div>
  );
}

export function ErrorBoundary() {
  return (
    <div className="max-w-4xl mx-auto p-8">
      <Alert variant="destructive">
        <AlertTitle>✅ Success! ErrorBoundary Caught the Error</AlertTitle>
        <AlertDescription className="space-y-2">
          <p>This means:</p>
          <ul className="list-disc ml-6 mt-2">
            <li>React ErrorBoundary is working</li>
            <li>The error was automatically sent to Sentry</li>
            <li>Check your Sentry dashboard to see it!</li>
          </ul>
          <p className="mt-4">
            <a href="/test/sentry" className="text-blue-600 underline">
              ← Back to Test Page
            </a>
          </p>
        </AlertDescription>
      </Alert>
    </div>
  );
}
