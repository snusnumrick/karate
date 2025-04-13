// Define the core data models for the application

// Helper type for when we need a Student with its Family data
export type StudentWithFamily = Student & {
    family: Omit<Family, 'students' | 'guardians'> // Prevent recursion
}

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
    emergencyContact?: string;
    healthInfo?: string;
    notes?: string; // Added from supabase type
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
    // beltRank removed, derive from achievements/belt_awards
    familyId: string;
    achievements?: Achievement[]; // Renamed to beltAwards? Keep consistent
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

// Enum for Payment Status
export enum PaymentStatus {
    Pending = 'pending',
    Succeeded = 'succeeded',
    Failed = 'failed',
}

export interface Payment {
    id: string;
    familyId: string;
    subtotalAmount: number;
    // taxAmount removed - tax details are handled via payment_taxes relation
    totalAmount: number; // Amount in cents
    paymentDate?: string;
    paymentMethod?: string;
    status: PaymentStatus; // Use the enum here
    studentIds: string[]; // Which students this payment covers
}

export interface CheckoutSession {
    id: string;
    userId: string;
    paymentId?: string;
    sessionId: string;
    status: string;
    createdAt: string;
    updatedAt: string;
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
