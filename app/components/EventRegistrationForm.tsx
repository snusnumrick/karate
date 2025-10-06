import React, { useState, useEffect, useMemo } from 'react';
import { useFetcher, useNavigate } from '@remix-run/react';
import { Button } from '~/components/ui/button';
import { Input } from '~/components/ui/input';
import { Label } from '~/components/ui/label';
import { Textarea } from '~/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '~/components/ui/select';
import { Checkbox } from '~/components/ui/checkbox';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '~/components/ui/card';
import { Separator } from '~/components/ui/separator';
import { Alert, AlertDescription } from '~/components/ui/alert';
import { EventPaymentForm } from '~/components/EventPaymentForm';
import { AlertCircle, User, Users, CreditCard, CheckCircle } from 'lucide-react';
import type { StudentPaymentDetail } from '~/types/payment';
import {Money, ZERO_MONEY, formatMoney, multiplyMoney, toMoney} from "~/utils/money";

// Event type definition
interface Event {
  id: string;
  title: string;
  description: string | null;
  start_date: string | null;
  end_date: string | null;
  start_time: string | null;
  end_time: string | null;
  location: string | null;
  registration_fee: Money | null;
  max_participants: number | null;
  registration_deadline: string | null;
  status: string;
}

// Types for the registration form
interface StudentRegistration {
  id?: string; // For existing students
  firstName: string;
  lastName: string;
  dateOfBirth: string | null;
  beltRank: string;
  gender?: string;
  school?: string;
  emergencyContactName: string;
  emergencyContactPhone: string;
  emergencyContactRelation: string;
  medicalConditions?: string;
  allergies?: string;
  isExistingStudent: boolean;
}

interface RegistrationFormData {
  students: StudentRegistration[];
  parentFirstName?: string;
  parentLastName?: string;
  parentEmail?: string;
  parentPhone?: string;
  waiverAccepted: boolean;
  marketingOptIn: boolean;
  specialRequests?: string;
  registerSelf: boolean;
  selfParticipant?: {
    firstName: string;
    lastName: string;
    email: string;
  };
  selfParticipantStudentId?: string;
  familyType?: string | null;
}

interface Waiver {
  id: string;
  title: string;
  content: string;
}

interface EventRegistrationFormProps {
  event: Event;
  isAuthenticated: boolean;
  familyData?: {
    familyId: string;
    parentFirstName: string;
    parentLastName: string;
    parentEmail: string;
    parentPhone: string;
    students: Array<{
      id: string;
      firstName: string;
      lastName: string;
      dateOfBirth: string | null;
      beltRank: string;
    }>;
  };
  requiredWaivers?: Waiver[];
  signedWaiverIds?: string[];
  selfRegistrationAllowed?: boolean;
  profileInfo?: {
    firstName: string;
    lastName: string;
    email: string;
  };
  existingSelfStudentId?: string;
  familyType?: 'household' | 'self' | 'organization' | null;
  onSuccess?: (registrationId: string) => void;
}

interface TaxInfo {
  taxName: string;
  taxAmount: Money;
  taxRate: number;
}

interface ActionResponse {
  success?: boolean;
  registrationId?: string;
  paymentRequired?: boolean;
  paymentId?: string;
  error?: string;
  fieldErrors?: Record<string, string>;
  familyId?: string;
  studentIds?: string[];
  message?: string;
  taxes?: TaxInfo[];
  totalTaxAmount?: Money;
  waiverValidationFailed?: boolean;
  missingWaivers?: Array<{ id: string; title: string }>;
}

const beltRanks = [
  'White',
  'Yellow',
  'Orange',
  'Green',
  'Blue',
  'Purple',
  'Brown',
  'Black 1st Dan',
  'Black 2nd Dan',
  'Black 3rd Dan',
  'Black 4th Dan',
  'Black 5th Dan'
];

const emergencyContactRelations = [
  'Parent',
  'Guardian',
  'Grandparent',
  'Sibling',
  'Spouse',
  'Other Family Member',
  'Friend',
  'Other'
];

