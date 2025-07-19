import type { ActionFunctionArgs, LoaderFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import { Form, useActionData, useNavigation, Link } from "@remix-run/react";
import { requireAdminUser } from "~/utils/auth.server";
import { batchProcessExistingData } from "~/utils/auto-discount-events.server";
import { AutoDiscountService } from "~/services/auto-discount.server";
import { Button } from "~/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "~/components/ui/card";
import { Alert, AlertDescription } from "~/components/ui/alert";
import { Input } from "~/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "~/components/ui/select";
import { ArrowLeft, Play, TestTube, BookOpen, AlertTriangle } from "lucide-react";
import { AppBreadcrumb, breadcrumbPatterns } from "~/components/AppBreadcrumb";




export async function loader({ request }: LoaderFunctionArgs) {
  await requireAdminUser(request);
  return json({});
}

export async function action({ request }: ActionFunctionArgs) {
  await requireAdminUser(request);
  
  const formData = await request.formData();
  const intent = formData.get("intent") as string;

  try {
    if (intent === "batch_process") {
      await batchProcessExistingData();
      return json({ success: true, message: "Batch processing completed successfully" });
    } else if (intent === "test_student_enrollment") {
      const studentId = formData.get("student_id") as string;
      const familyId = formData.get("family_id") as string;
      
      if (!studentId || !familyId) {
        return json({ success: false, message: "Student ID and Family ID are required" });
      }

      await AutoDiscountService.recordStudentEnrollment(studentId, familyId);
      
      return json({ success: true, message: `Student enrollment event recorded for student ${studentId}` });
    } else if (intent === "test_first_payment") {
      const familyId = formData.get("family_id") as string;
      const amount = formData.get("amount") as string;
      
      if (!familyId || !amount) {
        return json({ success: false, message: "Family ID and amount are required" });
      }

      await AutoDiscountService.recordFirstPayment(familyId, parseFloat(amount));
      
      return json({ success: true, message: `First payment event recorded for family ${familyId}` });
    } else if (intent === "test_belt_promotion") {
      const studentId = formData.get("student_id") as string;
      const familyId = formData.get("family_id") as string;
      const beltRank = formData.get("belt_rank") as string;
      
      if (!studentId || !familyId || !beltRank) {
        return json({ success: false, message: "Student ID, Family ID, and belt rank are required" });
      }

      await AutoDiscountService.recordBeltPromotion(studentId, familyId, beltRank);
      
      return json({ success: true, message: `Belt promotion event recorded for student ${studentId} - ${beltRank}` });
    } else if (intent === "test_attendance_milestone") {
      const studentId = formData.get("student_id") as string;
      const familyId = formData.get("family_id") as string;
      const attendanceCount = formData.get("attendance_count") as string;
      
      if (!studentId || !familyId || !attendanceCount) {
        return json({ success: false, message: "Student ID, Family ID, and attendance count are required" });
      }

      await AutoDiscountService.recordAttendanceMilestone(studentId, familyId, parseInt(attendanceCount));
      
      return json({ success: true, message: `Attendance milestone event recorded for student ${studentId} - ${attendanceCount} classes` });
    }

    return json({ success: false, message: "Invalid intent" });
  } catch (error) {
    console.error('Error in utilities action:', error);
    return json({ success: false, message: `Error: ${error instanceof Error ? error.message : 'Unknown error'}` });
  }
}

export default function AutoDiscountUtilities() {
  const actionData = useActionData<typeof action>();
  const navigation = useNavigation();
  const isSubmitting = navigation.state === "submitting";

  return (
    <div className="space-y-6">
      <AppBreadcrumb items={breadcrumbPatterns.adminAutomaticDiscountUtilities()} className="mb-6" />
      
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Automatic Discount Utilities</h1>
          <p className="text-gray-600 dark:text-gray-400">Tools for testing and managing automatic discount events</p>
        </div>
        <Button variant="outline" asChild>
          <Link to="/admin/automatic-discounts">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Rules
          </Link>
        </Button>
      </div>

      {/* Action Result */}
      {actionData && (
        <Alert variant={actionData.success ? "default" : "destructive"}>
          <AlertDescription>
            {actionData.message}
          </AlertDescription>
        </Alert>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Batch Processing */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Play className="h-5 w-5" />
              Batch Processing
            </CardTitle>
            <CardDescription>
              Process existing students and payments to create historical events. This is useful for initial setup.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Form method="post">
              <input type="hidden" name="intent" value="batch_process" />
              <Button
                type="submit"
                disabled={isSubmitting}
                className="w-full"
                tabIndex={0}
              >
                {isSubmitting ? "Processing..." : "Run Batch Processing"}
              </Button>
            </Form>
            
            <Alert variant="warning">
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>
                <strong>Warning:</strong> This will create events for all existing students and families. 
                Only run this once during initial setup.
              </AlertDescription>
            </Alert>
          </CardContent>
        </Card>

        {/* Test Events */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TestTube className="h-5 w-5" />
              Test Events
            </CardTitle>
            <CardDescription>
              Manually trigger events for testing automation rules.
            </CardDescription>
          </CardHeader>
          <CardContent>
          
          <div className="space-y-4">
            {/* Student Enrollment Test */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm">Student Enrollment</CardTitle>
              </CardHeader>
              <CardContent>
                <Form method="post" className="space-y-3">
                  <input type="hidden" name="intent" value="test_student_enrollment" />
                  <div className="grid grid-cols-2 gap-2">
                    <Input
                      type="text"
                      name="student_id"
                      placeholder="Student ID"
                      required
                      className="text-xs"
                      tabIndex={1}
                    />
                    <Input
                      type="text"
                      name="family_id"
                      placeholder="Family ID"
                      required
                      className="text-xs"
                      tabIndex={2}
                    />
                  </div>
                  <Button
                    type="submit"
                    disabled={isSubmitting}
                    size="sm"
                    className="w-full"
                    variant="default"
                    tabIndex={3}
                  >
                    Test Enrollment
                  </Button>
                </Form>
              </CardContent>
            </Card>

            {/* First Payment Test */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm">First Payment</CardTitle>
              </CardHeader>
              <CardContent>
                <Form method="post" className="space-y-3">
                  <input type="hidden" name="intent" value="test_first_payment" />
                  <div className="grid grid-cols-2 gap-2">
                    <Input
                      type="text"
                      name="family_id"
                      placeholder="Family ID"
                      required
                      className="text-xs"
                      tabIndex={4}
                    />
                    <Input
                      type="number"
                      name="amount"
                      placeholder="Amount"
                      step="0.01"
                      required
                      className="text-xs"
                      tabIndex={5}
                    />
                  </div>
                  <Button
                    type="submit"
                    disabled={isSubmitting}
                    size="sm"
                    className="w-full bg-green-600 hover:bg-green-700"
                    tabIndex={6}
                  >
                    Test First Payment
                  </Button>
                </Form>
              </CardContent>
            </Card>

            {/* Belt Promotion Test */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm">Belt Promotion</CardTitle>
              </CardHeader>
              <CardContent>
                <Form method="post" className="space-y-3">
                  <input type="hidden" name="intent" value="test_belt_promotion" />
                  <div className="grid grid-cols-2 gap-2">
                    <Input
                      type="text"
                      name="student_id"
                      placeholder="Student ID"
                      required
                      className="text-xs"
                      tabIndex={7}
                    />
                    <Input
                      type="text"
                      name="family_id"
                      placeholder="Family ID"
                      required
                      className="text-xs"
                      tabIndex={8}
                    />
                  </div>
                  <Select name="belt_rank" required>
                    <SelectTrigger className="input-custom-styles text-xs" tabIndex={9}>
                    <SelectValue placeholder="Select belt rank" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="white">White Belt</SelectItem>
                      <SelectItem value="yellow">Yellow Belt</SelectItem>
                      <SelectItem value="orange">Orange Belt</SelectItem>
                      <SelectItem value="green">Green Belt</SelectItem>
                      <SelectItem value="blue">Blue Belt</SelectItem>
                      <SelectItem value="purple">Purple Belt</SelectItem>
                      <SelectItem value="brown">Brown Belt</SelectItem>
                      <SelectItem value="black">Black Belt</SelectItem>
                    </SelectContent>
                  </Select>
                  <Button
                    type="submit"
                    disabled={isSubmitting}
                    size="sm"
                    className="w-full bg-purple-600 hover:bg-purple-700"
                    tabIndex={10}
                  >
                    Test Belt Promotion
                  </Button>
                </Form>
              </CardContent>
            </Card>

            {/* Attendance Milestone Test */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm">Attendance Milestone</CardTitle>
              </CardHeader>
              <CardContent>
                <Form method="post" className="space-y-3">
                  <input type="hidden" name="intent" value="test_attendance_milestone" />
                  <div className="grid grid-cols-3 gap-2">
                    <Input
                      type="text"
                      name="student_id"
                      placeholder="Student ID"
                      required
                      className="text-xs"
                      tabIndex={11}
                    />
                    <Input
                      type="text"
                      name="family_id"
                      placeholder="Family ID"
                      required
                      className="text-xs"
                      tabIndex={12}
                    />
                    <Input
                      type="number"
                      name="attendance_count"
                      placeholder="Count"
                      min="1"
                      required
                      className="text-xs"
                      tabIndex={13}
                    />
                  </div>
                  <Button
                    type="submit"
                    disabled={isSubmitting}
                    size="sm"
                    className="w-full bg-orange-600 hover:bg-orange-700"
                    tabIndex={14}
                  >
                    Test Attendance Milestone
                  </Button>
                </Form>
              </CardContent>
            </Card>
          </div>
          </CardContent>
        </Card>
      </div>

      {/* Documentation */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BookOpen className="h-5 w-5" />
            Integration Guide
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-muted-foreground">
            To integrate automatic discount events into your existing application flows, 
            import and call the appropriate functions from <code className="bg-muted px-1 rounded text-sm">~/utils/auto-discount-events.server</code>:
          </p>
          
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm">Example Integration Points:</CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="text-sm text-muted-foreground space-y-2">
                <li>• <strong>Student Registration:</strong> Call <code className="bg-muted px-1 rounded text-xs">recordStudentEnrollmentEvent()</code></li>
                <li>• <strong>Payment Processing:</strong> Call <code className="bg-muted px-1 rounded text-xs">recordFirstPaymentEvent()</code></li>
                <li>• <strong>Belt Promotions:</strong> Call <code className="bg-muted px-1 rounded text-xs">recordBeltPromotionEvent()</code></li>
                <li>• <strong>Attendance Tracking:</strong> Call <code className="bg-muted px-1 rounded text-xs">recordAttendanceMilestoneEvent()</code></li>
                <li>• <strong>Referral System:</strong> Call <code className="bg-muted px-1 rounded text-xs">recordFamilyReferralEvent()</code></li>
              </ul>
            </CardContent>
          </Card>
          
          <p className="text-muted-foreground text-sm">
            These functions are designed to be non-blocking and will not interfere with your main business logic 
            if discount assignment fails.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}