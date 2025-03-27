// Define the core data models for the application

export interface Family {
  id: string;
  name: string;
  address: string;
  phone: string;
  email: string;
  guardians: Guardian[];
  students: Student[];
}

export interface Guardian {
  id: string;
  name: string;
  relationship: string;
  phone: string;
  email: string;
}

export interface Student {
  id: string;
  name: string;
  birthDate: string;
  beltRank: string;
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
