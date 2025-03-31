import { useState } from "react";
import { Link, Form, useRouteError, isRouteErrorResponse, Outlet, useLocation, useActionData } from "@remix-run/react"; // Import Outlet and useLocation
import type { ActionFunctionArgs } from "@remix-run/node"; // or cloudflare/deno
import { json, redirect } from "@remix-run/node"; // or cloudflare/deno
import { getSupabaseServerClient } from "~/utils/supabase.server";
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
  console.log(formData);
  const { supabaseServer } = getSupabaseServerClient(request);

  // Validate matching emails and passwords
  const contact1Email = formData.get('contact1Email') as string;
  const contact1EmailConfirm = formData.get('contact1EmailConfirm') as string;
  const password = formData.get('portalPassword') as string;
  const passwordConfirm = formData.get('portalPasswordConfirm') as string;

  if (contact1Email !== contact1EmailConfirm) {
    return json({ error: 'Emails do not match' }, { status: 400 });
  }

  if (password !== passwordConfirm) {
    return json({ error: 'Passwords do not match' }, { status: 400 });
  }

  try {
    // Create auth user
    console.log('Creating auth user ...', contact1Email);
    // Construct the redirect URL based on the request origin
    const url = new URL(request.url);
    const emailRedirectTo = `${url.origin}/auth/callback`;

    const { data: { user }, error: authError } = await supabaseServer.auth.signUp({
      email: contact1Email,
      password,
      options: {
        // This tells Supabase where to redirect the user after email confirmation
        emailRedirectTo: emailRedirectTo,
        // Profile data is explicitly inserted later, so no 'data' option here
      }
    });
    console.log('Auth user created:', user, authError);

    if (authError || !user) throw authError || new Error('User creation failed');

    // Create family record
    const { data: familyData, error: familyError } = await supabaseServer.from('families')
      .insert({
        address: formData.get('address') as string,
        city: formData.get('city'),
        province: formData.get('province'),
        postal_code: formData.get('postalCode'),
        primary_phone: formData.get('primaryPhone'),
        email: contact1Email,
        name: formData.get('familyName'),
        referral_source: formData.get('referralSource'),
        referral_name: formData.get('referralName'),
        emergency_contact: formData.get('emergencyContact'),
        health_info: formData.get('healthNumber')
      })
      .select('id')
      .single();

    if (familyError) throw familyError;
    console.log('Family created:', familyData);
    const familyId = familyData.id;

    // Create user profile
    const { data: profileData, error: profileError } = await supabaseServer.from('profiles').insert({
      id: user.id,
      email: contact1Email,
      role: 'user',
      family_id: familyId
    });

    if (profileError) throw profileError;
    console.log('Profile created:', profileData);

    // Process Contact #1
    const contact1FirstName = formData.get('contact1FirstName') as string;
    const contact1LastName = formData.get('contact1LastName') as string;
    console.log(`Attempting to insert Guardian 1: Name=${contact1FirstName} ${contact1LastName}, Email=${contact1Email}`); // Added logging
    const { data: contact1Data, error: contact1Error } = await supabaseServer.from('guardians').insert({
      family_id: familyId,
      first_name: contact1FirstName,
      last_name: contact1LastName,
      relationship: formData.get('contact1Type'),
      home_phone: formData.get('contact1HomePhone'),
      work_phone: formData.get('contact1WorkPhone'),
      cell_phone: formData.get('contact1CellPhone'),
      email: contact1Email,
      employer: formData.get('contact1Employer'),
      employer_phone: formData.get('contact1EmployerPhone'),
      employer_notes: formData.get('contact1EmployerNotes')
    });

    if (contact1Error) throw contact1Error;
    if (contact1Error) { // Log error if insertion failed
        console.error('Error inserting Guardian 1:', contact1Error);
        throw contact1Error;
    }
    console.log('Contact #1 created:', contact1Data);

    // Process Contact #2
    const contact2FirstName = formData.get('contact2FirstName') as string;
    const contact2LastName = formData.get('contact2LastName') as string;
    const contact2Email = formData.get('contact2Email') as string;
    console.log(`Attempting to insert Guardian 2: Name=${contact2FirstName} ${contact2LastName}, Email=${contact2Email}`); // Added logging
    const { data: contact2Data, error: contact2Error } = await supabaseServer.from('guardians').insert({
      family_id: familyId,
      first_name: contact2FirstName,
      last_name: contact2LastName,
      relationship: formData.get('contact2Type'),
      home_phone: formData.get('contact2HomePhone'),
      work_phone: formData.get('contact2WorkPhone'),
      cell_phone: formData.get('contact2CellPhone'),
      email: formData.get('contact2Email'),
      employer: formData.get('contact2Employer'),
      employer_phone: formData.get('contact2EmployerPhone'),
      employer_notes: formData.get('contact2EmployerNotes')
    });
    if (contact2Error) { // Log error if insertion failed
        console.error('Error inserting Guardian 2:', contact2Error);
        throw contact2Error;
    }
    console.log('Contact #2 created:', contact2Data);

    // Process Students
    const studentEntries = Array.from(formData.entries())
      .filter(([key]) => key.startsWith('students['));

    const studentIndices = new Set<string>();
    studentEntries.forEach(([key]) => {
      const match = key.match(/students\[(\d+)\]/);
      if (match) {
        studentIndices.add(match[1]);
      }
    });

    for (const index of studentIndices) {
      const { data: studentData, error: studentError } = await supabaseServer.from('students').insert({
        family_id: familyId,
        first_name: formData.get(`students[${index}].firstName`),
        last_name: formData.get(`students[${index}].lastName`),
        gender: formData.get(`students[${index}].gender`),
        birth_date: formData.get(`students[${index}].birthDate`),
        t_shirt_size: formData.get(`students[${index}].tShirtSize`),
        school: formData.get(`students[${index}].school`),
        grade_level: formData.get(`students[${index}].gradeLevel`),
        special_needs: formData.get(`students[${index}].specialNeeds`),
        allergies: formData.get(`students[${index}].allergies`),
        medications: formData.get(`students[${index}].medications`),
        immunizations_up_to_date: formData.get(`students[${index}].immunizationsUpToDate`),
        immunization_notes: formData.get(`students[${index}].immunizationNotes`),
        belt_rank: formData.get(`students[${index}].beltRank`)
      });
      if (studentError) throw studentError;
      console.log('Student created:', studentData);
    }

    // Record policy agreements
   const { data: policyData, error: policyError } = await supabaseServer.from('policy_agreements').insert({
      family_id: familyId,
      full_name: formData.get('fullName'),
      photo_release: formData.has('photoRelease'),
      liability_release: formData.has('liability'),
      code_of_conduct: formData.has('conduct'),
      payment_policy: formData.has('payment'),
      attire_agreement: formData.has('attire'),
      signature_date: new Date().toISOString()
    });
    if (policyError) throw policyError;
    console.log('Policy agreement created:', policyData);

    return redirect('/register/success');

  } catch (error) {
    console.error('Registration error:', error);
    return json({ 
      error: error instanceof Error ? error.message : 'Registration failed',
      formData: Object.fromEntries(formData)
    }, { status: 500 });
  }
}


