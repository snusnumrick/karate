import { useState } from "react";
import { Link, Form } from "@remix-run/react";
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

export default function RegisterPage() {
  const [currentStep, setCurrentStep] = useState(1);
  const [students, setStudents] = useState([{ id: Date.now().toString() }]);
  
  const addStudent = () => {
    setStudents([...students, { id: Date.now().toString() }]);
  };
  
  const nextStep = () => {
    setCurrentStep(currentStep + 1);
    window.scrollTo(0, 0);
  };
  
  const prevStep = () => {
    setCurrentStep(currentStep - 1);
    window.scrollTo(0, 0);
  };
  
  return (
    <div className="min-h-screen bg-green-50 py-12 text-foreground">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="bg-white dark:bg-background p-8 rounded-lg shadow-md">
          <div className="flex justify-between items-center mb-6">
            <h1 className="text-3xl font-bold text-green-600">Registration</h1>
            <Link to="/login" className="text-green-600 hover:underline">
              Already a customer? Click here to login.
            </Link>
          </div>
          
          <p className="mb-6 text-gray-700">
            Welcome to Karate Greenegin! We are so excited to meet your performer and
            family! Please complete the following registration form. Afterwards you will be able to
            enroll in the classes of your choice!
          </p>
          
          <div className="mb-6">
            <div className="w-full bg-gray-200 dark:bg-muted rounded-full h-2.5">
              <div 
                className="bg-primary h-2.5 rounded-full" 
                style={{ width: `${(currentStep / 5) * 100}%` }}
              ></div>
            </div>
            <p className="text-center mt-2 text-sm text-muted-foreground dark:text-muted-foreground">Step {currentStep} of 5</p>
          </div>
          
          <Form method="post" className="space-y-8">
            {currentStep === 1 && (
              <div>
                <h2 className="text-xl font-semibold text-foreground mb-4 pb-2 border-b border-border">REFERRAL INFORMATION</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <Label htmlFor="referralSource" className="text-sm font-medium mb-1">
                      How did you hear about us?<span className="text-red-500">*</span>
                    </Label>
                    <Select name="referralSource" required>
                      <SelectTrigger id="referralSource" className="w-full">
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
                      className="focus:ring-green-500"
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
                      <SelectTrigger id="province" className="w-full">
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
                    className="w-full font-bold py-3 px-4"
                  >
                    Continue to Additional Info
                  </Button>
                </div>
              </div>
            )}
            
            {currentStep === 2 && (
              <div>
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
                      className="focus:ring-green-500"
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
                    <label htmlFor="contact1FirstName" className="block text-sm font-medium text-gray-700 mb-1">
                      Contact #1 First Name<span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      id="contact1FirstName"
                      name="contact1FirstName"
                      required
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500"
                    />
                  </div>
                  
                  <div>
                    <label htmlFor="contact1LastName" className="block text-sm font-medium text-gray-700 mb-1">
                      Last Name<span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      id="contact1LastName"
                      name="contact1LastName"
                      required
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500"
                    />
                  </div>
                  
                  <div>
                    <label htmlFor="contact1Type" className="block text-sm font-medium text-gray-700 mb-1">
                      Type<span className="text-red-500">*</span>
                    </label>
                    <select
                      id="contact1Type"
                      name="contact1Type"
                      required
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500"
                    >
                      <option value="">Select relationship</option>
                      <option value="Mother">Mother</option>
                      <option value="Father">Father</option>
                      <option value="Guardian">Guardian</option>
                      <option value="Other">Other</option>
                    </select>
                  </div>
                </div>
                
                <h3 className="text-lg font-medium text-gray-800 dark:text-foreground mt-6 mb-3">HOW CAN WE CONTACT YOU?</h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <div>
                    <label htmlFor="contact1HomePhone" className="block text-sm font-medium text-gray-700 mb-1">
                      Home Phone<span className="text-red-500">*</span>
                    </label>
                    <input
                      type="tel"
                      id="contact1HomePhone"
                      name="contact1HomePhone"
                      required
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500"
                    />
                  </div>
                  
                  <div>
                    <label htmlFor="contact1WorkPhone" className="block text-sm font-medium text-gray-700 mb-1">
                      Work #
                    </label>
                    <input
                      type="tel"
                      id="contact1WorkPhone"
                      name="contact1WorkPhone"
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500"
                    />
                  </div>
                  
                  <div>
                    <label htmlFor="contact1CellPhone" className="block text-sm font-medium text-gray-700 mb-1">
                      Cell #<span className="text-red-500">*</span>
                    </label>
                    <input
                      type="tel"
                      id="contact1CellPhone"
                      name="contact1CellPhone"
                      required
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500"
                    />
                  </div>
                </div>
                
                <h3 className="text-lg font-medium text-gray-800 dark:text-foreground mt-6 mb-3">PORTAL ACCESS (YOUR EMAIL IS YOUR LOGIN)</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label htmlFor="contact1Email" className="block text-sm font-medium text-gray-700 mb-1">
                      Email<span className="text-red-500">*</span>
                    </label>
                    <input
                      type="email"
                      id="contact1Email"
                      name="contact1Email"
                      required
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500"
                    />
                    <p className="text-xs text-gray-500 mt-1">(Emails are kept confidential)</p>
                  </div>
                  
                  <div>
                    <label htmlFor="contact1EmailConfirm" className="block text-sm font-medium text-gray-700 mb-1">
                      Confirm Email<span className="text-red-500">*</span>
                    </label>
                    <input
                      type="email"
                      id="contact1EmailConfirm"
                      name="contact1EmailConfirm"
                      required
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500"
                    />
                  </div>
                  
                  <div>
                    <label htmlFor="portalPassword" className="block text-sm font-medium text-gray-700 mb-1">
                      Portal Account Password
                    </label>
                    <input
                      type="password"
                      id="portalPassword"
                      name="portalPassword"
                      minLength={5}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500"
                    />
                    <p className="text-xs text-gray-500 mt-1">Minimum number of characters is 5</p>
                  </div>
                  
                  <div>
                    <label htmlFor="portalPasswordConfirm" className="block text-sm font-medium text-gray-700 mb-1">
                      Confirm Portal Account Password
                    </label>
                    <input
                      type="password"
                      id="portalPasswordConfirm"
                      name="portalPasswordConfirm"
                      minLength={5}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500"
                    />
                    <p className="text-xs text-gray-500 mt-1">Minimum number of characters is 5</p>
                  </div>
                </div>
                
                <h3 className="text-lg font-medium text-gray-800 dark:text-foreground mt-6 mb-3">WHO IS YOUR EMPLOYER?</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label htmlFor="contact1Employer" className="block text-sm font-medium text-gray-700 mb-1">
                      Employer
                    </label>
                    <input
                      type="text"
                      id="contact1Employer"
                      name="contact1Employer"
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500"
                    />
                  </div>
                  
                  <div>
                    <label htmlFor="contact1EmployerPhone" className="block text-sm font-medium text-gray-700 mb-1">
                      Employer Phone
                    </label>
                    <input
                      type="tel"
                      id="contact1EmployerPhone"
                      name="contact1EmployerPhone"
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500"
                    />
                  </div>
                  
                  <div className="md:col-span-2">
                    <label htmlFor="contact1EmployerNotes" className="block text-sm font-medium text-gray-700 mb-1">
                      Employer Notes
                    </label>
                    <textarea
                      id="contact1EmployerNotes"
                      name="contact1EmployerNotes"
                      rows={3}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500"
                    ></textarea>
                  </div>
                </div>
                
                <div className="flex justify-between mt-8">
                  <Button
                    type="button"
                    onClick={prevStep}
                    variant="secondary"
                    className="font-bold py-3 px-6"
                  >
                    Back
                  </Button>
                  <Button
                    type="button"
                    onClick={nextStep}
                    className="font-bold py-3 px-6"
                  >
                    Continue
                  </Button>
                </div>
              </div>
            )}
            
            {currentStep === 3 && (
              <div>
                <h2 className="text-xl font-semibold text-foreground mb-4 pb-2 border-b border-border">CONTACT #2</h2>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <div>
                    <label htmlFor="contact2FirstName" className="block text-sm font-medium text-gray-700 mb-1">
                      Contact #2 First Name<span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      id="contact2FirstName"
                      name="contact2FirstName"
                      required
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500"
                    />
                  </div>
                  
                  <div>
                    <label htmlFor="contact2LastName" className="block text-sm font-medium text-gray-700 mb-1">
                      Last Name<span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      id="contact2LastName"
                      name="contact2LastName"
                      required
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500"
                    />
                  </div>
                  
                  <div>
                    <label htmlFor="contact2Type" className="block text-sm font-medium text-gray-700 mb-1">
                      Type<span className="text-red-500">*</span>
                    </label>
                    <select
                      id="contact2Type"
                      name="contact2Type"
                      required
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500"
                    >
                      <option value="">Select relationship</option>
                      <option value="Father">Father</option>
                      <option value="Mother">Mother</option>
                      <option value="Guardian">Guardian</option>
                      <option value="Other">Other</option>
                    </select>
                  </div>
                </div>
                
                <h3 className="text-lg font-medium text-gray-800 dark:text-foreground mt-6 mb-3">HOW CAN WE CONTACT YOU?</h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <div>
                    <label htmlFor="contact2HomePhone" className="block text-sm font-medium text-gray-700 mb-1">
                      Home Phone<span className="text-red-500">*</span>
                    </label>
                    <input
                      type="tel"
                      id="contact2HomePhone"
                      name="contact2HomePhone"
                      required
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500"
                    />
                  </div>
                  
                  <div>
                    <label htmlFor="contact2WorkPhone" className="block text-sm font-medium text-gray-700 mb-1">
                      Work #
                    </label>
                    <input
                      type="tel"
                      id="contact2WorkPhone"
                      name="contact2WorkPhone"
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500"
                    />
                  </div>
                  
                  <div>
                    <label htmlFor="contact2CellPhone" className="block text-sm font-medium text-gray-700 mb-1">
                      Cell #<span className="text-red-500">*</span>
                    </label>
                    <input
                      type="tel"
                      id="contact2CellPhone"
                      name="contact2CellPhone"
                      required
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500"
                    />
                  </div>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-6">
                  <div>
                    <label htmlFor="contact2Email" className="block text-sm font-medium text-gray-700 mb-1">
                      Email<span className="text-red-500">*</span>
                    </label>
                    <input
                      type="email"
                      id="contact2Email"
                      name="contact2Email"
                      required
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500"
                    />
                    <p className="text-xs text-gray-500 mt-1">(Emails are kept confidential)</p>
                  </div>
                  
                  <div>
                    <label htmlFor="contact2EmailConfirm" className="block text-sm font-medium text-gray-700 mb-1">
                      Confirm Email<span className="text-red-500">*</span>
                    </label>
                    <input
                      type="email"
                      id="contact2EmailConfirm"
                      name="contact2EmailConfirm"
                      required
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500"
                    />
                  </div>
                </div>
                
                <h3 className="text-lg font-medium text-gray-800 dark:text-foreground mt-6 mb-3">WHO IS YOUR EMPLOYER?</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label htmlFor="contact2Employer" className="block text-sm font-medium text-gray-700 mb-1">
                      Employer
                    </label>
                    <input
                      type="text"
                      id="contact2Employer"
                      name="contact2Employer"
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500"
                    />
                  </div>
                  
                  <div>
                    <label htmlFor="contact2EmployerPhone" className="block text-sm font-medium text-gray-700 mb-1">
                      Employer Phone
                    </label>
                    <input
                      type="tel"
                      id="contact2EmployerPhone"
                      name="contact2EmployerPhone"
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500"
                    />
                  </div>
                  
                  <div className="md:col-span-2">
                    <label htmlFor="contact2EmployerNotes" className="block text-sm font-medium text-gray-700 mb-1">
                      Employer Notes
                    </label>
                    <textarea
                      id="contact2EmployerNotes"
                      name="contact2EmployerNotes"
                      rows={3}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500"
                    ></textarea>
                  </div>
                </div>
                
                <div className="flex justify-between mt-8">
                  <Button
                    type="button"
                    onClick={prevStep}
                    variant="secondary"
                    className="font-bold py-3 px-6"
                  >
                    Back
                  </Button>
                  <Button
                    type="button"
                    onClick={nextStep}
                    className="font-bold py-3 px-6"
                  >
                    Continue
                  </Button>
                </div>
              </div>
            )}
            
            {currentStep === 4 && (
              <div>
                {students.map((student, index) => (
                  <div key={student.id} className="mb-8 pb-8 border-b border-border">
                    <h2 className="text-xl font-semibold text-gray-800 dark:text-foreground mb-4">STUDENT #{index + 1}</h2>
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
                          className="focus:ring-green-500"
                        />
                      </div>
                      
                      <div>
                        <Label htmlFor={`student${index}Gender`} className="block text-sm font-medium mb-1">
                          Student Gender<span className="text-red-500">*</span>
                        </Label>
                        <Select name={`students[${index}].gender`} required>
                          <SelectTrigger id={`student${index}Gender`} className="w-full">
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
                    
                    <h3 className="text-lg font-medium text-gray-800 dark:text-foreground mt-6 mb-3">ADDITIONAL INFO</h3>
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
                          <SelectTrigger id={`student${index}TShirtSize`} className="w-full">
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
                        <label htmlFor={`student${index}School`} className="block text-sm font-medium text-gray-700 mb-1">
                          School<span className="text-red-500">*</span>
                        </label>
                        <input
                          type="text"
                          id={`student${index}School`}
                          name={`students[${index}].school`}
                          required
                          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500"
                        />
                      </div>
                      
                      <div>
                        <label htmlFor={`student${index}GradeLevel`} className="block text-sm font-medium text-gray-700 mb-1">
                          Grade Level<span className="text-red-500">*</span>
                        </label>
                        <select
                          id={`student${index}GradeLevel`}
                          name={`students[${index}].gradeLevel`}
                          required
                          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500"
                        >
                          <option value="">Select grade</option>
                          <option value="K">Kindergarten</option>
                          <option value="1">1st Grade</option>
                          <option value="2">2nd Grade</option>
                          <option value="3">3rd Grade</option>
                          <option value="4">4th Grade</option>
                          <option value="5">5th Grade</option>
                          <option value="6">6th Grade</option>
                          <option value="7">7th Grade</option>
                          <option value="8">8th Grade</option>
                          <option value="9">9th Grade</option>
                          <option value="10">10th Grade</option>
                          <option value="11">11th Grade</option>
                          <option value="12">12th Grade</option>
                        </select>
                      </div>
                      
                      <div className="md:col-span-2">
                        <label htmlFor={`student${index}SpecialNeeds`} className="block text-sm font-medium text-gray-700 mb-1">
                          Special Needs (Leave blank if NONE)
                        </label>
                        <input
                          type="text"
                          id={`student${index}SpecialNeeds`}
                          name={`students[${index}].specialNeeds`}
                          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500"
                        />
                      </div>
                      
                      <div className="md:col-span-2">
                        <label htmlFor={`student${index}Allergies`} className="block text-sm font-medium text-gray-700 mb-1">
                          Allergies (Leave blank if NONE)
                        </label>
                        <textarea
                          id={`student${index}Allergies`}
                          name={`students[${index}].allergies`}
                          rows={3}
                          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500"
                        ></textarea>
                      </div>
                      
                      <div className="md:col-span-2">
                        <label htmlFor={`student${index}Medications`} className="block text-sm font-medium text-gray-700 mb-1">
                          Medications (Leave blank if NONE)
                        </label>
                        <textarea
                          id={`student${index}Medications`}
                          name={`students[${index}].medications`}
                          rows={3}
                          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500"
                        ></textarea>
                      </div>
                      
                      <div>
                        <label htmlFor={`student${index}Immunizations`} className="block text-sm font-medium text-gray-700 mb-1">
                          Immunizations YN
                        </label>
                        <select
                          id={`student${index}Immunizations`}
                          name={`students[${index}].immunizationsUpToDate`}
                          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500"
                        >
                          <option value="No">No</option>
                          <option value="Yes">Yes</option>
                        </select>
                      </div>
                      
                      <div className="md:col-span-2">
                        <label htmlFor={`student${index}ImmunizationNotes`} className="block text-sm font-medium text-gray-700 mb-1">
                          Immunization Notes
                        </label>
                        <textarea
                          id={`student${index}ImmunizationNotes`}
                          name={`students[${index}].immunizationNotes`}
                          rows={3}
                          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500"
                        ></textarea>
                      </div>
                      
                      <div>
                        <label htmlFor={`student${index}BeltRank`} className="block text-sm font-medium text-gray-700 mb-1">
                          Belt Rank
                        </label>
                        <select
                          id={`student${index}BeltRank`}
                          name={`students[${index}].beltRank`}
                          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500"
                        >
                          <option value="white">White</option>
                          <option value="yellow">Yellow</option>
                          <option value="orange">Orange</option>
                          <option value="green">Green</option>
                          <option value="blue">Blue</option>
                          <option value="purple">Purple</option>
                          <option value="brown">Brown</option>
                          <option value="black">Black</option>
                        </select>
                      </div>
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
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M10 5a1 1 0 011 1v3h3a1 1 0 110 2h-3v3a1 1 0 11-2 0v-3H6a1 1 0 110-2h3V6a1 1 0 011-1z" clipRule="evenodd" />
                    </svg>
                    ADD ANOTHER STUDENT
                  </Button>
                </div>
                
                <div className="flex justify-between mt-8">
                  <Button
                    type="button"
                    onClick={prevStep}
                    variant="secondary"
                    className="font-bold py-3 px-6"
                  >
                    Back
                  </Button>
                  <Button
                    type="button"
                    onClick={nextStep}
                    className="font-bold py-3 px-6"
                  >
                    Continue
                  </Button>
                </div>
              </div>
            )}
            
            {currentStep === 5 && (
              <div>
                <h2 className="text-xl font-semibold text-foreground mb-4 pb-2 border-b border-border">REQUIRED POLICIES</h2>
                
                <div className="space-y-6">
                  <div className="bg-muted p-4 rounded-md text-foreground">
                    <div className="flex items-start space-x-3">
                      <Checkbox id="photoRelease" name="photoRelease" required />
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
                  
                  <div className="bg-muted p-4 rounded-md text-foreground">
                    <div className="flex items-start space-x-3">
                      <Checkbox id="liability" name="liability" required />
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
                  
                  <div className="bg-muted p-4 rounded-md">
                    <div className="flex items-start space-x-3">
                      <Checkbox id="conduct" name="conduct" required />
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
                  
                  <div className="bg-muted p-4 rounded-md">
                    <div className="flex items-start space-x-3">
                      <Checkbox id="payment" name="payment" required />
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
                  
                  <div className="bg-muted p-4 rounded-md">
                    <div className="flex items-start space-x-3">
                      <Checkbox id="attire" name="attire" required />
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
                  
                  <div className="bg-muted p-4 rounded-md">
                    <div className="flex items-start space-x-3">
                      <Checkbox id="agreeAll" name="agreeAll" required />
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
                    <p className="text-sm text-gray-500 mt-1">
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
                
                <div className="flex justify-between mt-8">
                  <Button
                    type="button"
                    onClick={prevStep}
                    variant="secondary"
                    className="font-bold py-3 px-6"
                  >
                    Back
                  </Button>
                  <Button
                    type="submit"
                    className="font-bold py-3 px-6"
                  >
                    SUBMIT REGISTRATION
                  </Button>
                </div>
                
              </div>
            )}
          </Form>
        </div>
      </div>
    </div>
  );
}
