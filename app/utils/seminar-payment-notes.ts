const SEMINAR_PAYMENT_MARKER = 'seminar_registration';
const SEMINAR_PENDING_PAYMENT_MARKER = 'seminar_pending_payment';

export function buildSeminarPaymentMarker({
  seriesId,
  studentId,
}: {
  seriesId: string;
  studentId: string;
}) {
  return `[${SEMINAR_PAYMENT_MARKER}:${seriesId}:${studentId}]`;
}

export function buildSeminarPendingPaymentMarker({
  paymentId,
  seriesId,
  studentId,
}: {
  paymentId: string;
  seriesId: string;
  studentId: string;
}) {
  return `[${SEMINAR_PENDING_PAYMENT_MARKER}:${paymentId}:${seriesId}:${studentId}]`;
}

export function buildSeminarPaymentNotes({
  existingNotes,
  seriesId,
  studentId,
}: {
  existingNotes?: string | null;
  seriesId: string;
  studentId: string;
}) {
  const marker = buildSeminarPaymentMarker({ seriesId, studentId });

  if (existingNotes?.includes(marker)) {
    return existingNotes;
  }

  const seminarNotes = `Seminar registration ${marker}`;
  return existingNotes?.trim()
    ? `${existingNotes}\n${seminarNotes}`
    : seminarNotes;
}

export function buildEnrollmentPendingPaymentNotes({
  existingNotes,
  paymentId,
  seriesId,
  studentId,
}: {
  existingNotes?: string | null;
  paymentId: string;
  seriesId: string;
  studentId: string;
}) {
  const marker = buildSeminarPendingPaymentMarker({ paymentId, seriesId, studentId });
  if (existingNotes?.includes(marker)) {
    return existingNotes;
  }

  return existingNotes?.trim()
    ? `${existingNotes}\n${marker}`
    : marker;
}

export function extractSeminarPendingPaymentId({
  notes,
  seriesId,
  studentId,
}: {
  notes?: string | null;
  seriesId: string;
  studentId: string;
}) {
  if (!notes) {
    return null;
  }

  const markerPattern = /\[seminar_pending_payment:([^:\]]+):([^:\]]+):([^:\]]+)\]/g;

  for (const match of notes.matchAll(markerPattern)) {
    const [, paymentId, noteSeriesId, noteStudentId] = match;
    if (noteSeriesId === seriesId && noteStudentId === studentId) {
      return paymentId;
    }
  }

  return null;
}
