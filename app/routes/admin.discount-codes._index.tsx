import { json, type LoaderFunctionArgs, type ActionFunctionArgs, redirect } from '@remix-run/node';
import { useLoaderData, Link, Form } from '@remix-run/react';
import { useState } from 'react';
import { getSupabaseServerClient } from '~/utils/supabase.server';
import { DiscountService } from '~/services/discount.server';
import type { DiscountCodeWithUsage } from '~/types/discount';
import { Button } from '~/components/ui/button';
import { Badge } from '~/components/ui/badge';
import { Card, CardContent } from '~/components/ui/card';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '~/components/ui/alert-dialog';
import { Plus } from 'lucide-react';
import { formatCurrency, formatDate } from '~/utils/misc';

export async function loader({ request }: LoaderFunctionArgs) {
  const { supabaseServer } = getSupabaseServerClient(request);
  
  // Check if user is admin
  const { data: { user } } = await supabaseServer.auth.getUser();
  if (!user) {
    throw new Response('Unauthorized', { status: 401 });
  }

  // Check admin status
  const { data: profile } = await supabaseServer
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single();

  if (profile?.role !== 'admin') {
    throw new Response('Forbidden', { status: 403 });
  }

  // Fetch discount codes
  const discountCodes = await DiscountService.getAllDiscountCodes();

  return json({
    discountCodes
  });
}

export async function action({ request }: ActionFunctionArgs) {
  const { supabaseServer } = getSupabaseServerClient(request);
  
  // Check if user is admin
  const { data: { user } } = await supabaseServer.auth.getUser();
  if (!user) {
    throw new Response('Unauthorized', { status: 401 });
  }

  // Check admin status
  const { data: profile } = await supabaseServer
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single();

  if (profile?.role !== 'admin') {
    throw new Response('Forbidden', { status: 403 });
  }

  const formData = await request.formData();
  const intent = formData.get('intent') as string;
  const id = formData.get('id') as string;

  if (!id) {
    throw new Response('Missing discount code ID', { status: 400 });
  }

  try {
    switch (intent) {
      case 'deactivate':
        await DiscountService.deactivateDiscountCode(id);
        break;
      case 'activate':
        await DiscountService.activateDiscountCode(id);
        break;
      case 'delete': {
        // For delete, we'll use the supabase client directly since there's no delete method in DiscountService
        const { error } = await supabaseServer
          .from('discount_codes')
          .delete()
          .eq('id', id);
        
        if (error) {
          throw new Error(`Failed to delete discount code: ${error.message}`);
        }
        break;
      }
      default:
        throw new Response('Invalid intent', { status: 400 });
    }

    return redirect('/admin/discount-codes');
  } catch (error) {
    console.error('Error processing discount code action:', error);
    throw new Response('Failed to process action', { status: 500 });
  }
}



