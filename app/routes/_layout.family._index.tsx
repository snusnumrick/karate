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
    return json({ family: null, error: "User not authenticated" }, { status: 401, headers });
  }

  // TODO: Fetch actual family data based on user.id or associated familyId
  // const { data: familyData, error } = await supabaseServer
  //   .from('families') // Assuming a 'families' table linked to users
  //   .select('*')
  //   .eq('user_id', user.id) // Or based on a profile link
  //   .single();

  // if (error) {
  //   console.error("Error fetching family data:", error);
  //   return json({ family: null, error: "Failed to load family data" }, { status: 500, headers });
  // }

  // Placeholder data for now
  const familyData = { name: "Example Family" };

  return json({ family: familyData }, { headers });
}

export default function FamilyPortal() {
  const { family, error } = useLoaderData<typeof loader>();

  if (error) {
    return <div className="text-red-500 p-4">Error loading family portal: {error}</div>;
  }

  if (!family) {
    // Handle case where family data couldn't be loaded or doesn't exist yet
    return <div className="p-4">Loading family data or no family associated...</div>;
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold mb-6">Family Portal: {family.name}</h1>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Placeholder sections - to be implemented */}
        <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow">
          <h2 className="text-xl font-semibold mb-4">My Students</h2>
          {/* TODO: List students associated with the family */}
          <p className="text-gray-600 dark:text-gray-400">Student details will appear here.</p>
          <Button asChild className="mt-4">
            <Link to="/register">Add Student</Link> {/* Link might need adjustment */}
          </Button>
        </div>

        <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow">
          <h2 className="text-xl font-semibold mb-4">Waivers</h2>
          {/* TODO: Link to or embed waiver status/signing */}
          <p className="text-gray-600 dark:text-gray-400">Waiver status and links will appear here.</p>
           <Button asChild className="mt-4">
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
