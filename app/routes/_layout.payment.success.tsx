import { json, redirect } from "@remix-run/node";
import { useLoaderData, Link } from "@remix-run/react";
import type { LoaderFunctionArgs } from "@remix-run/node";
import { getSupabaseServerClient } from "~/utils/supabase.server";

export async function loader({ request }: LoaderFunctionArgs) {
  const url = new URL(request.url);
  const sessionId = url.searchParams.get("session_id");
  
  if (!sessionId) {
    return redirect("/");
  }
  
  const { supabaseServer } = getSupabaseServerClient(request);
  
  // Get payment details
  const { data: payment, error } = await supabaseServer
    .from('payments')
    .select(`
      *,
      family:family_id (name)
    `)
    .eq('stripe_session_id', sessionId) // Use the correct column name
    .single();

  if (error || !payment) {
    return json({ error: "Payment not found" }, { status: 404 });
  }
  
  return json({ payment });
}

export default function PaymentSuccess() {
  const loaderData = useLoaderData<typeof loader>();

  // Handle case where loader returned an error
  if ('error' in loaderData) {
    return (
      <div className="max-w-md mx-auto my-12 p-6 bg-white dark:bg-gray-800 rounded-lg shadow-lg text-center">
        <h1 className="text-xl font-bold text-red-600 dark:text-red-400 mb-4">Error Loading Payment Details</h1>
        <p className="text-gray-600 dark:text-gray-300 mb-6">{loaderData.error}</p>
        <Link
            to="/"
            className="px-4 py-2 bg-gray-200 dark:bg-gray-600 text-gray-800 dark:text-white rounded hover:bg-gray-300 dark:hover:bg-gray-500"
          >
            Return Home
          </Link>
      </div>
    );
  }

  // Now we know payment exists
  const { payment } = loaderData;

  // Type assertion for easier access, matching the updated enum
  const typedPayment = payment as {
      amount: number;
      family_id: string;
      id: string;
      payment_date: string | null; // Can be null if webhook hasn't run yet
      payment_method: string | null; // Can be null
      status: "pending" | "succeeded" | "failed";
      family: { name: string } | null;
      receipt_url?: string | null;
  };

  return (
    <div className="max-w-md mx-auto my-12 p-6 bg-white dark:bg-gray-800 rounded-lg shadow-lg">
      <div className="text-center">
        <div className="inline-flex items-center justify-center w-16 h-16 mb-6 bg-green-100 dark:bg-green-900 rounded-full">
          <svg className="w-8 h-8 text-green-600 dark:text-green-300" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"></path>
          </svg>
        </div>
        
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">Payment Successful!</h1>
        <p className="text-gray-600 dark:text-gray-300 mb-6">
          Thank you for your payment of ${(payment.amount / 100).toFixed(2)}
        </p>
        
        <div className="mb-6 p-4 bg-gray-50 dark:bg-gray-700 rounded text-left">
          <p className="text-sm text-gray-700 dark:text-gray-300">
            <span className="font-semibold">Family:</span> {payment.family?.name}
          </p>
          <p className="text-sm text-gray-700 dark:text-gray-300">
            <span className="font-semibold">Transaction ID:</span> {payment.id}
          </p>
          <p className="text-sm text-gray-700 dark:text-gray-300">
            <span className="font-semibold">Date:</span> {new Date(payment.payment_date).toLocaleDateString()}
          </p>
        </div>
        
        <div className="flex justify-center space-x-4">
          {payment.receipt_url && (
            <a 
              href={payment.receipt_url} 
              target="_blank" 
              rel="noopener noreferrer"
              className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
            >
              View Receipt
            </a>
          )}
          
          <Link 
            to="/"
            className="px-4 py-2 bg-gray-200 dark:bg-gray-600 text-gray-800 dark:text-white rounded hover:bg-gray-300 dark:hover:bg-gray-500"
          >
            Return Home
          </Link>
        </div>
      </div>
    </div>
  );
}
