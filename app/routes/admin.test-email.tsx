import { json, type ActionFunctionArgs, type LoaderFunctionArgs } from "@remix-run/node";
import { Form, useActionData, useNavigation } from "@remix-run/react";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "~/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "~/components/ui/alert";
import { getSupabaseServerClient, getSupabaseAdminClient } from "~/utils/supabase.server";
import { requireAdmin } from "~/utils/auth.server";
import { AuthenticityTokenInput } from "remix-utils/csrf/react";
import { csrf } from "~/utils/csrf.server";

type ActionData = {
  success?: boolean;
  error?: string;
  results?: {
    userFound: boolean;
    userId?: string;
    emailConfirmed?: boolean;
    createdAt?: string;
    lastSignIn?: string;
    emailSentSuccess?: boolean;
    diagnosis?: string;
    suggestions?: string[];
    timestamp?: string;
  };
};

export async function loader({ request }: LoaderFunctionArgs) {
  await requireAdmin(request);
  return json({});
}

export async function action({ request }: ActionFunctionArgs) {
  await requireAdmin(request);

  try {
    await csrf.validate(request);
  } catch (error) {
    return json<ActionData>({ error: "CSRF validation failed" }, { status: 403 });
  }

  const formData = await request.formData();
  const action = formData.get("action") as string;
  const testEmail = formData.get("testEmail") as string;

  if (!testEmail) {
    return json<ActionData>({ error: "Email is required" }, { status: 400 });
  }

  const { supabaseServer } = getSupabaseServerClient(request);
  const supabaseAdmin = getSupabaseAdminClient();

  try {
    if (action === "test-existing") {
      // Test with existing user
      const { data: { users }, error: listError } = await supabaseAdmin.auth.admin.listUsers();

      if (listError) {
        return json<ActionData>({
          error: `Failed to list users: ${listError.message}`
        }, { status: 500 });
      }

      const user = users.find(u => u.email === testEmail);

      if (!user) {
        return json<ActionData>({
          success: false,
          results: {
            userFound: false,
            timestamp: new Date().toISOString()
          }
        });
      }

      // Try to resend confirmation
      const { data, error } = await supabaseServer.auth.resend({
        type: 'signup',
        email: testEmail,
        options: {
          emailRedirectTo: `${new URL(request.url).origin}/auth/callback`
        }
      });

      let diagnosis = "Unknown";
      let suggestions: string[] = [];

      if (error) {
        if (error.message?.includes('rate limit')) {
          diagnosis = "RATE LIMIT HIT - Email sending rate limit exceeded";
          suggestions = [
            "Default Supabase email service has strict limits (2-4 emails/hour)",
            "Configure custom SMTP (Resend) in Supabase Dashboard",
            "Go to Auth → Email → SMTP Settings"
          ];
        } else if (error.message?.includes('Email rate limit exceeded')) {
          diagnosis = "EMAIL RATE LIMIT EXCEEDED";
          suggestions = [
            "Too many confirmation emails sent recently",
            "Wait ~1 hour or configure custom SMTP"
          ];
        } else if (error.message?.includes('not found') || error.status === 404) {
          diagnosis = "USER NOT FOUND OR EMAIL ALREADY CONFIRMED";
          suggestions = ["User may have already confirmed their email"];
        } else if (error.message?.includes('Email sending is disabled')) {
          diagnosis = "EMAIL SENDING DISABLED";
          suggestions = ["Check Supabase Dashboard → Auth → Email settings"];
        } else {
          diagnosis = `Error: ${error.message}`;
          suggestions = ["Check Supabase Dashboard logs for more details"];
        }

        return json<ActionData>({
          success: false,
          results: {
            userFound: true,
            userId: user.id,
            emailConfirmed: !!user.email_confirmed_at,
            createdAt: user.created_at,
            lastSignIn: user.last_sign_in_at || "Never",
            emailSentSuccess: false,
            diagnosis,
            suggestions,
            timestamp: new Date().toISOString()
          }
        });
      }

      return json<ActionData>({
        success: true,
        results: {
          userFound: true,
          userId: user.id,
          emailConfirmed: !!user.email_confirmed_at,
          createdAt: user.created_at,
          lastSignIn: user.last_sign_in_at || "Never",
          emailSentSuccess: true,
          diagnosis: "Email confirmation request accepted by Supabase",
          suggestions: [
            "Check user's inbox (including spam folder)",
            "Check Supabase Dashboard → Logs for 'mail.sent' event",
            "If no email arrives within 5 minutes, SMTP may not be configured"
          ],
          timestamp: new Date().toISOString()
        }
      });

    } else if (action === "test-new") {
      // Test with new user registration
      const timestamp = Date.now();
      const newTestEmail = `test-${timestamp}@mailinator.com`;
      const testPassword = 'TestPassword123!';

      const { data, error } = await supabaseServer.auth.signUp({
        email: newTestEmail,
        password: testPassword,
        options: {
          emailRedirectTo: `${new URL(request.url).origin}/auth/callback`,
          data: {
            receive_marketing_emails: false
          }
        }
      });

      let diagnosis = "Unknown";
      let suggestions: string[] = [];

      if (error) {
        if (error.message?.includes('rate limit')) {
          diagnosis = "RATE LIMIT HIT DURING SIGNUP";
          suggestions = [
            "Email sending rate limit exceeded",
            "Default: 2-4 emails/hour without custom SMTP",
            "Solution: Configure Resend SMTP in Supabase Dashboard"
          ];
        } else if (error.message?.includes('email') && error.message?.includes('sending')) {
          diagnosis = "EMAIL SENDING FAILURE";
          suggestions = [
            "Supabase cannot send confirmation email",
            "SMTP may not be configured"
          ];
        } else {
          diagnosis = `Signup Error: ${error.message}`;
          suggestions = ["Check error message for details"];
        }

        return json<ActionData>({
          success: false,
          results: {
            userFound: false,
            emailSentSuccess: false,
            diagnosis,
            suggestions,
            timestamp: new Date().toISOString()
          }
        });
      }

      // Wait 2 seconds
      await new Promise(resolve => setTimeout(resolve, 2000));

      // Check if user was created
      const { data: { users }, error: listError } = await supabaseAdmin.auth.admin.listUsers();
      const createdUser = users?.find(u => u.email === newTestEmail);

      // Cleanup
      if (data.user?.id) {
        await supabaseAdmin.auth.admin.deleteUser(data.user.id);
      }

      const emailConfirmed = !!data.user?.email_confirmed_at;

      if (emailConfirmed) {
        diagnosis = "Email auto-confirmed (confirmations disabled in Supabase)";
        suggestions = ["Email confirmations are turned OFF in Supabase settings"];
      } else {
        diagnosis = "Registration successful, email confirmation required";
        suggestions = [
          "Check Supabase Dashboard → Logs",
          `Filter by timestamp: ${new Date().toISOString()}`,
          "Look for 'user_confirmation_requested' AND 'mail.sent'",
          "If you see 'user_confirmation_requested' but NO 'mail.sent': Emails are NOT being sent"
        ];
      }

      return json<ActionData>({
        success: true,
        results: {
          userFound: !!createdUser,
          userId: data.user?.id,
          emailConfirmed,
          createdAt: data.user?.created_at,
          emailSentSuccess: true,
          diagnosis,
          suggestions,
          timestamp: new Date().toISOString()
        }
      });
    }

    return json<ActionData>({ error: "Invalid action" }, { status: 400 });

  } catch (error) {
    console.error("Test email error:", error);
    return json<ActionData>({
      error: error instanceof Error ? error.message : "Unknown error"
    }, { status: 500 });
  }
}