export function EventRegistrationForm({ 
  event, 
  isAuthenticated, 
  familyData,
  requiredWaivers = [],
  signedWaiverIds = [],
  selfRegistrationAllowed = false,
  profileInfo,
  existingSelfStudentId,
  familyType,
  onSuccess 
}: EventRegistrationFormProps) {
  const fetcher = useFetcher<ActionResponse>();
  const navigate = useNavigate();
  const [currentStep, setCurrentStep] = useState<'registration' | 'payment' | 'success'>('registration');
  const defaultRegisterSelf = selfRegistrationAllowed && (!familyData?.students?.length || familyType === 'self');
  const defaultSelfParticipant = useMemo(
    () => ({
      firstName: profileInfo?.firstName?.trim() ?? '',
      lastName: profileInfo?.lastName?.trim() ?? '',
      email: profileInfo?.email ?? '',
    }),
    [profileInfo]
  );

  const [formData, setFormData] = useState<RegistrationFormData>({
    students: [{
      firstName: '',
      lastName: '',
      dateOfBirth: '',
      beltRank: 'White',
      emergencyContactName: '',
      emergencyContactPhone: '',
      emergencyContactRelation: 'Parent',
      medicalConditions: '',
      allergies: '',
      isExistingStudent: false
    }],
    parentFirstName: familyData?.parentFirstName || profileInfo?.firstName || '',
    parentLastName: familyData?.parentLastName || profileInfo?.lastName || '',
    parentEmail: familyData?.parentEmail || profileInfo?.email || '',
    parentPhone: familyData?.parentPhone || '',
    waiverAccepted: false,
    marketingOptIn: false,
    specialRequests: '',
    registerSelf: defaultRegisterSelf,
    selfParticipant: defaultRegisterSelf ? { ...defaultSelfParticipant } : undefined,
    selfParticipantStudentId: existingSelfStudentId,
    familyType: familyType ?? null,
  });
  const [selectedExistingStudents, setSelectedExistingStudents] = useState<Set<string>>(new Set());
  const [paymentData, setPaymentData] = useState<{
    registrationId: string;
    paymentId: string;
    studentPaymentDetails: StudentPaymentDetail[];
    taxes?: TaxInfo[];
    totalTaxAmount?: Money;
  } | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [registrationResult, setRegistrationResult] = useState<{ familyId: string; studentIds: string[] } | null>(null);
  const [processedResponseId, setProcessedResponseId] = useState<string | null>(null);

  const activeStudents = useMemo(
    () =>
      formData.students.filter((student) =>
        Boolean(student.firstName?.trim() || student.lastName?.trim() || student.id || student.isExistingStudent)
      ),
    [formData.students]
  );
  const hasExistingFamilyStudents = Boolean(familyData?.students?.length);
  const hasManualStudents = activeStudents.length > 0;
  const showStudentInfoCard = !formData.registerSelf || hasExistingFamilyStudents || hasManualStudents;

  // Check for missing waivers
  const missingWaivers = requiredWaivers.filter(waiver => !signedWaiverIds.includes(waiver.id));
  const hasAllRequiredWaivers = missingWaivers.length === 0;

  // Handle form submission response
  useEffect(() => {
    if (fetcher.data) {
      const response = fetcher.data;
      console.log('Registration response received:', response);
      
      // Prevent processing the same response multiple times
      const responseId = response.registrationId || response.paymentId || JSON.stringify(response);
      if (processedResponseId === responseId) {
        console.log('Response already processed, skipping');
        return;
      }
      
      if (response.success && response.registrationId) {
        setProcessedResponseId(responseId);
        if (response.paymentRequired && response.paymentId) {
          console.log('=== PAYMENT REQUIRED - SETTING UP PAYMENT STEP ===');
          console.log('PaymentId:', response.paymentId);
          console.log('RegistrationId:', response.registrationId);
          // Payment required - prepare payment data
          const participants = [
            ...activeStudents.map((student, index) => ({
              studentId: student.id || `student-${index}`,
              firstName: student.firstName,
              lastName: student.lastName,
            })),
          ];

          if (formData.registerSelf) {
            participants.push({
              studentId: existingSelfStudentId || 'self-participant',
              firstName: formData.selfParticipant?.firstName || profileInfo?.firstName || 'Self',
              lastName: formData.selfParticipant?.lastName || profileInfo?.lastName || '',
            });
          }

          const studentPaymentDetails: StudentPaymentDetail[] = participants.map((participant) => ({
            studentId: participant.studentId,
            firstName: participant.firstName,
            lastName: participant.lastName,
            eligibility: { eligible: true, reason: 'Trial' },
            needsPayment: true,
            nextPaymentAmount: event.registration_fee || ZERO_MONEY,
            nextPaymentTierLabel: 'Event Registration Fee',
            pastPaymentCount: 0,
          }));

          setPaymentData({
            registrationId: response.registrationId,
            paymentId: response.paymentId,
            studentPaymentDetails,
            // Coerce serialized Money JSON into Dinero Money objects for client usage
            taxes: (response.taxes || []).map(t => ({
              ...t,
              taxAmount: toMoney(t.taxAmount as unknown)
            })),
            totalTaxAmount: response.totalTaxAmount ? toMoney(response.totalTaxAmount as unknown) : ZERO_MONEY
          });
          setRegistrationResult({
            familyId: response.familyId || familyData?.familyId || 'guest',
            studentIds: response.studentIds || []
          });
          setCurrentStep('payment');
          console.log('=== CURRENT STEP SET TO PAYMENT ===');
        } else {
          // No payment required or free event - show success step
          setRegistrationResult({
            familyId: response.familyId || familyData?.familyId || 'guest',
            studentIds: response.studentIds || []
          });
          setCurrentStep('success');
        }
      } else if (response.error) {
        // Handle specific errors
        if (response.error.includes('already registered')) {
          setErrors({ 
            general: 'One or more students are already registered for this event. Please check your existing registrations or contact us if you need assistance.' 
          });
        } else if (response.waiverValidationFailed) {
          // Handle waiver validation error - show specific message with missing waivers
          const missingWaiverTitles = response.missingWaivers?.map((w: { id: string; title: string }) => w.title).join(', ') || 'required waivers';
          setErrors({ 
            general: `Please sign the following waivers before registering: ${missingWaiverTitles}. You can sign them in the waiver requirements section above.`
          });
        } else {
          setErrors({ general: response.error });
        }
      }
      
      if (response.fieldErrors) {
        setErrors(response.fieldErrors);
      }
    }
  }, [fetcher.data, formData.students, event.registration_fee, onSuccess, familyData?.familyId, processedResponseId]);

  // Add a new student to the registration
  const addStudent = () => {
    setFormData(prev => ({
      ...prev,
      students: [...prev.students, {
        firstName: '',
        lastName: '',
        dateOfBirth: '',
        beltRank: 'White',
        emergencyContactName: prev.students[0]?.emergencyContactName || '',
        emergencyContactPhone: prev.students[0]?.emergencyContactPhone || '',
        emergencyContactRelation: prev.students[0]?.emergencyContactRelation || 'Parent',
        medicalConditions: '',
        allergies: '',
        isExistingStudent: false
      }]
    }));
  };

  // Remove a student from the registration
  const removeStudent = (index: number) => {
    if (formData.students.length > 1) {
      setFormData(prev => ({
        ...prev,
        students: prev.students.filter((_, i) => i !== index)
      }));
    }
  };

  // Update student data
  const updateStudent = (index: number, field: keyof StudentRegistration, value: string | boolean) => {
    setFormData(prev => ({
      ...prev,
      students: prev.students.map((student, i) => 
        i === index ? { ...student, [field]: value } : student
      )
    }));
  };

  // Handle existing student selection
  const handleExistingStudentToggle = (studentId: string, checked: boolean) => {
    const newSelected = new Set(selectedExistingStudents);
    if (checked) {
      newSelected.add(studentId);
      // Add existing student data to form
      const existingStudent = familyData?.students.find(s => s.id === studentId);
      if (existingStudent) {
        setFormData(prev => {
          // Check if student is already added to prevent duplicates
          const isAlreadyAdded = prev.students.some(student => student.id === studentId);
          if (isAlreadyAdded) {
            return prev; // Don't add duplicate
          }
          
          // Find the first empty student slot (where firstName is empty and not an existing student)
          const firstEmptyIndex = prev.students.findIndex(student => 
            !student.firstName && !student.isExistingStudent
          );
          
          const newStudentData = {
            id: existingStudent.id,
            firstName: existingStudent.firstName,
            lastName: existingStudent.lastName,
            dateOfBirth: existingStudent.dateOfBirth,
            beltRank: existingStudent.beltRank,
            emergencyContactName: prev.parentFirstName + ' ' + prev.parentLastName,
            emergencyContactPhone: prev.parentPhone || '',
            emergencyContactRelation: 'Parent',
            isExistingStudent: true
          };
          
          if (firstEmptyIndex !== -1) {
            // Fill the first empty student slot
            const updatedStudents = [...prev.students];
            updatedStudents[firstEmptyIndex] = newStudentData;
            return {
              ...prev,
              students: updatedStudents
            };
          } else {
            // If no empty slots, add as new student
            return {
              ...prev,
              students: [...prev.students, newStudentData]
            };
          }
        });
      }
    } else {
      newSelected.delete(studentId);
      // Remove existing student from form
      setFormData(prev => ({
        ...prev,
        students: prev.students.filter(s => s.id !== studentId)
      }));
    }
    setSelectedExistingStudents(newSelected);
  };

  const handleRegisterSelfToggle = (checked: boolean) => {
    const isChecked = Boolean(checked);
    setFormData((prev) => ({
      ...prev,
      registerSelf: isChecked,
      selfParticipant: isChecked
        ? { ...(prev.selfParticipant ?? defaultSelfParticipant) }
        : prev.selfParticipant,
    }));
  };

  const handleSelfParticipantChange = (
    field: 'firstName' | 'lastName' | 'email',
    value: string
  ) => {
    setFormData((prev) => ({
      ...prev,
      selfParticipant: {
        ...(prev.selfParticipant ?? defaultSelfParticipant),
        [field]: value,
      },
    }));
  };

  const handleAddAnotherParticipant = () => {
    setFormData((prev) => ({
      ...prev,
      registerSelf: false,
    }));
  };

  // Validate form data
  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};

    // Validate parent information for guest users
    if (!isAuthenticated) {
      if (!formData.parentFirstName?.trim()) {
        newErrors.parentFirstName = 'Parent first name is required';
      }
      if (!formData.parentLastName?.trim()) {
        newErrors.parentLastName = 'Parent last name is required';
      }
      if (!formData.parentEmail?.trim()) {
        newErrors.parentEmail = 'Parent email is required';
      } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.parentEmail)) {
        newErrors.parentEmail = 'Please enter a valid email address';
      }
      if (!formData.parentPhone?.trim()) {
        newErrors.parentPhone = 'Parent phone number is required';
      }
    }

    let activeStudentCount = 0;

    formData.students.forEach((student, index) => {
      const hasData = Boolean(
        student.firstName?.trim() ||
        student.lastName?.trim() ||
        student.id ||
        student.isExistingStudent
      );

      if (!hasData) {
        return;
      }

      activeStudentCount++;

      if (!student.firstName?.trim()) {
        newErrors[`student-${index}-firstName`] = 'First name is required';
      }
      if (!student.lastName?.trim()) {
        newErrors[`student-${index}-lastName`] = 'Last name is required';
      }
      if (!student.dateOfBirth) {
        newErrors[`student-${index}-dateOfBirth`] = 'Date of birth is required';
      }
      if (!student.emergencyContactName?.trim()) {
        newErrors[`student-${index}-emergencyContactName`] = 'Emergency contact name is required';
      }
      if (!student.emergencyContactPhone?.trim()) {
        newErrors[`student-${index}-emergencyContactPhone`] = 'Emergency contact phone is required';
      }
    });

    if (activeStudentCount === 0 && !formData.registerSelf) {
      newErrors.students = 'Please add at least one participant.';
    }

    if (formData.registerSelf) {
      const first = formData.selfParticipant?.firstName?.trim();
      const last = formData.selfParticipant?.lastName?.trim();
      const email = formData.selfParticipant?.email?.trim();

      if (!first) {
        newErrors.selfParticipantFirstName = 'Your first name is required';
      }

      if (!last) {
        newErrors.selfParticipantLastName = 'Your last name is required';
      }

      if (!email) {
        newErrors.selfParticipantEmail = 'A contact email is required';
      } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        newErrors.selfParticipantEmail = 'Please provide a valid email address';
      }
    }

    // Validate waiver acceptance
    // Check if all required waivers are signed
    if (requiredWaivers.length > 0 && !hasAllRequiredWaivers) {
      newErrors.waiverAccepted = 'You must sign all required waivers before registering';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  // Handle form submission
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateForm()) {
      return;
    }

    // Prepare form data for submission
    const submitData = new FormData();
    submitData.append('intent', 'register');
    const cleanedSelfParticipant = formData.selfParticipant
      ? {
          firstName: formData.selfParticipant.firstName.trim(),
          lastName: formData.selfParticipant.lastName.trim(),
          email: formData.selfParticipant.email.trim(),
        }
      : undefined;

    const payload: RegistrationFormData = {
      ...formData,
      students: activeStudents,
      selfParticipant: formData.registerSelf ? cleanedSelfParticipant : undefined,
    };

    submitData.append('registrationData', JSON.stringify(payload));
    
    if (isAuthenticated && familyData) {
      submitData.append('familyId', familyData.familyId);
    }

    fetcher.submit(submitData, {
      method: 'POST'
    });
  };

  // Handle payment success
  const handlePaymentSuccess = (paymentId: string, zeroPayment?: boolean) => {
    console.log('=== PAYMENT SUCCESS HANDLER CALLED ===');
    console.log('PaymentId:', paymentId, 'ZeroPayment:', zeroPayment);
    
    if (zeroPayment || !paymentData || paymentId === 'event-payment-success') {
      console.log('=== SETTING SUCCESS STEP ===');
      setProcessedResponseId(null); // Clear processed response to allow success step
      setCurrentStep('success');
    } else {
      console.log('=== NAVIGATING TO PAYMENT PAGE ===');
      navigate(`/pay/${paymentId}`);
    }
  };

  // Handle final success after payment completion
  const handleFinalSuccess = () => {
    if (registrationResult) {
      onSuccess?.(paymentData?.registrationId || '');
    }
  };

  // Render success step
  if (currentStep === 'success') {
    return (
      <div className="max-w-2xl mx-auto space-y-6">
        <Card className="form-container-styles">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CheckCircle className="h-5 w-5" />
              Registration Successful!
            </CardTitle>
            <CardDescription>
              Your registration has been submitted successfully.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="bg-green-50 dark:bg-green-900/20 p-4 rounded-lg">
              <h3 className="font-medium mb-2 text-green-800 dark:text-green-200">Registration Details</h3>
              {fetcher.data?.message && (
                <p className="text-sm text-green-700 dark:text-green-300 mb-2 font-medium">
                  {fetcher.data.message}
                </p>
              )}
              <p className="text-sm text-green-700 dark:text-green-300">
                Event: {event.title}
              </p>
              <p className="text-sm text-green-700 dark:text-green-300">
                Participants Registered: {activeStudents.length + (formData.registerSelf ? 1 : 0)}
              </p>
              {(paymentData?.registrationId || fetcher.data?.registrationId) && (
                <p className="text-sm text-green-700 dark:text-green-300">
                  Registration ID: {paymentData?.registrationId || fetcher.data?.registrationId}
                </p>
              )}
            </div>
            
            <div className="space-y-2">
              <p className="text-sm text-gray-600 dark:text-gray-400">
                You will receive a confirmation email shortly with all the event details and instructions.
              </p>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                If you have any questions, please contact us.
              </p>
            </div>
            
            <div className="flex gap-3 pt-4">
              <Button onClick={handleFinalSuccess} className="flex-1">
                Continue
              </Button>
              <Button 
                variant="outline" 
                onClick={() => navigate('/events')}
              >
                View More Events
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Render payment step
  if (currentStep === 'payment' && registrationResult) {
    return (
      <div className="max-w-2xl mx-auto space-y-6">
        <Card className="form-container-styles">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CreditCard className="h-5 w-5" />
              Complete Registration Payment
            </CardTitle>
            <CardDescription>
              Complete your payment to finalize your event registration.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4 mb-6">
              <div className="bg-gray-50 dark:bg-gray-800 p-4 rounded-lg">
                <h3 className="font-medium mb-2">Registration Summary</h3>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  Event: {event.title}
                </p>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  Participants: {
                    [
                      ...activeStudents.map((s) => `${s.firstName} ${s.lastName}`.trim()),
                      ...(formData.registerSelf
                        ? [
                            `${formData.selfParticipant?.firstName || profileInfo?.firstName || 'Self'} ${
                              formData.selfParticipant?.lastName || profileInfo?.lastName || ''
                            }`.trim(),
                          ]
                        : []),
                    ]
                      .filter(Boolean)
                      .join(', ') || 'None'
                  }
                </p>
                <p className="text-sm font-medium">
                  Total: ${formatMoney(
                    multiplyMoney(
                      event.registration_fee || ZERO_MONEY,
                      activeStudents.length + (formData.registerSelf ? 1 : 0)
                    )
                  )}
                </p>
              </div>
            </div>
            
            <EventPaymentForm
              eventId={event.id}
              eventTitle={event.title}
              registrationFee={event.registration_fee || ZERO_MONEY}
              studentCount={activeStudents.length + (formData.registerSelf ? 1 : 0)}
              familyId={registrationResult.familyId}
              registrationId={paymentData?.registrationId || ''}
              studentIds={registrationResult.studentIds || []}
              actionEndpoint={`/events/${event.id}/register`}
              onSuccess={handlePaymentSuccess}
              taxes={paymentData?.taxes || []}
              totalTaxAmount={paymentData?.totalTaxAmount || ZERO_MONEY}
            />
          </CardContent>
        </Card>
        
        <div className="flex justify-between">
          <Button 
            variant="outline" 
            onClick={() => setCurrentStep('registration')}
          >
            Back to Registration
          </Button>
        </div>
      </div>
    );
  }

  // Render registration form
  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {errors.general && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{errors.general}</AlertDescription>
        </Alert>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Existing Students Selection (for authenticated users) */}
        {isAuthenticated && familyData?.students && familyData.students.length > 0 && (
          <Card className="form-container-styles">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Users className="h-5 w-5" />
                Select Existing Students
              </CardTitle>
              <CardDescription>
                Choose from your existing students to register for this event.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {errors.students && (
                <p className="text-sm text-red-500 mb-3">{errors.students}</p>
              )}
              <div className="space-y-3">
                {familyData.students.map((student) => (
                  <div key={student.id} className="flex items-center space-x-3">
                    <Checkbox
                      id={`existing-${student.id}`}
                      className="checkbox-custom-styles"
                      checked={selectedExistingStudents.has(student.id)}
                      onCheckedChange={(checked) => 
                        handleExistingStudentToggle(student.id, checked as boolean)
                      }
                    />
                    <Label htmlFor={`existing-${student.id}`} className="flex-1">
                      <div>
                        <p className="font-medium">
                          {student.firstName} {student.lastName}
                        </p>
                        <p className="text-sm text-gray-600 dark:text-gray-400">
                          Belt Rank: {student.beltRank}
                        </p>
                      </div>
                    </Label>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {selfRegistrationAllowed && (
          <Card className="form-container-styles">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <User className="h-5 w-5" />
                Register Yourself
              </CardTitle>
              <CardDescription>
                Adults and instructors can register themselves using their account information.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-start space-x-3">
                <Checkbox
                  id="register-self"
                  className="checkbox-custom-styles mt-1"
                  checked={formData.registerSelf}
                  onCheckedChange={(checked) => handleRegisterSelfToggle(checked as boolean)}
                />
                <Label htmlFor="register-self" className="space-y-1">
                  <p className="font-medium">
                    {profileInfo?.firstName || 'Self'} {profileInfo?.lastName || ''}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    We’ll start with your account details—update them below if anything needs to change.
                  </p>
                </Label>
              </div>

              {formData.registerSelf && (
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="selfFirstName">First name</Label>
                    <Input
                      id="selfFirstName"
                      value={formData.selfParticipant?.firstName ?? ''}
                      onChange={(e) => handleSelfParticipantChange('firstName', e.target.value)}
                      aria-invalid={Boolean(errors.selfParticipantFirstName)}
                      className="input-custom-styles"
                    />
                    {errors.selfParticipantFirstName && (
                      <p className="text-sm text-destructive">{errors.selfParticipantFirstName}</p>
                    )}
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="selfLastName">Last name</Label>
                    <Input
                      id="selfLastName"
                      value={formData.selfParticipant?.lastName ?? ''}
                      onChange={(e) => handleSelfParticipantChange('lastName', e.target.value)}
                      aria-invalid={Boolean(errors.selfParticipantLastName)}
                      className="input-custom-styles"
                    />
                    {errors.selfParticipantLastName && (
                      <p className="text-sm text-destructive">{errors.selfParticipantLastName}</p>
                    )}
                  </div>
                  <div className="space-y-2 md:col-span-2">
                    <Label htmlFor="selfEmail">Email</Label>
                    <Input
                      id="selfEmail"
                      type="email"
                      value={formData.selfParticipant?.email ?? ''}
                      onChange={(e) => handleSelfParticipantChange('email', e.target.value)}
                      aria-invalid={Boolean(errors.selfParticipantEmail)}
                      className="input-custom-styles"
                    />
                    {errors.selfParticipantEmail && (
                      <p className="text-sm text-destructive">{errors.selfParticipantEmail}</p>
                    )}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {!showStudentInfoCard && (
          <div className="flex items-center justify-between rounded-lg border border-dashed border-border px-4 py-3 text-sm text-muted-foreground">
            <span>Need to register someone else?</span>
            <Button type="button" variant="outline" size="sm" onClick={handleAddAnotherParticipant}>
              Add participant
            </Button>
          </div>
        )}

        {/* Parent Information (for guest users) */}
        {!isAuthenticated && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <User className="h-5 w-5" />
                Parent/Guardian Information
              </CardTitle>
              <CardDescription>
                Please provide your contact information.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="parentFirstName">First Name *</Label>
                  <Input
                    id="parentFirstName"
                    value={formData.parentFirstName}
                    onChange={(e) => setFormData(prev => ({ ...prev, parentFirstName: e.target.value }))}
                    className={`input-custom-styles ${errors.parentFirstName ? 'border-red-500' : ''}`}
                  />
                  {errors.parentFirstName && (
                    <p className="text-sm text-red-500 mt-1">{errors.parentFirstName}</p>
                  )}
                </div>
                <div>
                  <Label htmlFor="parentLastName">Last Name *</Label>
                  <Input
                    id="parentLastName"
                    value={formData.parentLastName}
                    onChange={(e) => setFormData(prev => ({ ...prev, parentLastName: e.target.value }))}
                    className={`input-custom-styles ${errors.parentLastName ? 'border-red-500' : ''}`}
                  />
                  {errors.parentLastName && (
                    <p className="text-sm text-red-500 mt-1">{errors.parentLastName}</p>
                  )}
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="parentEmail">Email Address *</Label>
                  <Input
                    id="parentEmail"
                    type="email"
                    value={formData.parentEmail}
                    onChange={(e) => setFormData(prev => ({ ...prev, parentEmail: e.target.value }))}
                    className={`input-custom-styles ${errors.parentEmail ? 'border-red-500' : ''}`}
                  />
                  {errors.parentEmail && (
                    <p className="text-sm text-red-500 mt-1">{errors.parentEmail}</p>
                  )}
                </div>
                <div>
                  <Label htmlFor="parentPhone">Phone Number *</Label>
                  <Input
                    id="parentPhone"
                    type="tel"
                    value={formData.parentPhone}
                    onChange={(e) => setFormData(prev => ({ ...prev, parentPhone: e.target.value }))}
                    className={`input-custom-styles ${errors.parentPhone ? 'border-red-500' : ''}`}
                  />
                  {errors.parentPhone && (
                    <p className="text-sm text-red-500 mt-1">{errors.parentPhone}</p>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Student Information */}
        {showStudentInfoCard && (
        <Card>
          <CardHeader>
            <CardTitle>Student Information</CardTitle>
            <CardDescription>
              Provide details for each student you want to register.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {errors.students && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>{errors.students}</AlertDescription>
              </Alert>
        )}
            {formData.students.map((student, index) => (
              <div key={index} className="space-y-4 p-4 border rounded-lg">
                <div className="flex justify-between items-center">
                  <h3 className="font-medium">Student {index + 1}</h3>
                  {formData.students.length > 1 && (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => removeStudent(index)}
                    >
                      Remove
                    </Button>
                  )}
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor={`student-${index}-firstName`}>First Name *</Label>
                    <Input
                      id={`student-${index}-firstName`}
                      value={student.firstName}
                      onChange={(e) => updateStudent(index, 'firstName', e.target.value)}
                      className={`input-custom-styles ${errors[`student-${index}-firstName`] ? 'border-red-500' : ''}`}
                      disabled={student.isExistingStudent}
                    />
                    {errors[`student-${index}-firstName`] && (
                      <p className="text-sm text-red-500 mt-1">{errors[`student-${index}-firstName`]}</p>
                    )}
                  </div>
                  <div>
                    <Label htmlFor={`student-${index}-lastName`}>Last Name *</Label>
                    <Input
                      id={`student-${index}-lastName`}
                      value={student.lastName}
                      onChange={(e) => updateStudent(index, 'lastName', e.target.value)}
                      className={`input-custom-styles ${errors[`student-${index}-lastName`] ? 'border-red-500' : ''}`}
                      disabled={student.isExistingStudent}
                    />
                    {errors[`student-${index}-lastName`] && (
                      <p className="text-sm text-red-500 mt-1">{errors[`student-${index}-lastName`]}</p>
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor={`student-${index}-dateOfBirth`}>Date of Birth *</Label>
                    <Input
                      id={`student-${index}-dateOfBirth`}
                      type="date"
                      value={student.dateOfBirth || ''}
                      onChange={(e) => updateStudent(index, 'dateOfBirth', e.target.value)}
                      className={`input-custom-styles ${errors[`student-${index}-dateOfBirth`] ? 'border-red-500' : ''}`}
                      disabled={student.isExistingStudent}
                    />
                    {errors[`student-${index}-dateOfBirth`] && (
                      <p className="text-sm text-red-500 mt-1">{errors[`student-${index}-dateOfBirth`]}</p>
                    )}
                  </div>
                  <div>
                    <Label htmlFor={`student-${index}-beltRank`}>Current Belt Rank</Label>
                    <Select
                      value={student.beltRank}
                      onValueChange={(value) => updateStudent(index, 'beltRank', value)}
                      disabled={student.isExistingStudent}
                    >
                      <SelectTrigger className="input-custom-styles">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {beltRanks.map((rank) => (
                          <SelectItem key={rank} value={rank}>
                            {rank}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                </div>
              </div>

              <Separator />

                <div className="space-y-4">
                  <h4 className="font-medium">Emergency Contact</h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor={`student-${index}-emergencyContactName`}>Contact Name *</Label>
                      <Input
                        id={`student-${index}-emergencyContactName`}
                        value={student.emergencyContactName}
                        onChange={(e) => updateStudent(index, 'emergencyContactName', e.target.value)}
                        className={`input-custom-styles ${errors[`student-${index}-emergencyContactName`] ? 'border-red-500' : ''}`}
                      />
                      {errors[`student-${index}-emergencyContactName`] && (
                        <p className="text-sm text-red-500 mt-1">{errors[`student-${index}-emergencyContactName`]}</p>
                      )}
                    </div>
                    <div>
                      <Label htmlFor={`student-${index}-emergencyContactPhone`}>Contact Phone *</Label>
                      <Input
                        id={`student-${index}-emergencyContactPhone`}
                        type="tel"
                        value={student.emergencyContactPhone}
                        onChange={(e) => updateStudent(index, 'emergencyContactPhone', e.target.value)}
                        className={`input-custom-styles ${errors[`student-${index}-emergencyContactPhone`] ? 'border-red-500' : ''}`}
                      />
                      {errors[`student-${index}-emergencyContactPhone`] && (
                        <p className="text-sm text-red-500 mt-1">{errors[`student-${index}-emergencyContactPhone`]}</p>
                      )}
                    </div>
                  </div>
                  <div>
                    <Label htmlFor={`student-${index}-emergencyContactRelation`}>Relationship</Label>
                    <Select
                      value={student.emergencyContactRelation}
                      onValueChange={(value) => updateStudent(index, 'emergencyContactRelation', value)}
                    >
                      <SelectTrigger className="input-custom-styles">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {emergencyContactRelations.map((relation) => (
                          <SelectItem key={relation} value={relation}>
                            {relation}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <Separator />

                <div className="space-y-4">
                  <h4 className="font-medium">Medical Information (Optional)</h4>
                  <div>
                    <Label htmlFor={`student-${index}-medicalConditions`}>Medical Conditions</Label>
                    <Textarea
                      id={`student-${index}-medicalConditions`}
                      value={student.medicalConditions}
                      onChange={(e) => updateStudent(index, 'medicalConditions', e.target.value)}
                      placeholder="Any medical conditions we should be aware of..."
                      rows={2}
                      className="input-custom-styles"
                    />
                  </div>
                  <div>
                    <Label htmlFor={`student-${index}-allergies`}>Allergies</Label>
                    <Textarea
                      id={`student-${index}-allergies`}
                      value={student.allergies}
                      onChange={(e) => updateStudent(index, 'allergies', e.target.value)}
                      placeholder="Any allergies we should be aware of..."
                      rows={2}
                      className="input-custom-styles"
                    />
                  </div>
                </div>
              </div>
            ))}
            
            <Button
              type="button"
              variant="outline"
              onClick={addStudent}
              className="w-full"
            >
              Add Another Student
            </Button>
          </CardContent>
        </Card>
        )}

        {/* Additional Information */}
        <Card>
          <CardHeader>
            <CardTitle>Additional Information</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label htmlFor="specialRequests">Special Requests or Notes</Label>
              <Textarea
                id="specialRequests"
                value={formData.specialRequests}
                onChange={(e) => setFormData(prev => ({ ...prev, specialRequests: e.target.value }))}
                placeholder="Any special requests or additional information..."
                rows={3}
                className="input-custom-styles"
              />
            </div>
            
            {/* Waiver Requirements Section */}
            {requiredWaivers.length > 0 && (
              <div className="space-y-4 p-4 border rounded-lg bg-gray-50 dark:bg-gray-800/50">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                  Required Waivers
                </h3>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  The following waivers must be signed before you can register for this event:
                </p>
                
                <div className="space-y-3">
                  {requiredWaivers.map((waiver) => {
                    const isSigned = signedWaiverIds.includes(waiver.id);
                    return (
                      <div key={waiver.id} className="flex items-center justify-between p-3 border rounded bg-white dark:bg-gray-700">
                        <div className="flex-1">
                          <h4 className="font-medium text-gray-900 dark:text-gray-100">
                            {waiver.title}
                          </h4>
                          <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                            {isSigned ? (
                              <span className="text-green-600 dark:text-green-400 flex items-center">
                                <svg className="w-4 h-4 mr-1" fill="currentColor" viewBox="0 0 20 20">
                                  <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                                </svg>
                                Signed
                              </span>
                            ) : (
                              <span className="text-red-600 dark:text-red-400 flex items-center">
                                <svg className="w-4 h-4 mr-1" fill="currentColor" viewBox="0 0 20 20">
                                  <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                                </svg>
                                Not signed
                              </span>
                            )}
                          </p>
                        </div>
                        {!isSigned && (
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            asChild
                          >
                            <a href={`/family/waivers/${waiver.id}/sign?redirectTo=${encodeURIComponent(`/events/${event.id}/register`)}`}>
                              Sign Now
                            </a>
                          </Button>
                        )}
                      </div>
                    );
                  })}
                </div>
                
                {!hasAllRequiredWaivers && (
                  <div className="p-3 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded">
                    <p className="text-sm text-yellow-800 dark:text-yellow-200">
                      <strong>Note:</strong> You must sign all required waivers before you can complete your event registration.
                    </p>
                  </div>
                )}
              </div>
            )}
            
            <div className="space-y-3">
              
              <div className="flex items-start space-x-3">
                <Checkbox
                  id="marketingOptIn"
                  checked={formData.marketingOptIn}
                  onCheckedChange={(checked) => 
                    setFormData(prev => ({ ...prev, marketingOptIn: checked as boolean }))
                  }
                  className="checkbox-custom-styles"
                />
                <div className="space-y-1">
                  <Label htmlFor="marketingOptIn" className="text-sm font-medium">
                    I would like to receive updates about future events and programs
                  </Label>
                  <p className="text-xs text-gray-600 dark:text-gray-400">
                    Optional: Receive notifications about upcoming events, workshops, and special offers.
                  </p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Submit Button */}
        <div className="space-y-3">
          {!hasAllRequiredWaivers && requiredWaivers.length > 0 && (
            <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded">
              <p className="text-sm text-red-800 dark:text-red-200">
                Please sign all required waivers above before proceeding with registration.
              </p>
            </div>
          )}
          
          <div className="flex justify-end space-x-4">
            <Button
              type="submit"
              disabled={fetcher.state === 'submitting' || !hasAllRequiredWaivers}
              className="min-w-32"
            >
              {fetcher.state === 'submitting' ? 'Registering...' : 'Register for Event'}
            </Button>
          </div>
        </div>
      </form>
    </div>
  );
}