export default function AdminDiscountCodes() {
  const { discountCodes } = useLoaderData<typeof loader>() as {
    discountCodes: DiscountCodeWithUsage[];
  };

  const [dialogState, setDialogState] = useState<{
    isOpen: boolean;
    action: 'deactivate' | 'activate' | 'delete' | null;
    codeId: string | null;
    codeName: string | null;
  }>({ isOpen: false, action: null, codeId: null, codeName: null });

  const openDialog = (action: 'deactivate' | 'activate' | 'delete', codeId: string, codeName: string) => {
    setDialogState({ isOpen: true, action, codeId, codeName });
  };

  const closeDialog = () => {
    setDialogState({ isOpen: false, action: null, codeId: null, codeName: null });
  };

  const getDialogContent = () => {
    switch (dialogState.action) {
      case 'deactivate':
        return {
          title: 'Deactivate Discount Code',
          description: `Are you sure you want to deactivate the discount code "${dialogState.codeName}"? It will no longer be available for use.`,
          actionText: 'Deactivate',
          actionVariant: 'default' as const
        };
      case 'activate':
        return {
          title: 'Activate Discount Code',
          description: `Are you sure you want to activate the discount code "${dialogState.codeName}"? It will become available for use.`,
          actionText: 'Activate',
          actionVariant: 'default' as const
        };
      case 'delete':
        return {
          title: 'Delete Discount Code',
          description: `Are you sure you want to permanently delete the discount code "${dialogState.codeName}"? This action cannot be undone.`,
          actionText: 'Delete',
          actionVariant: 'destructive' as const
        };
      default:
        return {
          title: '',
          description: '',
          actionText: '',
          actionVariant: 'default' as const
        };
    }
  };



  return (
    <div className="container mx-auto px-4 py-8 max-w-6xl">
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-foreground mb-2">Discount Codes</h1>
        <p className="text-muted-foreground">Manage discount codes for families and students.</p>
      </div>
      
      <div className="flex justify-between items-center mb-6">
        <div></div>
        <Button asChild>
           <Link to="/admin/discount-codes/new">
             <Plus className="mr-2 h-4 w-4" />
             Create New Code
           </Link>
         </Button>
      </div>

      {/* Discount Codes Section */}
      <section>
        <h2 className="text-xl font-semibold text-foreground mb-4 pb-2 border-b border-border">Existing Discount Codes</h2>
        <p className="text-sm text-muted-foreground mb-4">Manage and view all discount codes for your organization.</p>
        
        <Card>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full border-collapse">
                <thead>
                  <tr className="border-b border-border bg-muted/50">
                    <th className="text-left p-4 font-semibold text-foreground">Code</th>
                    <th className="text-left p-4 font-semibold text-foreground">Name</th>
                    <th className="text-left p-4 font-semibold text-foreground">Discount</th>
                    <th className="text-left p-4 font-semibold text-foreground">Associated With</th>
                    <th className="text-left p-4 font-semibold text-foreground">Usage</th>
                    <th className="text-left p-4 font-semibold text-foreground">Status</th>
                    <th className="text-left p-4 font-semibold text-foreground">Valid Until</th>
                    <th className="text-left p-4 font-semibold text-foreground">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {discountCodes.map((code) => {
                    const isExpired = code.valid_until && new Date() > new Date(code.valid_until);
                    const status = isExpired ? 'expired' : code.is_active ? 'active' : 'inactive';
                    
                    return (
                      <tr key={code.id} className="border-b border-border hover:bg-muted/30 transition-colors">
                        <td className="p-4">
                          <div className="text-sm font-mono font-medium">{code.code}</div>
                          {code.created_automatically && (
                            <div className="text-xs text-blue-600 dark:text-blue-400">Auto-generated</div>
                          )}
                        </td>
                        <td className="p-4">
                          <div className="text-sm font-medium">{code.name}</div>
                          {code.description && (
                            <div className="text-xs text-muted-foreground">{code.description}</div>
                          )}
                        </td>
                        <td className="p-4">
                          <div className="text-sm font-medium">
                            {code.discount_type === 'fixed_amount'
                              ? formatCurrency(code.discount_value * 100)
                              : `${code.discount_value}%`}
                          </div>
                          <div className="text-xs text-muted-foreground">
                            {Array.isArray(code.applicable_to) 
                              ? code.applicable_to.map(type => type.replace('_', ' ')).join(', ')
                              : code.applicable_to} • {code.scope.replace('_', ' ')}
                          </div>
                        </td>
                        <td className="p-4">
                          <div className="text-sm">
                            {code.scope === 'per_family' && code.families ? (
                              <div>
                                <div className="font-medium">{code.families.family_name}</div>
                                <div className="text-xs text-muted-foreground">Family</div>
                              </div>
                            ) : code.scope === 'per_student' && code.students ? (
                              <div>
                                <div className="font-medium">{code.students.first_name} {code.students.last_name}</div>
                                <div className="text-xs text-muted-foreground">Student</div>
                              </div>
                            ) : (
                              <div className="text-xs text-muted-foreground">No association</div>
                            )}
                          </div>
                        </td>
                        <td className="p-4">
                          <div className="text-sm">
                            {code.current_uses}
                            {code.max_uses ? ` / ${code.max_uses}` : ' / ∞'}
                          </div>
                          <div className="text-xs text-muted-foreground">{code.usage_type.replace('_', ' ')}</div>
                        </td>
                        <td className="p-4">
                          <Badge 
                            variant={status === 'active' ? 'default' : status === 'expired' ? 'destructive' : 'secondary'}
                          >
                            {status === 'expired' ? 'Expired' : status === 'active' ? 'Active' : 'Inactive'}
                          </Badge>
                        </td>
                        <td className="p-4 text-sm">
                          {code.valid_until ? formatDate(code.valid_until) : 'No expiry'}
                        </td>
                        <td className="p-4">
                          <div className="flex gap-2">
                            <Button
                              variant="outline"
                              size="sm"
                              asChild
                            >
                              <Link to={`/admin/discount-codes/${code.id}/edit`}>
                                Edit
                              </Link>
                            </Button>
                            {code.is_active ? (
                              <Button
                                variant="outline"
                                size="sm"
                                className="text-yellow-600 hover:text-yellow-700"
                                onClick={() => openDialog('deactivate', code.id, code.name)}
                              >
                                Deactivate
                              </Button>
                            ) : (
                              <>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  className="text-green-600 hover:text-green-700"
                                  onClick={() => openDialog('activate', code.id, code.name)}
                                >
                                  Activate
                                </Button>
                                <Button
                                  variant="destructive"
                                  size="sm"
                                  onClick={() => openDialog('delete', code.id, code.name)}
                                >
                                  Delete
                                </Button>
                              </>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            {discountCodes.length === 0 && (
              <div className="p-8 text-center text-muted-foreground">
                <p>No discount codes found.</p>
                <p className="text-sm mt-1">Create your first discount code to get started.</p>
              </div>
            )}
          </CardContent>
        </Card>
      </section>

      {/* Confirmation Dialog */}
      <AlertDialog open={dialogState.isOpen} onOpenChange={closeDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{getDialogContent().title}</AlertDialogTitle>
            <AlertDialogDescription>
              {getDialogContent().description}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={closeDialog}>Cancel</AlertDialogCancel>
            <Form method="post" className="inline">
              <input type="hidden" name="intent" value={dialogState.action || ''} />
              <input type="hidden" name="id" value={dialogState.codeId || ''} />
              <AlertDialogAction
                type="submit"
                onClick={closeDialog}
                className={getDialogContent().actionVariant === 'destructive' ? 'bg-destructive text-destructive-foreground hover:bg-destructive/90' : ''}
              >
                {getDialogContent().actionText}
              </AlertDialogAction>
            </Form>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
