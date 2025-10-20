import { renderToBuffer } from '@react-pdf/renderer';
import { WaiverPDFTemplate } from '~/components/pdf/WaiverPDFTemplate';

export interface WaiverData {
  id: string;
  title: string;
  content: string;
}

export interface SignatureData {
  id: string;
  signedAt: string;
  signatureImage: string; // base64 data URL
}

export interface GuardianData {
  firstName: string;
  lastName: string;
}

export interface StudentData {
  id: string;
  firstName: string;
  lastName: string;
}

export interface ProgramData {
  name: string;
}

export interface GenerateWaiverPDFOptions {
  waiver: WaiverData;
  signature: SignatureData;
  guardian: GuardianData;
  students: StudentData[];
  program?: ProgramData;
}

/**
 * Generate a PDF document for a signed waiver
 *
 * Creates a self-contained legal document with:
 * - Full waiver text
 * - Student name(s) explicitly listed
 * - Guardian signature image
 * - Date/time signed
 * - Unique document ID
 *
 * @param options - Waiver data including signature, guardian, and students
 * @returns PDF buffer ready for storage
 * @throws Error if PDF generation fails
 */
export async function generateWaiverPDF(
  options: GenerateWaiverPDFOptions
): Promise<Buffer> {
  try {
    // Validate required data
    if (!options.waiver) {
      throw new Error('Waiver data is required');
    }

    if (!options.signature || !options.signature.signatureImage) {
      throw new Error('Signature data is required');
    }

    if (!options.guardian) {
      throw new Error('Guardian data is required');
    }

    if (!options.students || options.students.length === 0) {
      throw new Error('At least one student is required');
    }

    // Sanitize text data to prevent font rendering issues
    const sanitizedOptions = {
      waiver: {
        id: options.waiver.id,
        title: sanitizeText(options.waiver.title),
        content: sanitizeText(options.waiver.content),
      },
      signature: {
        id: options.signature.id,
        signedAt: options.signature.signedAt,
        signatureImage: options.signature.signatureImage,
      },
      guardian: {
        firstName: sanitizeText(options.guardian.firstName),
        lastName: sanitizeText(options.guardian.lastName),
      },
      students: options.students.map(student => ({
        id: student.id,
        firstName: sanitizeText(student.firstName),
        lastName: sanitizeText(student.lastName),
      })),
      program: options.program ? {
        name: sanitizeText(options.program.name),
      } : undefined,
    };

    // Generate PDF buffer
    const pdfBuffer = await renderToBuffer(
      WaiverPDFTemplate(sanitizedOptions)
    );

    return pdfBuffer;
  } catch (error) {
    console.error('Error generating waiver PDF:', error);

    // Provide more specific error messages
    if (error instanceof Error) {
      if (error.message.includes('fontkit') || error.message.includes('DataView')) {
        throw new Error('Font rendering error - please try again or contact support');
      }
      if (error.message.includes('Invalid character')) {
        throw new Error('Invalid characters in waiver data - please check text fields');
      }
      // Re-throw validation errors as-is
      if (error.message.includes('required')) {
        throw error;
      }
    }

    throw new Error('Failed to generate waiver PDF');
  }
}

/**
 * Generate a filename for a waiver PDF
 *
 * Format: waiver_StudentName1_StudentName2_YYYY-MM-DD_HHMMSS.pdf
 *
 * @param waiverId - Waiver ID (for uniqueness)
 * @param studentNames - Array of student names
 * @returns Sanitized filename
 */
export function generateWaiverFilename(
  waiverId: string,
  studentNames: string[]
): string {
  const dateStr = new Date().toISOString().replace(/[:.]/g, '-').split('T')[0];
  const timeStr = new Date().toISOString().replace(/[:.]/g, '-').split('T')[1].substring(0, 6);

  // Sanitize and join student names
  const studentStr = studentNames
    .map(name => name.replace(/[^a-zA-Z0-9]/g, '_'))
    .join('_');

  // Truncate student names if too long (max 50 chars)
  const truncatedStudentStr = studentStr.length > 50
    ? studentStr.substring(0, 47) + '...'
    : studentStr;

  // Add waiver ID prefix for uniqueness
  const waiverPrefix = waiverId.substring(0, 8);

  return `waiver_${waiverPrefix}_${truncatedStudentStr}_${dateStr}_${timeStr}.pdf`;
}

/**
 * Helper function to sanitize text and remove problematic characters
 * Prevents font rendering issues in PDFs
 */
function sanitizeText(text: string | null | undefined): string {
  if (!text) return '';

  // Remove or replace problematic characters that might cause font issues
  const controlCharsPattern = new RegExp(
    `[${String.fromCharCode(0)}-${String.fromCharCode(31)}${String.fromCharCode(127)}-${String.fromCharCode(159)}]`,
    'g'
  );

  return text
    .replace(controlCharsPattern, '') // Remove control characters
    .replace(/[\uFFFD]/g, '') // Remove replacement characters
    .trim();
}