export default function RegisterPage() {
  const actionData = useActionData<typeof action>();
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
              {/* Step 1: Referral & Family Info */}
              <div className={currentStep === 1 ? '' : 'hidden'}>
                <h2 className="text-xl font-semibold text-foreground mb-4 pb-2 border-b border-border">REFERRAL INFORMATION</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                      <Label htmlFor="referralSource" className="text-sm font-medium mb-1">
                        How did you hear about us?<span className="text-red-500">*</span>
                      </Label>
                      <Select name="referralSource" required>
                        <SelectTrigger id="referralSource" className="w-full focus:ring-green-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white dark:focus:border-green-400 dark:focus:ring-green-400">
                          <SelectValue placeholder="Select an option" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="friend">Friend</SelectItem>
                          <SelectItem value="social">Social Media</SelectItem>
                          <SelectItem value="search">Search Engine</SelectItem>
                          <SelectItem value="flyer">Flyer</SelectItem>
                          <SelectItem value="event">Event</SelectItem>
                          <SelectItem value="other">Other</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    
                    <div>
                      <Label htmlFor="referralName" className="text-sm font-medium mb-1">
                        Referral Name
                      </Label>
                      <Input
                        type="text"
                        id="referralName"
                        name="referralName"
                        className="focus:ring-green-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white dark:focus:border-green-400 dark:focus:ring-green-400"
                      />
                    </div>
                  </div>
                  
                  <h2 className="text-xl font-semibold text-foreground mt-8 mb-4 pb-2 border-b border-border">FAMILY INFORMATION</h2>
                  <div>
                    <Label htmlFor="familyName" className="text-sm font-medium mb-1">
                      Family Last Name<span className="text-red-500">*</span>
                    </Label>
                    <Input
                      type="text"
                      id="familyName"
                      name="familyName"
                      required
                      className="focus:ring-green-500"
                    />
                  </div>
                  
                  <h2 className="text-xl font-semibold text-foreground mt-8 mb-4 pb-2 border-b border-border">WHERE DO YOU LIVE?</h2>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="md:col-span-2">
                      <Label htmlFor="address" className="text-sm font-medium mb-1">
                        Home Address<span className="text-red-500">*</span>
                      </Label>
                      <Input
                        type="text"
                        id="address"
                        name="address"
                        required
                        className="focus:ring-green-500"
                      />
                    </div>
                    
                    <div>
                      <Label htmlFor="city" className="text-sm font-medium mb-1">
                        City<span className="text-red-500">*</span>
                      </Label>
                      <Input
                        type="text"
                        id="city"
                        name="city"
                        required
                        className="focus:ring-green-500"
                      />
                    </div>
                    
                    <div>
                      <Label htmlFor="province" className="text-sm font-medium mb-1">
                        Province<span className="text-red-500">*</span>
                      </Label>
                      <Select name="province" required>
                        <SelectTrigger id="province" className="w-full focus:ring-green-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white dark:focus:border-green-400 dark:focus:ring-green-400">
                          <SelectValue placeholder="Select a province" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="AB">Alberta</SelectItem>
                          <SelectItem value="BC">British Columbia</SelectItem>
                          <SelectItem value="MB">Manitoba</SelectItem>
                          <SelectItem value="NB">New Brunswick</SelectItem>
                          <SelectItem value="NL">Newfoundland and Labrador</SelectItem>
                          <SelectItem value="NS">Nova Scotia</SelectItem>
                          <SelectItem value="ON">Ontario</SelectItem>
                          <SelectItem value="PE">Prince Edward Island</SelectItem>
                          <SelectItem value="QC">Quebec</SelectItem>
                          <SelectItem value="SK">Saskatchewan</SelectItem>
                          <SelectItem value="NT">Northwest Territories</SelectItem>
                          <SelectItem value="NU">Nunavut</SelectItem>
                          <SelectItem value="YT">Yukon</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    
                    <div>
                      <Label htmlFor="postalCode" className="text-sm font-medium mb-1">
                        Postal Code<span className="text-red-500">*</span>
                      </Label>
                      <Input
                        type="text"
                        id="postalCode"
                        name="postalCode"
                        required
                        className="focus:ring-green-500"
                      />
                    </div>
                    
                    <div>
                      <Label htmlFor="primaryPhone" className="text-sm font-medium mb-1">
                        Primary Phone<span className="text-red-500">*</span>
                      </Label>
                      <Input
                        type="tel"
                        id="primaryPhone"
                        name="primaryPhone"
                        required
                        className="focus:ring-green-500"
                      />
                    </div>
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
              
              {/* Step 2: Additional Info & Contact 1 */}
              <div className={currentStep === 2 ? '' : 'hidden'}>
                <h2 className="text-xl font-semibold text-foreground mb-4 pb-2 border-b border-border">ADDITIONAL INFO</h2>
                <div className="space-y-6">
                  <div>
                      <Label htmlFor="emergencyContact" className="text-sm font-medium mb-1">
                        Emergency Contact Info (Not Contact #1 or #2)<span className="text-red-500">*</span>
                      </Label>
                      <Textarea
                        id="emergencyContact"
                        name="emergencyContact"
                        required
                        rows={3}
                        className="focus:ring-green-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white dark:focus:border-green-400 dark:focus:ring-green-400"
                      />
                    </div>
                    
                    <div>
                      <Label htmlFor="healthNumber" className="text-sm font-medium mb-1">
                        Personal Health Number
                      </Label>
                      <Textarea
                        id="healthNumber"
                        name="healthNumber"
                        rows={3}
                        className="focus:ring-green-500"
                      />
                    </div>
                  </div>
                  
                  <h2 className="text-xl font-semibold text-foreground mt-8 mb-4 pb-2 border-b border-border">CONTACT #1</h2>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <div>
                      <Label htmlFor="contact1FirstName" className="block text-sm font-medium mb-1">
                        Contact #1 First Name<span className="text-red-500">*</span>
                      </Label>
                      <Input
                        type="text"
                        id="contact1FirstName"
                        name="contact1FirstName"
                        required
                        className="focus:ring-green-500"
                      />
                    </div>
                    
                    <div>
                      <Label htmlFor="contact1LastName" className="block text-sm font-medium mb-1">
                        Last Name<span className="text-red-500">*</span>
                      </Label>
                      <Input
                        type="text"
                        id="contact1LastName"
                        name="contact1LastName"
                        required
                        defaultValue={familyName} // Prefill with family name
                        className="focus:ring-green-500"
                      />
                    </div>
                    
                    <div>
                      <Label htmlFor="contact1Type" className="block text-sm font-medium mb-1">
                        Type<span className="text-red-500">*</span>
                      </Label>
                      <Select name="contact1Type" required>
                        <SelectTrigger id="contact1Type" className="w-full focus:ring-green-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white dark:focus:border-green-400 dark:focus:ring-green-400">
                          <SelectValue placeholder="Select relationship" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="Mother">Mother</SelectItem>
                          <SelectItem value="Father">Father</SelectItem>
                          <SelectItem value="Guardian">Guardian</SelectItem>
                          <SelectItem value="Other">Other</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  
                  <h3 className="text-lg font-medium text-foreground mt-6 mb-3">HOW CAN WE CONTACT YOU?</h3>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <div>
                      <Label htmlFor="contact1HomePhone" className="block text-sm font-medium mb-1">
                        Home Phone<span className="text-red-500">*</span>
                      </Label>
                      <Input
                        type="tel"
                        id="contact1HomePhone"
                        name="contact1HomePhone"
                        required
                        defaultValue={primaryPhone} // Prefill with primary phone
                        className="focus:ring-green-500"
                      />
                    </div>
                    
                    <div>
                      <Label htmlFor="contact1WorkPhone" className="block text-sm font-medium mb-1">
                        Work #
                      </Label>
                      <Input
                        type="tel"
                        id="contact1WorkPhone"
                        name="contact1WorkPhone"
                        className="focus:ring-green-500"
                      />
                    </div>
                    
                    <div>
                      <Label htmlFor="contact1CellPhone" className="block text-sm font-medium mb-1">
                        Cell #<span className="text-red-500">*</span>
                      </Label>
                      <Input
                        type="tel"
                        id="contact1CellPhone"
                        name="contact1CellPhone"
                        required
                        className="focus:ring-green-500"
                      />
                    </div>
                  </div>
                  
                  <h3 className="text-lg font-medium text-foreground mt-6 mb-3">PORTAL ACCESS (YOUR EMAIL IS YOUR LOGIN)</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                      <Label htmlFor="contact1Email" className="block text-sm font-medium mb-1">
                        Email<span className="text-red-500">*</span>
                      </Label>
                      <Input
                        type="email"
                        id="contact1Email"
                        name="contact1Email"
                        required
                        className="focus:ring-green-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white dark:focus:border-green-400 dark:focus:ring-green-400"
                      />
                      <p className="text-xs text-muted-foreground mt-1">(Emails are kept confidential)</p>
                    </div>
                    
                    <div>
                      <Label htmlFor="contact1EmailConfirm" className="block text-sm font-medium mb-1">
                        Confirm Email<span className="text-red-500">*</span>
                      </Label>
                      <Input
                        type="email"
                        id="contact1EmailConfirm"
                        name="contact1EmailConfirm"
                        required
                        className="focus:ring-green-500"
                      />
                    </div>
                    
                    <div>
                      <Label htmlFor="portalPassword" className="block text-sm font-medium mb-1">
                        Portal Account Password
                      </Label>
                      <Input
                        type="password"
                        id="portalPassword"
                        name="portalPassword"
                        minLength={5}
                        className="focus:ring-green-500"
                      />
                      <p className="text-xs text-muted-foreground mt-1">Minimum number of characters is 5</p>
                    </div>
                    
                    <div>
                      <Label htmlFor="portalPasswordConfirm" className="block text-sm font-medium mb-1">
                        Confirm Portal Account Password
                      </Label>
                      <Input
                        type="password"
                        id="portalPasswordConfirm"
                        name="portalPasswordConfirm"
                        minLength={5}
                        className="focus:ring-green-500"
                      />
                      <p className="text-xs text-muted-foreground mt-1">Minimum number of characters is 5</p>
                    </div>
                  </div>
                  
                  <h3 className="text-lg font-medium text-foreground mt-6 mb-3">WHO IS YOUR EMPLOYER?</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                      <Label htmlFor="contact1Employer" className="block text-sm font-medium mb-1">
                        Employer
                      </Label>
                      <Input
                        type="text"
                        id="contact1Employer"
                        name="contact1Employer"
                        className="focus:ring-green-500"
                      />
                    </div>
                    
                    <div>
                      <Label htmlFor="contact1EmployerPhone" className="block text-sm font-medium mb-1">
                        Employer Phone
                      </Label>
                      <Input
                        type="tel"
                        id="contact1EmployerPhone"
                        name="contact1EmployerPhone"
                        className="focus:ring-green-500"
                      />
                    </div>
                    
                    <div className="md:col-span-2">
                      <Label htmlFor="contact1EmployerNotes" className="block text-sm font-medium mb-1">
                        Employer Notes
                      </Label>
                      <Textarea
                        id="contact1EmployerNotes"
                        name="contact1EmployerNotes"
                        rows={3}
                        className="focus:ring-green-500"
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
                      type="button"
                      onClick={nextStep}
                      className="font-bold py-3 px-6 bg-green-600 text-white hover:bg-green-700"
                    >
                      Continue
                    </Button>
                  </div>
                </div>
              
              {/* Step 3: Contact 2 */}
              <div className={currentStep === 3 ? '' : 'hidden'}>
                <h2 className="text-xl font-semibold text-foreground mb-4 pb-2 border-b border-border">CONTACT #2</h2>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <div>
                      <Label htmlFor="contact2FirstName" className="block text-sm font-medium mb-1">
                        Contact #2 First Name<span className="text-red-500">*</span>
                      </Label>
                      <Input
                        type="text"
                        id="contact2FirstName"
                        name="contact2FirstName"
                        required
                        className="focus:ring-green-500"
                      />
                    </div>
                    
                    <div>
                      <Label htmlFor="contact2LastName" className="block text-sm font-medium mb-1">
                        Last Name<span className="text-red-500">*</span>
                      </Label>
                      <Input
                        type="text"
                        id="contact2LastName"
                        name="contact2LastName"
                        required
                        defaultValue={familyName} // Prefill with family name
                        className="focus:ring-green-500"
                      />
                    </div>
                    
                    <div>
                      <Label htmlFor="contact2Type" className="block text-sm font-medium mb-1">
                        Type<span className="text-red-500">*</span>
                      </Label>
                      <Select name="contact2Type" required>
                        <SelectTrigger id="contact2Type" className="w-full focus:ring-green-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white dark:focus:border-green-400 dark:focus:ring-green-400">
                          <SelectValue placeholder="Select relationship" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="Father">Father</SelectItem>
                          <SelectItem value="Mother">Mother</SelectItem>
                          <SelectItem value="Guardian">Guardian</SelectItem>
                          <SelectItem value="Other">Other</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  
                  <h3 className="text-lg font-medium text-foreground mt-6 mb-3">HOW CAN WE CONTACT YOU?</h3>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <div>
                      <Label htmlFor="contact2HomePhone" className="block text-sm font-medium mb-1">
                        Home Phone<span className="text-red-500">*</span>
                      </Label>
                      <Input
                        type="tel"
                        id="contact2HomePhone"
                        name="contact2HomePhone"
                        required
                        defaultValue={primaryPhone} // Prefill with primary phone
                        className="focus:ring-green-500"
                      />
                    </div>
                    
                    <div>
                      <Label htmlFor="contact2WorkPhone" className="block text-sm font-medium mb-1">
                        Work #
                      </Label>
                      <Input
                        type="tel"
                        id="contact2WorkPhone"
                        name="contact2WorkPhone"
                        className="focus:ring-green-500"
                      />
                    </div>
                    
                    <div>
                      <Label htmlFor="contact2CellPhone" className="block text-sm font-medium mb-1">
                        Cell #<span className="text-red-500">*</span>
                      </Label>
                      <Input
                        type="tel"
                        id="contact2CellPhone"
                        name="contact2CellPhone"
                        required
                        className="focus:ring-green-500"
                      />
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-6">
                    <div>
                      <Label htmlFor="contact2Email" className="block text-sm font-medium mb-1">
                        Email<span className="text-red-500">*</span>
                      </Label>
                      <Input
                        type="email"
                        id="contact2Email"
                        name="contact2Email"
                        required
                        className="focus:ring-green-500"
                      />
                      <p className="text-xs text-muted-foreground mt-1">(Emails are kept confidential)</p>
                    </div>
                    
                    <div>
                      <Label htmlFor="contact2EmailConfirm" className="block text-sm font-medium mb-1">
                        Confirm Email<span className="text-red-500">*</span>
                      </Label>
                      <Input
                        type="email"
                        id="contact2EmailConfirm"
                        name="contact2EmailConfirm"
                        required
                        className="focus:ring-green-500"
                      />
                    </div>
                  </div>
                  
                  <h3 className="text-lg font-medium text-foreground mt-6 mb-3">WHO IS YOUR EMPLOYER?</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                      <Label htmlFor="contact2Employer" className="block text-sm font-medium mb-1">
                        Employer
                      </Label>
                      <Input
                        type="text"
                        id="contact2Employer"
                        name="contact2Employer"
                        className="focus:ring-green-500"
                      />
                    </div>
                    
                    <div>
                      <Label htmlFor="contact2EmployerPhone" className="block text-sm font-medium mb-1">
                        Employer Phone
                      </Label>
                      <Input
                        type="tel"
                        id="contact2EmployerPhone"
                        name="contact2EmployerPhone"
                        className="focus:ring-green-500"
                      />
                    </div>
                    
                    <div className="md:col-span-2">
                      <Label htmlFor="contact2EmployerNotes" className="block text-sm font-medium mb-1">
                        Employer Notes
                      </Label>
                      <Textarea
                        id="contact2EmployerNotes"
                        name="contact2EmployerNotes"
                        rows={3}
                        className="focus:ring-green-500"
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
                      type="button"
                      onClick={nextStep}
                      className="font-bold py-3 px-6 bg-green-600 text-white hover:bg-green-700"
                    >
                      Continue
                    </Button>
                  </div>
                </div>
              
              {/* Step 4: Student Info */}
              <div className={currentStep === 4 ? '' : 'hidden'}>
                {students.map((student, index) => (
                  <div key={student.id} className="mb-8 pb-8 border-b border-border dark:border-gray-700">
                    <h2 className="text-xl font-semibold text-foreground mb-4">STUDENT #{index + 1}</h2>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div>
                          <Label htmlFor={`student${index}FirstName`} className="block text-sm font-medium mb-1">
                            Student&apos;s First Name<span className="text-red-500">*</span>
                          </Label>
                          <Input
                            type="text"
                            id={`student${index}FirstName`}
                            name={`students[${index}].firstName`}
                            required
                            className="focus:ring-green-500"
                          />
                        </div>
                        
                        <div>
                          <Label htmlFor={`student${index}LastName`} className="block text-sm font-medium mb-1">
                            Last Name<span className="text-red-500">*</span>
                          </Label>
                          <Input
                            type="text"
                            id={`student${index}LastName`}
                            name={`students[${index}].lastName`}
                            required
                            defaultValue={familyName} // Prefill with family name
                            className="focus:ring-green-500"
                          />
                        </div>
                        
                        <div>
                          <Label htmlFor={`student${index}Gender`} className="block text-sm font-medium mb-1">
                            Student Gender<span className="text-red-500">*</span>
                          </Label>
                          <Select name={`students[${index}].gender`} required>
                            <SelectTrigger id={`student${index}Gender`} className="w-full focus:ring-green-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white dark:focus:border-green-400 dark:focus:ring-green-400">
                              <SelectValue placeholder="Select gender" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="Male">Male</SelectItem>
                              <SelectItem value="Female">Female</SelectItem>
                              <SelectItem value="Other">Other</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        
                        <div>
                          <Label htmlFor={`student${index}BirthDate`} className="block text-sm font-medium mb-1">
                            Birth Date<span className="text-red-500">*</span>
                          </Label>
                          <Input
                            type="date"
                            id={`student${index}BirthDate`}
                            name={`students[${index}].birthDate`}
                            required
                            className="focus:ring-green-500"
                          />
                        </div>
                        
                        <div>
                          <Label htmlFor={`student${index}Cell`} className="block text-sm font-medium mb-1">
                            Cell #
                          </Label>
                          <Input
                            type="tel"
                            id={`student${index}Cell`}
                            name={`students[${index}].cellPhone`}
                            className="focus:ring-green-500"
                          />
                        </div>
                      </div>
                      
                      <h3 className="text-lg font-medium text-foreground mt-6 mb-3">ADDITIONAL INFO</h3>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div>
                          <Label htmlFor={`student${index}Email`} className="block text-sm font-medium mb-1">
                            Student Email
                          </Label>
                          <Input
                            type="email"
                            id={`student${index}Email`}
                            name={`students[${index}].email`}
                            className="focus:ring-green-500"
                          />
                        </div>
                        
                        <div>
                          <Label htmlFor={`student${index}TShirtSize`} className="block text-sm font-medium mb-1">
                            T-Shirt Size<span className="text-red-500">*</span>
                          </Label>
                          <Select name={`students[${index}].tShirtSize`} required>
                            <SelectTrigger id={`student${index}TShirtSize`} className="w-full focus:ring-green-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white dark:focus:border-green-400 dark:focus:ring-green-400">
                              <SelectValue placeholder="Select size" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="YXS">Youth XS</SelectItem>
                              <SelectItem value="YS">Youth S</SelectItem>
                              <SelectItem value="YM">Youth M</SelectItem>
                              <SelectItem value="YL">Youth L</SelectItem>
                              <SelectItem value="YXL">Youth XL</SelectItem>
                              <SelectItem value="AS">Adult S</SelectItem>
                              <SelectItem value="AM">Adult M</SelectItem>
                              <SelectItem value="AL">Adult L</SelectItem>
                              <SelectItem value="AXL">Adult XL</SelectItem>
                              <SelectItem value="A2XL">Adult 2XL</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        
                        <div>
                          <Label htmlFor={`student${index}School`} className="block text-sm font-medium mb-1">
                            School<span className="text-red-500">*</span>
                          </Label>
                          <Input
                            type="text"
                            id={`student${index}School`}
                            name={`students[${index}].school`}
                            required
                            className="focus:ring-green-500"
                          />
                        </div>
                        
                        <div>
                          <Label htmlFor={`student${index}GradeLevel`} className="block text-sm font-medium mb-1">
                            Grade Level<span className="text-red-500">*</span>
                          </Label>
                          <Select name={`students[${index}].gradeLevel`} required>
                            <SelectTrigger id={`student${index}GradeLevel`} className="w-full focus:ring-green-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white dark:focus:border-green-400 dark:focus:ring-green-400">
                              <SelectValue placeholder="Select grade" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="K">Kindergarten</SelectItem>
                              <SelectItem value="1">1st Grade</SelectItem>
                              <SelectItem value="2">2nd Grade</SelectItem>
                              <SelectItem value="3">3rd Grade</SelectItem>
                              <SelectItem value="4">4th Grade</SelectItem>
                              <SelectItem value="5">5th Grade</SelectItem>
                              <SelectItem value="6">6th Grade</SelectItem>
                              <SelectItem value="7">7th Grade</SelectItem>
                              <SelectItem value="8">8th Grade</SelectItem>
                              <SelectItem value="9">9th Grade</SelectItem>
                              <SelectItem value="10">10th Grade</SelectItem>
                              <SelectItem value="11">11th Grade</SelectItem>
                              <SelectItem value="12">12th Grade</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        
                        <div className="md:col-span-2">
                          <Label htmlFor={`student${index}SpecialNeeds`} className="block text-sm font-medium mb-1">
                            Special Needs (Leave blank if NONE)
                          </Label>
                          <Input
                            type="text"
                            id={`student${index}SpecialNeeds`}
                            name={`students[${index}].specialNeeds`}
                            className="focus:ring-green-500"
                          />
                        </div>
                        
                        <div className="md:col-span-2">
                          <Label htmlFor={`student${index}Allergies`} className="block text-sm font-medium mb-1">
                            Allergies (Leave blank if NONE)
                          </Label>
                          <Textarea
                            id={`student${index}Allergies`}
                            name={`students[${index}].allergies`}
                            rows={3}
                            className="focus:ring-green-500"
                          />
                        </div>
                        
                        <div className="md:col-span-2">
                          <Label htmlFor={`student${index}Medications`} className="block text-sm font-medium mb-1">
                            Medications (Leave blank if NONE)
                          </Label>
                          <Textarea
                            id={`student${index}Medications`}
                            name={`students[${index}].medications`}
                            rows={3}
                            className="focus:ring-green-500"
                          />
                        </div>
                        
                        <div>
                          <Label htmlFor={`student${index}Immunizations`} className="block text-sm font-medium mb-1">
                            Immunizations YN
                          </Label>
                          <Select name={`students[${index}].immunizationsUpToDate`}>
                            <SelectTrigger id={`student${index}Immunizations`} className="w-full focus:ring-green-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white dark:focus:border-green-400 dark:focus:ring-green-400">
                              <SelectValue placeholder="Select option" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="No">No</SelectItem>
                              <SelectItem value="Yes">Yes</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        
                        <div className="md:col-span-2">
                          <Label htmlFor={`student${index}ImmunizationNotes`} className="block text-sm font-medium mb-1">
                            Immunization Notes
                          </Label>
                          <Textarea
                            id={`student${index}ImmunizationNotes`}
                            name={`students[${index}].immunizationNotes`}
                            rows={3}
                            className="focus:ring-green-500"
                          />
                        </div>
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
              
              {/* Step 5: Policies & Submit */}
              <div className={currentStep === 5 ? '' : 'hidden'}>
                <h2 className="text-xl font-semibold text-foreground mb-4 pb-2 border-b border-border">REQUIRED POLICIES</h2>
                
                <div className="space-y-6">
                    {/* Photo Release */}
                    <div className="bg-muted/50 dark:bg-muted p-4 rounded-md border border-border text-foreground">
                      <div className="flex items-start space-x-3">
                        <Checkbox 
                          id="photoRelease" 
                          name="photoRelease" 
                          required 
                          checked={photoReleaseChecked}
                          onCheckedChange={(checked) => handleIndividualPolicyChange(setPhotoReleaseChecked, Boolean(checked))}
                          className="dark:border-gray-400 dark:data-[state=checked]:bg-green-400 dark:data-[state=checked]:border-green-400" 
                        />
                        <div>
                          <Label htmlFor="photoRelease" className="font-medium">
                            Photo / Video Release
                          </Label>
                          <p className="text-muted-foreground text-sm mt-2">
                            I give permission for my child to be photographed or videotaped during karate activities. 
                            I understand these images may be used for promotional purposes including social media, website, and printed materials.
                          </p>
                        </div>
                      </div>
                    </div>
                    
                    {/* Liability */}
                    <div className="bg-muted/50 dark:bg-muted p-4 rounded-md border border-border text-foreground">
                      <div className="flex items-start space-x-3">
                        <Checkbox 
                          id="liability" 
                          name="liability" 
                          required 
                          checked={liabilityChecked}
                          onCheckedChange={(checked) => handleIndividualPolicyChange(setLiabilityChecked, Boolean(checked))}
                          className="dark:border-gray-400 dark:data-[state=checked]:bg-green-400 dark:data-[state=checked]:border-green-400" 
                        />
                        <div>
                          <Label htmlFor="liability" className="font-medium">
                            Release of Liability & Assumption of Risk
                          </Label>
                          <p className="text-muted-foreground text-sm mt-2">
                            I understand that participation in karate involves physical activity and carries inherent risks. 
                            I release Karate Greenegin, its instructors, and staff from liability for injuries sustained during participation.
                          </p>
                        </div>
                      </div>
                    </div>
                    
                    {/* Conduct */}
                    <div className="bg-muted/50 dark:bg-muted p-4 rounded-md border border-border text-foreground">
                      <div className="flex items-start space-x-3">
                        <Checkbox 
                          id="conduct" 
                          name="conduct" 
                          required 
                          checked={conductChecked}
                          onCheckedChange={(checked) => handleIndividualPolicyChange(setConductChecked, Boolean(checked))}
                          className="dark:border-gray-400 dark:data-[state=checked]:bg-green-400 dark:data-[state=checked]:border-green-400" 
                        />
                        <div>
                          <Label htmlFor="conduct" className="font-medium">
                            Code Of Conduct Agreement
                          </Label>
                          <p className="text-muted-foreground text-sm mt-2">
                            I agree that my child will follow all rules and guidelines set by the instructors, 
                            show respect to all participants, and maintain appropriate behavior during all activities.
                          </p>
                        </div>
                      </div>
                    </div>
                    
                    {/* Payment */}
                    <div className="bg-muted/50 dark:bg-muted p-4 rounded-md border border-border text-foreground">
                      <div className="flex items-start space-x-3">
                        <Checkbox 
                          id="payment" 
                          name="payment" 
                          required 
                          checked={paymentChecked}
                          onCheckedChange={(checked) => handleIndividualPolicyChange(setPaymentChecked, Boolean(checked))}
                          className="dark:border-gray-400 dark:data-[state=checked]:bg-green-400 dark:data-[state=checked]:border-green-400" 
                        />
                        <div>
                          <Label htmlFor="payment" className="font-medium">
                            Payment Policy
                          </Label>
                          <p className="text-muted-foreground text-sm mt-2">
                            I understand the payment schedule and agree to make timely payments. 
                            I acknowledge that fees are non-refundable and that missed classes cannot be credited.
                          </p>
                        </div>
                      </div>
                    </div>
                    
                    {/* Attire */}
                    <div className="bg-muted/50 dark:bg-muted p-4 rounded-md border border-border text-foreground">
                      <div className="flex items-start space-x-3">
                        <Checkbox 
                          id="attire" 
                          name="attire" 
                          required 
                          checked={attireChecked}
                          onCheckedChange={(checked) => handleIndividualPolicyChange(setAttireChecked, Boolean(checked))}
                          className="dark:border-gray-400 dark:data-[state=checked]:bg-green-400 dark:data-[state=checked]:border-green-400" 
                        />
                        <div>
                          <Label htmlFor="attire" className="font-medium">
                            Attire / Dress Code Agreement
                          </Label>
                          <p className="text-muted-foreground text-sm mt-2">
                            I agree that my child will wear the appropriate karate uniform (gi) to all classes 
                            and will maintain proper hygiene and appearance according to dojo guidelines.
                          </p>
                        </div>
                      </div>
                    </div>
                    
                    {/* Agree All */}
                    <div className="bg-muted/50 dark:bg-muted p-4 rounded-md border border-border">
                      <div className="flex items-start space-x-3">
                        <Checkbox 
                          id="agreeAll" 
                          name="agreeAll" 
                          required 
                          checked={agreeAllChecked}
                          onCheckedChange={(checked) => handleAgreeAllChange(Boolean(checked))}
                          className="dark:border-gray-400 dark:data-[state=checked]:bg-green-400 dark:data-[state=checked]:border-green-400" 
                        />
                        <Label htmlFor="agreeAll" className="font-medium">
                          I AGREE TO ALL OF THE ABOVE
                        </Label>
                      </div>
                    </div>
                    
                    <div>
                      <Label htmlFor="fullName" className="text-sm font-medium mb-1">
                        Enter your Full Name<span className="text-red-500">*</span>
                      </Label>
                      <Input
                        type="text"
                        id="fullName"
                        name="fullName"
                        required
                        className="focus:ring-green-500"
                      />
                      <p className="text-sm text-muted-foreground mt-1">
                        {new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
                      </p>
                    </div>
                    
                    <div>
                      <Label htmlFor="comments" className="text-sm font-medium mb-1">
                        Comments
                      </Label>
                      <Textarea
                        id="comments"
                        name="comments"
                        rows={4}
                        className="focus:ring-green-500"
                      />
                    </div>
                  </div>

                  {actionData?.error && (
                    <div className="text-red-500 text-sm mt-4 p-3 bg-red-50 border border-red-200 rounded-md">
                      Error: {actionData.error}
                    </div>
                  )}
                  
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
