import { useState } from "react";
import { Link, Form } from "@remix-run/react";

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
    <div className="min-h-screen bg-green-50 py-12">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="bg-white p-8 rounded-lg shadow-md">
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
            <div className="w-full bg-gray-200 rounded-full h-2.5">
              <div 
                className="bg-green-600 h-2.5 rounded-full" 
                style={{ width: `${(currentStep / 5) * 100}%` }}
              ></div>
            </div>
            <p className="text-center mt-2 text-sm text-gray-600">Step {currentStep} of 5</p>
          </div>
          
          <Form method="post" className="space-y-8">
            {currentStep === 1 && (
              <div>
                <h2 className="text-xl font-semibold text-gray-800 mb-4 pb-2 border-b">REFERRAL INFORMATION</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label htmlFor="referralSource" className="block text-sm font-medium text-gray-700 mb-1">
                      How did you hear about us?<span className="text-red-500">*</span>
                    </label>
                    <select
                      id="referralSource"
                      name="referralSource"
                      required
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500"
                    >
                      <option value="">Select an option</option>
                      <option value="friend">Friend</option>
                      <option value="social">Social Media</option>
                      <option value="search">Search Engine</option>
                      <option value="flyer">Flyer</option>
                      <option value="event">Event</option>
                      <option value="other">Other</option>
                    </select>
                  </div>
                  
                  <div>
                    <label htmlFor="referralName" className="block text-sm font-medium text-gray-700 mb-1">
                      Referral Name
                    </label>
                    <input
                      type="text"
                      id="referralName"
                      name="referralName"
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500"
                    />
                  </div>
                </div>
                
                <h2 className="text-xl font-semibold text-gray-800 mt-8 mb-4 pb-2 border-b">FAMILY INFORMATION</h2>
                <div>
                  <label htmlFor="familyName" className="block text-sm font-medium text-gray-700 mb-1">
                    Family Last Name<span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    id="familyName"
                    name="familyName"
                    required
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500"
                  />
                </div>
                
                <h2 className="text-xl font-semibold text-gray-800 mt-8 mb-4 pb-2 border-b">WHERE DO YOU LIVE?</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="md:col-span-2">
                    <label htmlFor="address" className="block text-sm font-medium text-gray-700 mb-1">
                      Home Address<span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      id="address"
                      name="address"
                      required
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500"
                    />
                  </div>
                  
                  <div>
                    <label htmlFor="city" className="block text-sm font-medium text-gray-700 mb-1">
                      City<span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      id="city"
                      name="city"
                      required
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500"
                    />
                  </div>
                  
                  <div>
                    <label htmlFor="province" className="block text-sm font-medium text-gray-700 mb-1">
                      Province<span className="text-red-500">*</span>
                    </label>
                    <select
                      id="province"
                      name="province"
                      required
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500"
                    >
                      <option value="">Select a province</option>
                      <option value="AB">Alberta</option>
                      <option value="BC">British Columbia</option>
                      <option value="MB">Manitoba</option>
                      <option value="NB">New Brunswick</option>
                      <option value="NL">Newfoundland and Labrador</option>
                      <option value="NS">Nova Scotia</option>
                      <option value="ON">Ontario</option>
                      <option value="PE">Prince Edward Island</option>
                      <option value="QC">Quebec</option>
                      <option value="SK">Saskatchewan</option>
                      <option value="NT">Northwest Territories</option>
                      <option value="NU">Nunavut</option>
                      <option value="YT">Yukon</option>
                    </select>
                  </div>
                  
                  <div>
                    <label htmlFor="postalCode" className="block text-sm font-medium text-gray-700 mb-1">
                      Postal Code<span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      id="postalCode"
                      name="postalCode"
                      required
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500"
                    />
                  </div>
                  
                  <div>
                    <label htmlFor="primaryPhone" className="block text-sm font-medium text-gray-700 mb-1">
                      Primary Phone<span className="text-red-500">*</span>
                    </label>
                    <input
                      type="tel"
                      id="primaryPhone"
                      name="primaryPhone"
                      required
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500"
                    />
                  </div>
                </div>
                
                <div className="mt-8">
                  <button
                    type="button"
                    onClick={nextStep}
                    className="w-full bg-green-600 text-white font-bold py-3 px-4 rounded-lg hover:bg-green-700 transition"
                  >
                    Continue to Additional Info
                  </button>
                </div>
              </div>
            )}
            
            {currentStep === 2 && (
              <div>
                <h2 className="text-xl font-semibold text-gray-800 mb-4 pb-2 border-b">ADDITIONAL INFO</h2>
                <div className="space-y-6">
                  <div>
                    <label htmlFor="emergencyContact" className="block text-sm font-medium text-gray-700 mb-1">
                      Emergency Contact Info (Not Contact #1 or #2)<span className="text-red-500">*</span>
                    </label>
                    <textarea
                      id="emergencyContact"
                      name="emergencyContact"
                      required
                      rows={3}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500"
                    ></textarea>
                  </div>
                  
                  <div>
                    <label htmlFor="healthNumber" className="block text-sm font-medium text-gray-700 mb-1">
                      Personal Health Number
                    </label>
                    <textarea
                      id="healthNumber"
                      name="healthNumber"
                      rows={3}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500"
                    ></textarea>
                  </div>
                </div>
                
                <h2 className="text-xl font-semibold text-gray-800 mt-8 mb-4 pb-2 border-b">CONTACT #1</h2>
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
                
                <h3 className="text-lg font-medium text-gray-800 mt-6 mb-3">HOW CAN WE CONTACT YOU?</h3>
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
                
                <h3 className="text-lg font-medium text-gray-800 mt-6 mb-3">PORTAL ACCESS (YOUR EMAIL IS YOUR LOGIN)</h3>
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
                
                <h3 className="text-lg font-medium text-gray-800 mt-6 mb-3">WHO IS YOUR EMPLOYER?</h3>
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
                  <button
                    type="button"
                    onClick={prevStep}
                    className="bg-gray-300 text-gray-800 font-bold py-3 px-6 rounded-lg hover:bg-gray-400 transition"
                  >
                    Back
                  </button>
                  <button
                    type="button"
                    onClick={nextStep}
                    className="bg-green-600 text-white font-bold py-3 px-6 rounded-lg hover:bg-green-700 transition"
                  >
                    Continue
                  </button>
                </div>
              </div>
            )}
            
            {currentStep === 3 && (
              <div>
                <h2 className="text-xl font-semibold text-gray-800 mb-4 pb-2 border-b">CONTACT #2</h2>
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
                
                <h3 className="text-lg font-medium text-gray-800 mt-6 mb-3">HOW CAN WE CONTACT YOU?</h3>
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
                
                <h3 className="text-lg font-medium text-gray-800 mt-6 mb-3">WHO IS YOUR EMPLOYER?</h3>
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
                  <button
                    type="button"
                    onClick={prevStep}
                    className="bg-gray-300 text-gray-800 font-bold py-3 px-6 rounded-lg hover:bg-gray-400 transition"
                  >
                    Back
                  </button>
                  <button
                    type="button"
                    onClick={nextStep}
                    className="bg-green-600 text-white font-bold py-3 px-6 rounded-lg hover:bg-green-700 transition"
                  >
                    Continue
                  </button>
                </div>
              </div>
            )}
            
            {currentStep === 4 && (
              <div>
                {students.map((student, index) => (
                  <div key={student.id} className="mb-8 pb-8 border-b border-gray-200">
                    <h2 className="text-xl font-semibold text-gray-800 mb-4">STUDENT #{index + 1}</h2>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div>
                        <label htmlFor={`student${index}FirstName`} className="block text-sm font-medium text-gray-700 mb-1">
                          Student's First Name<span className="text-red-500">*</span>
                        </label>
                        <input
                          type="text"
                          id={`student${index}FirstName`}
                          name={`students[${index}].firstName`}
                          required
                          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500"
                        />
                      </div>
                      
                      <div>
                        <label htmlFor={`student${index}LastName`} className="block text-sm font-medium text-gray-700 mb-1">
                          Last Name<span className="text-red-500">*</span>
                        </label>
                        <input
                          type="text"
                          id={`student${index}LastName`}
                          name={`students[${index}].lastName`}
                          required
                          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500"
                        />
                      </div>
                      
                      <div>
                        <label htmlFor={`student${index}Gender`} className="block text-sm font-medium text-gray-700 mb-1">
                          Student Gender<span className="text-red-500">*</span>
                        </label>
                        <select
                          id={`student${index}Gender`}
                          name={`students[${index}].gender`}
                          required
                          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500"
                        >
                          <option value="">Select gender</option>
                          <option value="Male">Male</option>
                          <option value="Female">Female</option>
                          <option value="Other">Other</option>
                        </select>
                      </div>
                      
                      <div>
                        <label htmlFor={`student${index}BirthDate`} className="block text-sm font-medium text-gray-700 mb-1">
                          Birth Date<span className="text-red-500">*</span>
                        </label>
                        <input
                          type="date"
                          id={`student${index}BirthDate`}
                          name={`students[${index}].birthDate`}
                          required
                          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500"
                        />
                      </div>
                      
                      <div>
                        <label htmlFor={`student${index}Cell`} className="block text-sm font-medium text-gray-700 mb-1">
                          Cell #
                        </label>
                        <input
                          type="tel"
                          id={`student${index}Cell`}
                          name={`students[${index}].cellPhone`}
                          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500"
                        />
                      </div>
                    </div>
                    
                    <h3 className="text-lg font-medium text-gray-800 mt-6 mb-3">ADDITIONAL INFO</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div>
                        <label htmlFor={`student${index}Email`} className="block text-sm font-medium text-gray-700 mb-1">
                          Student Email
                        </label>
                        <input
                          type="email"
                          id={`student${index}Email`}
                          name={`students[${index}].email`}
                          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500"
                        />
                      </div>
                      
                      <div>
                        <label htmlFor={`student${index}TShirtSize`} className="block text-sm font-medium text-gray-700 mb-1">
                          T-Shirt Size<span className="text-red-500">*</span>
                        </label>
                        <select
                          id={`student${index}TShirtSize`}
                          name={`students[${index}].tShirtSize`}
                          required
                          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500"
                        >
                          <option value="">Select size</option>
                          <option value="YXS">Youth XS</option>
                          <option value="YS">Youth S</option>
                          <option value="YM">Youth M</option>
                          <option value="YL">Youth L</option>
                          <option value="YXL">Youth XL</option>
                          <option value="AS">Adult S</option>
                          <option value="AM">Adult M</option>
                          <option value="AL">Adult L</option>
                          <option value="AXL">Adult XL</option>
                          <option value="A2XL">Adult 2XL</option>
                        </select>
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
                  <button
                    type="button"
                    onClick={addStudent}
                    className="flex items-center justify-center w-full py-2 px-4 border border-green-600 text-green-600 rounded-md hover:bg-green-50 transition"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M10 5a1 1 0 011 1v3h3a1 1 0 110 2h-3v3a1 1 0 11-2 0v-3H6a1 1 0 110-2h3V6a1 1 0 011-1z" clipRule="evenodd" />
                    </svg>
                    ADD ANOTHER STUDENT
                  </button>
                </div>
                
                <div className="flex justify-between mt-8">
                  <button
                    type="button"
                    onClick={prevStep}
                    className="bg-gray-300 text-gray-800 font-bold py-3 px-6 rounded-lg hover:bg-gray-400 transition"
                  >
                    Back
                  </button>
                  <button
                    type="button"
                    onClick={nextStep}
                    className="bg-green-600 text-white font-bold py-3 px-6 rounded-lg hover:bg-green-700 transition"
                  >
                    Continue
                  </button>
                </div>
              </div>
            )}
            
            {currentStep === 5 && (
              <div>
                <h2 className="text-xl font-semibold text-gray-800 mb-4 pb-2 border-b">REQUIRED POLICIES</h2>
                
                <div className="space-y-6">
                  <div className="bg-gray-50 p-4 rounded-md">
                    <div className="flex items-start">
                      <div className="flex items-center h-5">
                        <input
                          id="photoRelease"
                          name="photoRelease"
                          type="checkbox"
                          required
                          className="h-4 w-4 text-green-600 border-gray-300 rounded"
                        />
                      </div>
                      <div className="ml-3">
                        <label htmlFor="photoRelease" className="font-medium text-gray-700">Photo / Video Release</label>
                        <p className="text-gray-500 text-sm">
                          I give permission for my child to be photographed or videotaped during karate activities. 
                          I understand these images may be used for promotional purposes including social media, website, and printed materials.
                        </p>
                      </div>
                    </div>
                  </div>
                  
                  <div className="bg-gray-50 p-4 rounded-md">
                    <div className="flex items-start">
                      <div className="flex items-center h-5">
                        <input
                          id="liability"
                          name="liability"
                          type="checkbox"
                          required
                          className="h-4 w-4 text-green-600 border-gray-300 rounded"
                        />
                      </div>
                      <div className="ml-3">
                        <label htmlFor="liability" className="font-medium text-gray-700">Release of Liability & Assumption of Risk</label>
                        <p className="text-gray-500 text-sm">
                          I understand that participation in karate involves physical activity and carries inherent risks. 
                          I release Karate Greenegin, its instructors, and staff from liability for injuries sustained during participation.
                        </p>
                      </div>
                    </div>
                  </div>
                  
                  <div className="bg-gray-50 p-4 rounded-md">
                    <div className="flex items-start">
                      <div className="flex items-center h-5">
                        <input
                          id="conduct"
                          name="conduct"
                          type="checkbox"
                          required
                          className="h-4 w-4 text-green-600 border-gray-300 rounded"
                        />
                      </div>
                      <div className="ml-3">
                        <label htmlFor="conduct" className="font-medium text-gray-700">Code Of Conduct Agreement</label>
                        <p className="text-gray-500 text-sm">
                          I agree that my child will follow all rules and guidelines set by the instructors, 
                          show respect to all participants, and maintain appropriate behavior during all activities.
                        </p>
                      </div>
                    </div>
                  </div>
                  
                  <div className="bg-gray-50 p-4 rounded-md">
                    <div className="flex items-start">
                      <div className="flex items-center h-5">
                        <input
                          id="payment"
                          name="payment"
                          type="checkbox"
                          required
                          className="h-4 w-4 text-green-600 border-gray-300 rounded"
                        />
                      </div>
                      <div className="ml-3">
                        <label htmlFor="payment" className="font-medium text-gray-700">Payment Policy</label>
                        <p className="text-gray-500 text-sm">
                          I understand the payment schedule and agree to make timely payments. 
                          I acknowledge that fees are non-refundable and that missed classes cannot be credited.
                        </p>
                      </div>
                    </div>
                  </div>
                  
                  <div className="bg-gray-50 p-4 rounded-md">
                    <div className="flex items-start">
                      <div className="flex items-center h-5">
                        <input
                          id="attire"
                          name="attire"
                          type="checkbox"
                          required
                          className="h-4 w-4 text-green-600 border-gray-300 rounded"
                        />
                      </div>
                      <div className="ml-3">
                        <label htmlFor="attire" className="font-medium text-gray-700">Attire / Dress Code Agreement</label>
                        <p className="text-gray-500 text-sm">
                          I agree that my child will wear the appropriate karate uniform (gi) to all classes 
                          and will maintain proper hygiene and appearance according to dojo guidelines.
                        </p>
                      </div>
                    </div>
                  </div>
                  
                  <div className="bg-gray-50 p-4 rounded-md">
                    <div className="flex items-start">
                      <div className="flex items-center h-5">
                        <input
                          id="agreeAll"
                          name="agreeAll"
                          type="checkbox"
                          required
                          className="h-4 w-4 text-green-600 border-gray-300 rounded"
                        />
                      </div>
                      <div className="ml-3">
                        <label htmlFor="agreeAll" className="font-medium text-gray-700">I AGREE TO ALL OF THE ABOVE</label>
                      </div>
                    </div>
                  </div>
                  
                  <div>
                    <label htmlFor="fullName" className="block text-sm font-medium text-gray-700 mb-1">
                      Enter your Full Name<span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      id="fullName"
                      name="fullName"
                      required
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500"
                    />
                    <p className="text-sm text-gray-500 mt-1">
                      {new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
                    </p>
                  </div>
                  
                  <div>
                    <label htmlFor="comments" className="block text-sm font-medium text-gray-700 mb-1">
                      Comments
                    </label>
                    <textarea
                      id="comments"
                      name="comments"
                      rows={4}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500"
                    ></textarea>
                  </div>
                </div>
                
                <div className="flex justify-between mt-8">
                  <button
                    type="button"
                    onClick={prevStep}
                    className="bg-gray-300 text-gray-800 font-bold py-3 px-6 rounded-lg hover:bg-gray-400 transition"
                  >
                    Back
                  </button>
                  <button
                    type="submit"
                    className="bg-green-600 text-white font-bold py-3 px-6 rounded-lg hover:bg-green-700 transition"
                  >
                    SUBMIT REGISTRATION
                  </button>
                </div>
                
                <div className="mt-8 text-center text-sm text-gray-500">
                  <p>
                    Jackrabbit Technologies' class management platform & registration portal is trusted by
                    1000s of dance studios, gyms, swim schools, music schools, cheer gyms, childcare centers,
                    and more.
                  </p>
                </div>
              </div>
            )}
          </Form>
        </div>
      </div>
    </div>
  );
}
