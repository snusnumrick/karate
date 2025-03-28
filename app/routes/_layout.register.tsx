import { useState } from "react";
import { Link, Form, useRouteError, isRouteErrorResponse, Outlet, useLocation } from "@remix-run/react"; // Import Outlet and useLocation
import type { ActionFunctionArgs } from "@remix-run/node"; // or cloudflare/deno
import { json, redirect } from "@remix-run/node"; // or cloudflare/deno
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { Checkbox } from "~/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";
import { Textarea } from "~/components/ui/textarea";
import { Alert, AlertDescription, AlertTitle } from "~/components/ui/alert"; // For ErrorBoundary

// Action function to handle form submission
export async function action({ request }: ActionFunctionArgs) {
  const formData = await request.formData();
  const data = Object.fromEntries(formData);

  // TODO: Add validation logic here
  // TODO: Add logic to save data to Supabase (create user, family, students, etc.)
  
  console.log("Registration form data:", data);

  // For now, just redirect to a success page or home page after submission
  // Replace '/register/success' with your actual success route if different
  return redirect('/register/success'); 
  
  // Or return json if staying on the page or showing a message
  // return json({ success: true, message: "Registration submitted (data logged)." });
}


export default function RegisterPage() {
  const [currentStep, setCurrentStep] = useState(1);
  const [students, setStudents] = useState([{ id: Date.now().toString() }]);
  const [familyName, setFamilyName] = useState(""); // State for family name
  const [primaryPhone, setPrimaryPhone] = useState(""); // State for primary phone
  
  // State for policy checkboxes
  const [photoReleaseChecked, setPhotoReleaseChecked] = useState(false);
  const [liabilityChecked, setLiabilityChecked] = useState(false);
  const [conductChecked, setConductChecked] = useState(false);
  const [paymentChecked, setPaymentChecked] = useState(false);
  const [attireChecked, setAttireChecked] = useState(false);
  const [agreeAllChecked, setAgreeAllChecked] = useState(false);

  const policyCheckboxes = [
    { state: photoReleaseChecked, setState: setPhotoReleaseChecked },
    { state: liabilityChecked, setState: setLiabilityChecked },
    { state: conductChecked, setState: setConductChecked },
    { state: paymentChecked, setState: setPaymentChecked },
    { state: attireChecked, setState: setAttireChecked },
  ];

  const handleAgreeAllChange = (checked: boolean) => {
    setAgreeAllChecked(checked);
    policyCheckboxes.forEach(cb => cb.setState(checked));
  };

  const handleIndividualPolicyChange = (setState: React.Dispatch<React.SetStateAction<boolean>>, checked: boolean) => {
    setState(checked);
    // Check if all individual policies are now checked
    const allChecked = policyCheckboxes.every(cb => (cb.setState === setState ? checked : cb.state));
    const noneChecked = policyCheckboxes.every(cb => (cb.setState === setState ? !checked : !cb.state));

    if (allChecked) {
      setAgreeAllChecked(true);
    } else {
      setAgreeAllChecked(false);
    }
  };


  const addStudent = () => {
    setStudents([...students, { id: Date.now().toString() }]);
  };
  
  const nextStep = () => {
    // Capture family name and primary phone when moving from step 1
    if (currentStep === 1) {
      const familyNameInput = document.getElementById('familyName') as HTMLInputElement;
      const primaryPhoneInput = document.getElementById('primaryPhone') as HTMLInputElement;
      if (familyNameInput) setFamilyName(familyNameInput.value);
      if (primaryPhoneInput) setPrimaryPhone(primaryPhoneInput.value);
    }
    setCurrentStep(currentStep + 1);
    window.scrollTo(0, 0);
  };
  
  const prevStep = () => {
    setCurrentStep(currentStep - 1);
    window.scrollTo(0, 0);
  };

  const location = useLocation(); // Get the current location

  // Determine if we are on the base /register route or a child route
  const isBaseRegisterRoute = location.pathname === '/register';
  
  return (
    <div className="min-h-screen bg-amber-50 dark:bg-gray-800 py-12 text-foreground">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        {isBaseRegisterRoute ? (
          // Render the multi-step form only on /register
          <div className="bg-white dark:bg-gray-800 p-8 rounded-lg shadow-md backdrop-blur-lg border dark:border-gray-700">
            <div className="flex justify-between items-center mb-6">
              <h1 className="text-3xl font-bold text-green-600 dark:text-green-400">Registration</h1>
              <Link to="/login" className="text-green-600 dark:text-green-400 hover:underline hover:text-green-700 dark:hover:text-green-300">
                Already a customer? Click here to login.
              </Link>
            </div>
            
            <p className="mb-6 text-muted-foreground">
              Welcome to Karate Greenegin! We are so excited to meet your performer and
              family! Please complete the following registration form. Afterwards you will be able to
              enroll in the classes of your choice!
            </p>
            
            <div className="mb-6">
              <div className="w-full bg-muted rounded-full h-2.5">
                <div 
                  className="bg-green-600 h-2.5 rounded-full" 
                  style={{ width: `${(currentStep / 5) * 100}%` }}
                ></div>
              </div>
              <p className="text-center mt-2 text-sm text-muted-foreground dark:text-muted-foreground">Step {currentStep} of 5</p>
            </div>
            
            <Form method="post" noValidate className="space-y-8">
              {/* --- All the step content (currentStep === 1, 2, 3, 4, 5) goes here --- */}
              {currentStep === 1 && (
                <div>
                  <h2 className="text-xl font-semibold text-foreground mb-4 pb-2 border-b border-border">REFERRAL INFORMATION</h2>
                  {/* ... rest of step 1 ... */}
                   </div>
                  
                  <div className="mt-8">
                    <Button
                      type="button"
                      onClick={nextStep}
                      className="w-full font-bold py-3 px-4 bg-green-600 text-white hover:bg-green-700"
                    >
                      Continue to Additional Info
                    </Button>
                  </div>
                </div>
              )}
              
              {currentStep === 2 && (
                <div>
                  <h2 className="text-xl font-semibold text-foreground mb-4 pb-2 border-b border-border">ADDITIONAL INFO</h2>
                  {/* ... rest of step 2 ... */}
                   </div>
                  
                  <div className="flex justify-between mt-8">
                    <Button
                      type="button"
                      onClick={prevStep}
                      variant="outline"
                      className="font-bold py-3 px-6 border-border text-foreground hover:bg-muted"
                    >
                      Back
                    </Button>
                    <Button
                      type="button"
                      onClick={nextStep}
                      className="font-bold py-3 px-6 bg-green-600 text-white hover:bg-green-700"
                    >
                      Continue
                    </Button>
                  </div>
                </div>
              )}
              
              {currentStep === 3 && (
                <div>
                  <h2 className="text-xl font-semibold text-foreground mb-4 pb-2 border-b border-border">CONTACT #2</h2>
                  {/* ... rest of step 3 ... */}
                   </div>
                  
                  <div className="flex justify-between mt-8">
                    <Button
                      type="button"
                      onClick={prevStep}
                      variant="outline"
                      className="font-bold py-3 px-6 border-border text-foreground hover:bg-muted"
                    >
                      Back
                    </Button>
                    <Button
                      type="button"
                      onClick={nextStep}
                      className="font-bold py-3 px-6 bg-green-600 text-white hover:bg-green-700"
                    >
                      Continue
                    </Button>
                  </div>
                </div>
              )}
              
              {currentStep === 4 && (
                <div>
                  {students.map((student, index) => (
                    <div key={student.id} className="mb-8 pb-8 border-b border-border dark:border-gray-700">
                      <h2 className="text-xl font-semibold text-foreground mb-4">STUDENT #{index + 1}</h2>
                      {/* ... rest of student fields ... */}
                       </div>
                      
                      <div>
                        <Label htmlFor={`student${index}BeltRank`} className="block text-sm font-medium mb-1">
                          Belt Rank
                        </Label>
                        <Select name={`students[${index}].beltRank`}>
                          <SelectTrigger id={`student${index}BeltRank`} className="w-full focus:ring-green-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white dark:focus:border-green-400 dark:focus:ring-green-400">
                            <SelectValue placeholder="Select belt rank" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="white">White</SelectItem>
                            <SelectItem value="yellow">Yellow</SelectItem>
                            <SelectItem value="orange">Orange</SelectItem>
                            <SelectItem value="green">Green</SelectItem>
                            <SelectItem value="blue">Blue</SelectItem>
                            <SelectItem value="purple">Purple</SelectItem>
                            <SelectItem value="brown">Brown</SelectItem>
                            <SelectItem value="black">Black</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                  ))}
                  
                  <div className="mt-4 mb-8">
                    <Button 
                      type="button"
                      onClick={addStudent}
                      variant="outline"
                      className="w-full flex items-center justify-center text-foreground"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2 text-foreground" viewBox="0 0 20 20" fill="currentColor">
                        <path fillRule="evenodd" d="M10 5a1 1 0 011 1v3h3a1 1 0 110 2h-3v3a1 1 0 11-2 0v-3H6a1 1 0 110-2h3V6a1 1 0 011-1z" clipRule="evenodd" />
                      </svg>
                      ADD ANOTHER STUDENT
                    </Button>
                  </div>
                  
                  <div className="flex justify-between mt-8">
                    <Button
                      type="button"
                      onClick={prevStep}
                      variant="outline"
                      className="font-bold py-3 px-6 border-border text-foreground hover:bg-muted"
                    >
                      Back
                    </Button>
                    <Button
                      type="button"
                      onClick={nextStep}
                      className="font-bold py-3 px-6 bg-green-600 text-white hover:bg-green-700"
                    >
                      Continue
                    </Button>
                  </div>
                </div>
              )}
              
              {currentStep === 5 && (
                <div>
                  <h2 className="text-xl font-semibold text-foreground mb-4 pb-2 border-b border-border">REQUIRED POLICIES</h2>
                  {/* ... rest of step 5 ... */}
                     />
                    </div>
                  </div>
                  
                  <div className="flex justify-between mt-8">
                    <Button
                      type="button"
                      onClick={prevStep}
                      variant="outline"
                      className="font-bold py-3 px-6 border-border text-foreground hover:bg-muted"
                    >
                      Back
                    </Button>
                    <Button
                      type="submit"
                      className="font-bold py-3 px-6 bg-green-600 text-white hover:bg-green-700"
                    >
                      SUBMIT REGISTRATION
                    </Button>
                  </div>
                  
                </div>
              )}
            </Form>
          </div>
        ) : (
          // Render the Outlet for child routes like /register/success
          <Outlet />
        )}
      </div>
    </div>
  );
}

