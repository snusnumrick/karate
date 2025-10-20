import { json, redirect, type LoaderFunctionArgs, type ActionFunctionArgs } from '@remix-run/node';
import { Form, useLoaderData, Link } from '@remix-run/react';
import { getSupabaseServerClient } from '~/utils/supabase.server';
import { Button } from '~/components/ui/button';
import { Input } from '~/components/ui/input';
import { Label } from '~/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '~/components/ui/select';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '~/components/ui/card';
import { Alert, AlertDescription } from '~/components/ui/alert';
import { AlertCircle } from 'lucide-react';
import { siteConfig } from '~/config/site';
import { safeRedirect } from '~/utils/redirect';

type MissingField = 'address' | 'city' | 'province';

export async function loader({ request }: LoaderFunctionArgs) {
  const { supabaseServer } = getSupabaseServerClient(request);
  const { data: { user } } = await supabaseServer.auth.getUser();

  if (!user) {
    const url = new URL(request.url);
    const redirectTo = url.searchParams.get('redirectTo');
    throw redirect(`/login?redirectTo=${encodeURIComponent(redirectTo || '/family')}`);
  }

  // Get user's family profile
  const { data: profile } = await supabaseServer
    .from('profiles')
    .select('family_id')
    .eq('id', user.id)
    .single();

  if (!profile?.family_id) {
    throw new Response('Family profile not found', { status: 404 });
  }

  // Get family data
  const { data: family } = await supabaseServer
    .from('families')
    .select('address, city, province, postal_code')
    .eq('id', profile.family_id)
    .single();

  if (!family) {
    throw new Response('Family not found', { status: 404 });
  }

  // Determine which fields are missing
  const missingFields: MissingField[] = [];
  if (!family.address) missingFields.push('address');
  if (!family.city) missingFields.push('city');
  if (!family.province) missingFields.push('province');

  // If profile is complete, redirect to the intended destination
  const url = new URL(request.url);
  const redirectTo = url.searchParams.get('redirectTo') || '/family';

  if (missingFields.length === 0) {
    throw redirect(safeRedirect(redirectTo, '/family'));
  }

  return json({
    familyId: profile.family_id,
    missingFields,
    redirectTo,
    currentData: {
      address: family.address,
      city: family.city,
      province: family.province,
      postalCode: family.postal_code
    }
  });
}

export async function action({ request }: ActionFunctionArgs) {
  const { supabaseServer } = getSupabaseServerClient(request);
  const { data: { user } } = await supabaseServer.auth.getUser();

  if (!user) {
    return json({ error: 'Not authenticated' }, { status: 401 });
  }

  const formData = await request.formData();
  const redirectTo = formData.get('redirectTo') as string;

  // Get user's family ID
  const { data: profile } = await supabaseServer
    .from('profiles')
    .select('family_id')
    .eq('id', user.id)
    .single();

  if (!profile?.family_id) {
    return json({ error: 'Family profile not found' }, { status: 404 });
  }

  // Validate required fields
  const address = formData.get('address') as string;
  const city = formData.get('city') as string;
  const province = formData.get('province') as string;

  const errors: Record<string, string> = {};
  if (!address?.trim()) errors.address = 'Address is required';
  if (!city?.trim()) errors.city = 'City is required';
  if (!province) errors.province = 'Province is required';

  if (Object.keys(errors).length > 0) {
    return json({ errors }, { status: 400 });
  }

  // Update family record
  const { error } = await supabaseServer
    .from('families')
    .update({
      address: address.trim(),
      city: city.trim(),
      province: province
    })
    .eq('id', profile.family_id);

  if (error) {
    console.error('Error updating family profile:', error);
    return json({ error: 'Failed to update profile' }, { status: 500 });
  }

  // Redirect to the original destination
  return redirect(safeRedirect(redirectTo, '/family'));
}

export default function CompleteProfile() {
  const { missingFields, redirectTo, currentData } = useLoaderData<typeof loader>();

  return (
    <div className="min-h-screen page-background-styles py-12">
      <div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-12">
          <h1 className="text-3xl font-extrabold text-gray-900 dark:text-white sm:text-4xl">
            Complete Your Profile
          </h1>
          <p className="mt-3 text-xl text-gray-500 dark:text-gray-400">
            We need a few more details before you can enroll in classes
          </p>
        </div>

        <Alert className="mb-6">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            To enroll in classes, we need your complete address for emergency contact and administrative purposes.
            This information was not required for event registration.
          </AlertDescription>
        </Alert>

        <Card className="form-container-styles">
          <CardHeader>
            <CardTitle>Missing Information</CardTitle>
            <CardDescription>
              Please fill in the following details to complete your profile
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Form method="post" className="space-y-6">
              <input type="hidden" name="redirectTo" value={redirectTo} />

              <div className="space-y-4">
                {missingFields.includes('address') && (
                  <div>
                    <Label htmlFor="address">
                      Home Address <span className="text-red-500">*</span>
                    </Label>
                    <Input
                      type="text"
                      id="address"
                      name="address"
                      required
                      className="input-custom-styles"
                      defaultValue={currentData.address || ''}
                    />
                  </div>
                )}

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {missingFields.includes('city') && (
                    <div>
                      <Label htmlFor="city">
                        City <span className="text-red-500">*</span>
                      </Label>
                      <Input
                        type="text"
                        id="city"
                        name="city"
                        required
                        className="input-custom-styles"
                        defaultValue={currentData.city || ''}
                      />
                    </div>
                  )}

                  {missingFields.includes('province') && (
                    <div>
                      <Label htmlFor="province">
                        Province <span className="text-red-500">*</span>
                      </Label>
                      <Select name="province" required defaultValue={currentData.province || undefined}>
                        <SelectTrigger id="province" className="input-custom-styles">
                          <SelectValue placeholder="Select province" />
                        </SelectTrigger>
                        <SelectContent>
                          {siteConfig.provinces.map((prov) => (
                            <SelectItem key={prov.value} value={prov.value}>
                              {prov.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  )}
                </div>

                {!missingFields.includes('address') && !missingFields.includes('city') && !missingFields.includes('province') && (
                  <Alert>
                    <AlertDescription>
                      Your profile is complete! Click continue to proceed.
                    </AlertDescription>
                  </Alert>
                )}
              </div>

              <div className="flex gap-4">
                <Button type="submit" className="flex-1">
                  Save & Continue
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => window.history.back()}
                >
                  Cancel
                </Button>
              </div>
            </Form>
          </CardContent>
        </Card>

        <div className="mt-6 text-center text-sm text-gray-600 dark:text-gray-400">
          <p>
            Need help? <Link to="/contact" className="text-green-600 hover:underline">Contact us</Link>
          </p>
        </div>
      </div>
    </div>
  );
}
