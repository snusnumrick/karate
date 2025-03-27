// Define the core data models for the application

export interface Family {
  id: string;
  name: string;
  address: string;
  city: string;
  province: string;
  postalCode: string;
  primaryPhone: string;
  email: string;
  referralSource?: string;
  referralName?: string;
  guardians: Guardian[];
  students: Student[];
}

export interface Guardian {
  id: string;
  firstName: string;
  lastName: string;
  relationship: string;
  homePhone: string;
  workPhone?: string;
  cellPhone: string;
  email: string;
  employer?: string;
  employerPhone?: string;
  employerNotes?: string;
}

export interface Student {
  id: string;
  firstName: string;
  lastName: string;
  gender: string;
  birthDate: string;
  cellPhone?: string;
  email?: string;
  tShirtSize: string;
  school: string;
  gradeLevel: string;
  specialNeeds?: string;
  allergies?: string;
  medications?: string;
  immunizationsUpToDate: boolean;
  immunizationNotes?: string;
  beltRank: string;
  familyId: string;
  achievements?: Achievement[];
  attendanceRecords?: AttendanceRecord[];
}

export interface Achievement {
  id: string;
  studentId: string;
  type: string;
  description: string;
  awardedDate: string;
}

export interface AttendanceRecord {
  id: string;
  studentId: string;
  classDate: string;
  present: boolean;
  notes?: string;
}

export interface Payment {
  id: string;
  familyId: string;
  amount: number;
  paymentDate: string;
  paymentMethod: string;
  status: 'pending' | 'completed' | 'failed';
  studentIds: string[]; // Which students this payment covers
}

export interface Waiver {
  id: string;
  title: string;
  description: string;
  content: string;
  required: boolean;
}

export interface WaiverSignature {
  id: string;
  waiverId: string;
  userId: string;
  signatureData: string;
  signedAt: string;
}

export interface UserProfile {
  id: string;
  email: string;
  role: 'user' | 'admin' | 'instructor';
  familyId?: string;
}
