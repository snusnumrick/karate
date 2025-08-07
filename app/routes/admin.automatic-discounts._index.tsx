import { json, type LoaderFunctionArgs, type ActionFunctionArgs, redirect } from "@remix-run/node";
import { useLoaderData, Link, useNavigation, useSubmit } from "@remix-run/react";
import { Button } from "~/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import { AdminCard, AdminCardContent, AdminCardDescription, AdminCardHeader, AdminCardTitle } from "~/components/AdminCard";
import { Badge } from "~/components/ui/badge";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "~/components/ui/alert-dialog";
import { Plus, Edit, Trash2, Zap, Calendar, Target } from "lucide-react";
import { AutoDiscountService } from "~/services/auto-discount.server";
import { requireAdminUser } from "~/utils/auth.server";
import { formatDistanceToNow } from "date-fns";
import { useState } from "react";
import { AppBreadcrumb, breadcrumbPatterns } from "~/components/AppBreadcrumb";
// Type definitions for assignment data with joins
type AssignmentWithJoins = {
  id: string;
  assigned_at: string;
  families?: { name?: string } | null;
  students?: { first_name?: string; last_name?: string } | null;
  discount_codes?: {
    code?: string;
    name?: string;
    discount_type?: string;
    discount_value?: number;
  } | null;
};

export async function loader({ request }: LoaderFunctionArgs) {
  await requireAdminUser(request);
  
  try {
    const automationRules = await AutoDiscountService.getAutomationRules();
    const assignments = await AutoDiscountService.getDiscountAssignments();
    
    return json({ automationRules, assignments });
  } catch (error) {
    console.error('Error loading automatic discounts:', error);
    throw new Response('Failed to load automatic discounts', { status: 500 });
  }
}

export async function action({ request }: ActionFunctionArgs) {
  await requireAdminUser(request);
  
  const formData = await request.formData();
  const intent = formData.get('intent');
  const ruleId = formData.get('ruleId');
  
  if (intent === 'delete' && ruleId) {
    try {
      await AutoDiscountService.deleteAutomationRule(ruleId.toString());
      return redirect('/admin/automatic-discounts');
    } catch (error) {
      console.error('Error deleting automation rule:', error);
      throw new Response('Failed to delete automation rule', { status: 500 });
    }
  }
  
  return json({ success: false });
}

