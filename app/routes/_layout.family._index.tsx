import { json, type LoaderFunctionArgs } from "@remix-run/node";
import { useLoaderData } from "@remix-run/react";
import { getSupabaseServerClient } from "~/utils/supabase.server";
import { Button } from "~/components/ui/button"; // Example import
import { Link } from "@remix-run/react"; // Example import

// Placeholder loader - will need to fetch actual family data later
export async function loader({ request }: LoaderFunctionArgs) {
  const { supabaseServer, headers } = getSupabaseServerClient(request);
  const { data: { user } } = await supabaseServer.auth.getUser();

  if (!user) {
    // This shouldn't happen if the route is protected by the layout,
    // but good practice to handle it.
    // Consider redirecting to login if needed, depending on layout setup.
    return json({ profile: null, family: null, error: "User not authenticated" }, { status: 401, headers });
  }

  // 1. Get the user's profile to find their family_id
  const { data: profileData, error: profileError } = await supabaseServer
    .from('profiles')
    .select('family_id') // Only fetch family_id, as names are not on this table
    .eq('id', user.id)
    .single();

  if (profileError || !profileData) {
    console.error("Error fetching profile:", profileError?.message);
    // If profile doesn't exist, maybe redirect to a setup page or show an error
    return json({ profile: null, family: null, error: "Failed to load user profile." }, { status: 500, headers });
  }

  if (!profileData.family_id) {
    // User is logged in but not associated with a family yet
    // This might happen after registration but before family creation/linking
    // TODO: Consider redirecting to a family setup/linking page or showing a specific message
    return json({ profile: profileData, family: null, error: "No family associated with this account." }, { headers });
  }

  // 2. Fetch the family data using the family_id from the profile
  const { data: familyData, error: familyError } = await supabaseServer
    .from('families')
    .select('*') // Select all columns from the families table
    .eq('id', profileData.family_id)
    .single();

  if (familyError) {
    console.error("Error fetching family data:", familyError?.message);
    return json({ profile: profileData, family: null, error: "Failed to load family data." }, { status: 500, headers });
  }

  // Return both profile and family data
  return json({ profile: profileData, family: familyData }, { headers });
}

export default function FamilyPortal() {
  // Now loader returns profile and family data
  const { profile, family, error } = useLoaderData<typeof loader>();

  // Handle specific error messages from the loader
  if (error) {
     // Special handling if no family is associated yet
     if (error === "No family associated with this account.") {
       return (
         <div className="container mx-auto px-4 py-8 text-center">
           <h1 className="text-2xl font-semibold mb-4">Welcome!</h1>
           <p className="text-gray-600 dark:text-gray-400 mb-6">
             Your account isn't linked to a family yet. Please complete your registration or contact support.
           </p>
           {/* Optional: Add a link to registration or contact */}
           {/* <Button asChild><Link to="/register/family-details">Complete Registration</Link></Button> */}
         </div>
       );
     }
     // Generic error display
    return <div className="text-red-500 p-4">Error loading family portal: {error}</div>;
  }

  // If family data is still loading or wasn't fetched (should be handled by error above now)
  if (!family) {
    return <div className="p-4">Loading family data...</div>; // Or a loading spinner
  }

  // Use the fetched family name or a generic fallback
  // We don't have profile.first_name here anymore
  const familyDisplayName = family.name || `Your Family Portal`;

  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold mb-6">Family Portal: {familyDisplayName}</h1>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* TODO: Implement these sections using actual data */}
        <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow">
          <h2 className="text-xl font-semibold mb-4">My Students</h2>
          {/* TODO: List students associated with the family */}
          <p className="text-gray-600 dark:text-gray-400">Student details will appear here.</p>
          {/* Temporarily remove asChild to debug SSR error */}
          <Button className="mt-4">
            <Link to="/register">Add Student</Link> {/* Link might need adjustment */}
          </Button>
        </div>

        <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow">
          <h2 className="text-xl font-semibold mb-4">Waivers</h2>
          {/* TODO: Link to or embed waiver status/signing */}
          <p className="text-gray-600 dark:text-gray-400">Waiver status and links will appear here.</p>
           {/* Temporarily remove asChild to debug SSR error */}
           <Button className="mt-4">
            <Link to="/waivers">View Waivers</Link>
          </Button>
        </div>

        <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow">
          <h2 className="text-xl font-semibold mb-4">Payments</h2>
          {/* TODO: Link to payment history and initiation */}
          <p className="text-gray-600 dark:text-gray-400">Payment history and options will appear here.</p>
           <Button className="mt-4" disabled>
             {/* <Link to="/payment">Make Payment</Link> */}
             <span>Make Payment (Coming Soon)</span>
          </Button>
        </div>

        <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow">
          <h2 className="text-xl font-semibold mb-4">Account Settings</h2>
          {/* TODO: Link to profile/account management */}
          <p className="text-gray-600 dark:text-gray-400">Links to update family/guardian info.</p>
           <Button className="mt-4" disabled>
             {/* <Link to="/account">Manage Account</Link> */}
             <span>Manage Account (Coming Soon)</span>
          </Button>
        </div>
      </div>
    </div>
  );
}