export default function TestEmailPage() {
  const actionData = useActionData<ActionData>();
  const navigation = useNavigation();
  const isSubmitting = navigation.state === "submitting";

  return (
    <div className="container mx-auto py-8 px-4">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-3xl font-bold mb-2">Email Confirmation Testing</h1>
        <p className="text-muted-foreground mb-8">
          Test if registration confirmation emails are being sent properly
        </p>

        <div className="grid gap-6 md:grid-cols-2">
          {/* Test Existing User */}
          <Card>
            <CardHeader>
              <CardTitle>Test Existing User</CardTitle>
              <CardDescription>
                Resend confirmation email to an existing user
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Form method="post" className="space-y-4">
                <AuthenticityTokenInput />
                <input type="hidden" name="action" value="test-existing" />

                <div className="space-y-2">
                  <Label htmlFor="testEmail">Email Address</Label>
                  <Input
                    id="testEmail"
                    name="testEmail"
                    type="email"
                    placeholder="user@example.com"
                    required
                  />
                </div>

                <Button type="submit" disabled={isSubmitting} className="w-full">
                  {isSubmitting ? "Testing..." : "Test Existing User"}
                </Button>
              </Form>
            </CardContent>
          </Card>

          {/* Test New Registration */}
          <Card>
            <CardHeader>
              <CardTitle>Test New Registration</CardTitle>
              <CardDescription>
                Create a test user to check registration email flow
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Form method="post" className="space-y-4">
                <AuthenticityTokenInput />
                <input type="hidden" name="action" value="test-new" />
                <input type="hidden" name="testEmail" value="ignored" />

                <Alert>
                  <AlertDescription>
                    This will create and immediately delete a test user at mailinator.com
                  </AlertDescription>
                </Alert>

                <Button type="submit" disabled={isSubmitting} className="w-full">
                  {isSubmitting ? "Testing..." : "Run New Registration Test"}
                </Button>
              </Form>
            </CardContent>
          </Card>
        </div>

        {/* Results */}
        {actionData && (
          <Card className="mt-6">
            <CardHeader>
              <CardTitle>Test Results</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {actionData.error && (
                <Alert variant="destructive">
                  <AlertTitle>Error</AlertTitle>
                  <AlertDescription>{actionData.error}</AlertDescription>
                </Alert>
              )}

              {actionData.results && (
                <div className="space-y-4">
                  {/* User Info */}
                  <div className="p-4 border rounded-lg space-y-2">
                    <h3 className="font-semibold">User Status</h3>
                    <div className="grid grid-cols-2 gap-2 text-sm">
                      <div>
                        <span className="text-muted-foreground">User Found:</span>
                        <span className={`ml-2 font-medium ${actionData.results.userFound ? 'text-green-600' : 'text-red-600'}`}>
                          {actionData.results.userFound ? '✅ Yes' : '❌ No'}
                        </span>
                      </div>
                      {actionData.results.userId && (
                        <div>
                          <span className="text-muted-foreground">User ID:</span>
                          <span className="ml-2 font-mono text-xs">{actionData.results.userId}</span>
                        </div>
                      )}
                      {actionData.results.emailConfirmed !== undefined && (
                        <div>
                          <span className="text-muted-foreground">Email Confirmed:</span>
                          <span className={`ml-2 font-medium ${actionData.results.emailConfirmed ? 'text-green-600' : 'text-orange-600'}`}>
                            {actionData.results.emailConfirmed ? '✅ Yes' : '⏳ Pending'}
                          </span>
                        </div>
                      )}
                      {actionData.results.createdAt && (
                        <div>
                          <span className="text-muted-foreground">Created:</span>
                          <span className="ml-2 text-xs">{new Date(actionData.results.createdAt).toLocaleString()}</span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Diagnosis */}
                  <Alert variant={actionData.results.emailSentSuccess ? "default" : "destructive"}>
                    <AlertTitle>
                      {actionData.results.emailSentSuccess ? '✅ Email Request Accepted' : '❌ Email Issue Detected'}
                    </AlertTitle>
                    <AlertDescription>
                      <p className="font-medium mb-2">{actionData.results.diagnosis}</p>
                      {actionData.results.suggestions && actionData.results.suggestions.length > 0 && (
                        <ul className="list-disc list-inside space-y-1 text-sm mt-2">
                          {actionData.results.suggestions.map((suggestion, index) => (
                            <li key={index}>{suggestion}</li>
                          ))}
                        </ul>
                      )}
                    </AlertDescription>
                  </Alert>

                  {/* Timestamp */}
                  {actionData.results.timestamp && (
                    <div className="text-xs text-muted-foreground">
                      Test performed at: {new Date(actionData.results.timestamp).toLocaleString()}
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Instructions */}
        <Card className="mt-6">
          <CardHeader>
            <CardTitle>How to Check Supabase Logs</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <ol className="list-decimal list-inside space-y-2">
              <li>Go to <strong>Supabase Dashboard</strong> → Your Project → <strong>Logs</strong> → <strong>Auth Logs</strong></li>
              <li>Filter by recent timestamp (last 5 minutes)</li>
              <li>Look for two specific log entries:
                <ul className="list-disc list-inside ml-6 mt-1">
                  <li><code className="text-xs bg-muted px-1 py-0.5 rounded">user_confirmation_requested</code> - Confirmation was requested</li>
                  <li><code className="text-xs bg-muted px-1 py-0.5 rounded">mail.sent</code> - Email was actually sent</li>
                </ul>
              </li>
              <li className="font-semibold text-orange-600">
                If you see "user_confirmation_requested" but NO "mail.sent": Emails are NOT being sent
              </li>
            </ol>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