export default function AutomaticDiscountsIndex() {
  const { automationRules, assignments } = useLoaderData<typeof loader>();
  const navigation = useNavigation();
  const submit = useSubmit();
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const isSubmitting = navigation.state === 'submitting';

  return (
    <div className="container mx-auto px-4 py-8">
      <AppBreadcrumb items={breadcrumbPatterns.adminAutomaticDiscounts()} className="mb-6" />
      
      {/* Header */}
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Automatic Discounts</h1>
          <p className="text-muted-foreground">
            Manage automation rules and view discount assignments
          </p>
        </div>
        <div className="flex space-x-3">
            <Link to="/admin/automatic-discounts/assignments">
              <Button variant="outline">
                View Assignments
              </Button>
            </Link>
            <Link to="/admin/automatic-discounts/utilities">
              <Button variant="outline">
                Utilities
              </Button>
            </Link>
            <Link to="/admin/automatic-discounts/new">
              <Button>
                <Plus className="h-4 w-4 mr-2" />
                New Automation Rule
              </Button>
            </Link>
          </div>
      </div>

      <div className="space-y-6">

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card className="form-card-styles">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Rules</CardTitle>
            <Zap className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {automationRules.filter(rule => rule.is_active).length}
            </div>
            <p className="text-xs text-muted-foreground">
              of {automationRules.length} total rules
            </p>
          </CardContent>
        </Card>
        
        <Card className="form-card-styles">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Assignments</CardTitle>
            <Target className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{assignments.length}</div>
            <p className="text-xs text-muted-foreground">
              discounts automatically assigned
            </p>
          </CardContent>
        </Card>
        
        <Card className="form-card-styles">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Recent Assignments</CardTitle>
            <Calendar className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {assignments.filter(a => {
                const assignedDate = new Date(a.assigned_at);
                const weekAgo = new Date();
                weekAgo.setDate(weekAgo.getDate() - 7);
                return assignedDate > weekAgo;
              }).length}
            </div>
            <p className="text-xs text-muted-foreground">
              in the last 7 days
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Automation Rules */}
      <AdminCard>
        <AdminCardHeader>
          <AdminCardTitle>Automation Rules</AdminCardTitle>
          <AdminCardDescription>
            Rules that automatically assign discounts when specific events occur
          </AdminCardDescription>
        </AdminCardHeader>
        <AdminCardContent>
          {automationRules.length === 0 ? (
            <div className="text-center py-8">
              <Zap className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-medium mb-2">No automation rules yet</h3>
              <p className="text-muted-foreground mb-4">
                Create your first automation rule to start automatically assigning discounts
              </p>
              <Link to="/admin/automatic-discounts/new">
                <Button>
                  <Plus className="h-4 w-4 mr-2" />
                  Create First Rule
                </Button>
              </Link>
            </div>
          ) : (
            <div className="space-y-4">
              {automationRules.map((rule) => (
                <div
                  key={rule.id}
                  className="flex items-center justify-between p-4 border dark:border-gray-700 rounded-lg"
                >
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="font-medium">{rule.name}</h3>
                      <Badge variant={rule.is_active ? "default" : "secondary"}>
                        {rule.is_active ? "Active" : "Inactive"}
                      </Badge>
                    </div>
                    <p className="text-sm text-muted-foreground mb-2">
                      Event: <span className="font-medium">{rule.event_type.replace('_', ' ')}</span>
                    </p>
                    <div className="flex items-center gap-4 text-xs text-muted-foreground">
                      <span>Created {formatDistanceToNow(new Date(rule.created_at))} ago</span>
                      {rule.valid_until && (
                        <span>Expires {formatDistanceToNow(new Date(rule.valid_until))} from now</span>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Link to={`/admin/automatic-discounts/${rule.id}`}>
                      <Button variant="outline" size="sm">
                        <Edit className="h-4 w-4" />
                      </Button>
                    </Link>
                    <Button 
                      variant="outline" 
                      size="sm" 
                      className="text-red-600 hover:text-red-700"
                      onClick={() => setDeleteConfirmId(rule.id)}
                      disabled={isSubmitting}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </AdminCardContent>
      </AdminCard>

      {/* Recent Assignments */}
      <AdminCard>
        <AdminCardHeader>
          <AdminCardTitle>Recent Assignments</AdminCardTitle>
          <AdminCardDescription>
            Latest automatic discount assignments
          </AdminCardDescription>
        </AdminCardHeader>
        <AdminCardContent>
          {assignments.length === 0 ? (
            <div className="text-center py-8">
              <Target className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-medium mb-2">No assignments yet</h3>
              <p className="text-muted-foreground">
                Discounts will appear here when automation rules are triggered
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {assignments.slice(0, 10).map((assignment) => (
                <div
                  key={assignment.id}
                  className="flex items-center justify-between p-4 border dark:border-gray-700 rounded-lg"
                >
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <h4 className="font-medium">
                        {(assignment as AssignmentWithJoins).families?.name || `${(assignment as AssignmentWithJoins).students?.first_name} ${(assignment as AssignmentWithJoins).students?.last_name}`}
                      </h4>
                      <Badge variant="outline">
                        {(assignment as AssignmentWithJoins).discount_codes?.code}
                      </Badge>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      Assigned {formatDistanceToNow(new Date(assignment.assigned_at))} ago
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="font-medium">
                      {(assignment as AssignmentWithJoins).discount_codes?.discount_type === 'percentage' ?
                  `${(assignment as AssignmentWithJoins).discount_codes?.discount_value}%` :
                  `$${(assignment as AssignmentWithJoins).discount_codes?.discount_value}`} off
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {(assignment as AssignmentWithJoins).discount_codes?.name}
                    </p>
                  </div>
                </div>
              ))}
              {assignments.length > 10 && (
                <div className="text-center pt-4">
                  <Link to="/admin/automatic-discounts/assignments">
                    <Button variant="outline">View All Assignments</Button>
                  </Link>
                </div>
              )}
            </div>
          )}
        </AdminCardContent>
      </AdminCard>

      </div>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={!!deleteConfirmId} onOpenChange={(open) => !open && setDeleteConfirmId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. This will permanently delete the automation rule
              {deleteConfirmId && (
                <span className="font-semibold">
                  {' '}{automationRules.find(rule => rule.id === deleteConfirmId)?.name}
                </span>
              )}
              {' '}and remove all associated data.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isSubmitting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (deleteConfirmId) {
                  const formData = new FormData();
                  formData.append('intent', 'delete');
                  formData.append('ruleId', deleteConfirmId);
                  submit(formData, { method: 'post', replace: true });
                }
              }}
              disabled={isSubmitting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isSubmitting ? 'Deleting...' : 'Delete Rule'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}