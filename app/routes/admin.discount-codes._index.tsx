import { json, type LoaderFunctionArgs } from '@remix-run/node';
import { useLoaderData, Link, Form } from '@remix-run/react';
import { getSupabaseServerClient } from '~/utils/supabase.server';
import { DiscountService } from '~/services/discount.server';
import type { DiscountCodeWithUsage } from '~/types/discount';
import { Button } from '~/components/ui/button';
import { Badge } from '~/components/ui/badge';
import { Card, CardContent } from '~/components/ui/card';
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



export default function AdminDiscountCodes() {
  const { discountCodes } = useLoaderData<typeof loader>() as {
    discountCodes: DiscountCodeWithUsage[];
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
                              <Form method="post" className="inline">
                                <input type="hidden" name="intent" value="deactivate" />
                                <input type="hidden" name="id" value={code.id} />
                                <Button
                                  type="submit"
                                  variant="outline"
                                  size="sm"
                                  className="text-yellow-600 hover:text-yellow-700"
                                  onClick={(e) => {
                                    if (!confirm('Are you sure you want to deactivate this discount code?')) {
                                      e.preventDefault();
                                    }
                                  }}
                                >
                                  Deactivate
                                </Button>
                              </Form>
                            ) : (
                              <Form method="post" className="inline">
                                <input type="hidden" name="intent" value="delete" />
                                <input type="hidden" name="id" value={code.id} />
                                <Button
                                  type="submit"
                                  variant="destructive"
                                  size="sm"
                                  onClick={(e) => {
                                    if (!confirm('Are you sure you want to permanently delete this discount code?')) {
                                      e.preventDefault();
                                    }
                                  }}
                                >
                                  Delete
                                </Button>
                              </Form>
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
    </div>
  );
}
