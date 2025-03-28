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
    <div className="min-h-screen bg-gradient-to-b from-green-100 to-white dark:from-[#020617] dark:to-[#0f172a] py-12 text-foreground">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="bg-white dark:bg-gray-900/50 p-8 rounded-lg shadow-md backdrop-blur-lg border dark:border-gray-800">
          <div className="flex justify-between items-center mb-6">
            <h1 className="text-3xl font-bold text-green-600 dark:text-green-400">Registration</h1>
            <Link to="/app/routes/_layout.login" className="text-green-600 dark:text-green-400 hover:underline">
              Already a customer? Click here to login.
            </Link>
          </div>
          
          <p className="mb-6 text-muted-foreground">
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
                    className="w-full font-bold py-3 px-4 bg-green-600 hover:bg-green-700 text-white"
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
                      className="focus:ring-green-500"
                    />
                  </div>
                  
                  <div>
                    <Label htmlFor="contact1Type" className="block text-sm font-medium mb-1">
                      Type<span className="text-red-500">*</span>
                    </Label>
                    <Select name="contact1Type" required>
                      <SelectTrigger id="contact1Type" className="w-full">
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
                      className="focus:ring-green-500"
                    />
                    <p className="text-xs text-gray-500 mt-1">(Emails are kept confidential)</p>
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
                    <p className="text-xs text-gray-500 mt-1">Minimum number of characters is 5</p>
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
                    <p className="text-xs text-gray-500 mt-1">Minimum number of characters is 5</p>
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
                    className="font-bold py-3 px-6 border-green-600 text-green-600 hover:bg-green-50"
                  >
                    Back
                  </Button>
                  <Button
                    type="button"
                    onClick={nextStep}
                    className="font-bold py-3 px-6 bg-green-600 hover:bg-green-700 text-white"
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
                      className="focus:ring-green-500"
                    />
                  </div>
                  
                  <div>
                    <Label htmlFor="contact2Type" className="block text-sm font-medium mb-1">
                      Type<span className="text-red-500">*</span>
                    </Label>
                    <Select name="contact2Type" required>
                      <SelectTrigger id="contact2Type" className="w-full">
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
                    className="font-bold py-3 px-6 border-green-600 text-green-600 hover:bg-green-50"
                  >
                    Back
                  </Button>
                  <Button
                    type="button"
                    onClick={nextStep}
                    className="font-bold py-3 px-6 bg-green-600 hover:bg-green-700 text-white"
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
                          <SelectTrigger id={`student${index}GradeLevel`} className="w-full">
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
                          <SelectTrigger id={`student${index}Immunizations`} className="w-full">
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
                      
                      <div>
                        <Label htmlFor={`student${index}BeltRank`} className="block text-sm font-medium mb-1">
                          Belt Rank
                        </Label>
                        <Select name={`students[${index}].beltRank`}>
                          <SelectTrigger id={`student${index}BeltRank`} className="w-full">
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
                  <div className="bg-muted/50 dark:bg-gray-800 p-4 rounded-md border dark:border-gray-700 text-foreground">
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
                  
                  <div className="bg-muted/50 dark:bg-gray-800 p-4 rounded-md border dark:border-gray-700">
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
