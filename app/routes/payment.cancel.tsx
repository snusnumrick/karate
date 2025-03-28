import { Link } from "@remix-run/react";

export default function PaymentCancel() {
  return (
    <div className="max-w-md mx-auto my-12 p-6 bg-white dark:bg-gray-800 rounded-lg shadow-lg">
      <div className="text-center">
        <div className="inline-flex items-center justify-center w-16 h-16 mb-6 bg-yellow-100 dark:bg-yellow-900 rounded-full">
          <svg className="w-8 h-8 text-yellow-600 dark:text-yellow-300" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"></path>
          </svg>
        </div>
        
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">Payment Cancelled</h1>
        <p className="text-gray-600 dark:text-gray-300 mb-6">
          Your payment was not completed. No charges were made.
        </p>
        
        <div className="flex justify-center space-x-4">
          <Link 
            to="/"
            className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
          >
            Return Home
          </Link>
          
          <Link 
            to="/registration"
            className="px-4 py-2 bg-gray-200 dark:bg-gray-600 text-gray-800 dark:text-white rounded hover:bg-gray-300 dark:hover:bg-gray-500"
          >
            Try Again
          </Link>
        </div>
      </div>
    </div>
  );
}
