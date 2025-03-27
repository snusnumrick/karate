import { Link } from "@remix-run/react";

export default function RegisterPage() {
  return (
    <div className="min-h-screen bg-green-50 py-12">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="bg-white p-8 rounded-lg shadow-md">
          <h1 className="text-3xl font-bold text-green-600 mb-6">Register for Karate Classes</h1>
          
          <p className="mb-6 text-gray-700">
            Join Sensei Negin's karate classes at Lighthouse Christian Academy. 
            Our family-oriented registration allows you to register multiple children under one family account.
          </p>
          
          <div className="bg-amber-50 p-4 rounded-md mb-8">
            <h2 className="font-semibold text-amber-800 mb-2">Class Information</h2>
            <ul className="text-amber-700 space-y-1">
              <li>• Ages: 6-12 years old</li>
              <li>• Schedule: Monday & Wednesday at 6 p.m.</li>
              <li>• Location: Lighthouse Christian Academy</li>
            </ul>
          </div>
          
          <div className="space-y-6">
            <div>
              <label htmlFor="familyName" className="block text-sm font-medium text-gray-700 mb-1">
                Family Name
              </label>
              <input
                type="text"
                id="familyName"
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500"
                placeholder="Enter your family name"
              />
            </div>
            
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">
                Email Address
              </label>
              <input
                type="email"
                id="email"
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500"
                placeholder="Enter your email address"
              />
            </div>
            
            <div>
              <label htmlFor="phone" className="block text-sm font-medium text-gray-700 mb-1">
                Phone Number
              </label>
              <input
                type="tel"
                id="phone"
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500"
                placeholder="Enter your phone number"
              />
            </div>
            
            <div className="pt-4">
              <button
                type="button"
                className="w-full bg-green-600 text-white font-bold py-3 px-4 rounded-lg hover:bg-green-700 transition"
              >
                Continue Registration
              </button>
            </div>
            
            <p className="text-sm text-gray-600 text-center">
              Already registered? <Link to="/login" className="text-green-600 hover:underline">Login here</Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