// Error Boundary for the registration route
export function ErrorBoundary() {
  const error = useRouteError();

  // Log the error to the console
  console.error("Registration Route Error:", error);

  let title = "An Unexpected Error Occurred";
  let message = "We encountered an unexpected issue. Please try again later.";
  let status = 500;

  if (isRouteErrorResponse(error)) {
    title = `${error.status} ${error.statusText}`;
    message = error.data?.message || error.data || "An error occurred processing your request.";
    status = error.status;
  } else if (error instanceof Error) {
    // Keep generic message for users, but we logged the specific error
    message = error.message; // Or keep the generic message above
  }

  return (
    <div className="min-h-screen bg-amber-50 dark:bg-gray-800 py-12 text-foreground flex items-center justify-center">
      <div className="max-w-md w-full mx-auto px-4 sm:px-6 lg:px-8">
        <Alert variant="destructive" className="bg-white dark:bg-gray-800 shadow-md border dark:border-gray-700">
          <AlertTitle className="text-lg font-bold">{title}</AlertTitle>
          <AlertDescription className="mt-2">
            {message}
            {status === 405 && <p className="mt-2 text-sm">It seems there was an issue submitting the form. Please check the form and try again.</p>}
          </AlertDescription>
          <div className="mt-4">
            <Button asChild variant="outline">
              <Link to="/register">Go back to Registration</Link>
            </Button>
          </div>
        </Alert>
      </div>
    </div>
  );
}
