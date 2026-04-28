export type SeminarRegistrationSeries = {
  is_active?: boolean | null;
  allow_self_enrollment?: boolean | null;
  registration_status?: string | null;
  max_capacity?: number | null;
  enrollment_count?: number | null;
};

export function getSeminarSeriesRegistrationAvailability(series: SeminarRegistrationSeries) {
  const isActive = series.is_active !== false;
  const allowsSelfEnrollment = series.allow_self_enrollment === true;
  const registrationStatus = series.registration_status ?? 'closed';
  const enrollmentCount = series.enrollment_count ?? 0;
  const isFull = series.max_capacity != null && enrollmentCount >= series.max_capacity;
  const canUseOnlineRegistration = isActive && allowsSelfEnrollment;
  const canJoinWaitlist =
    canUseOnlineRegistration &&
    (registrationStatus === 'waitlisted' || (registrationStatus === 'open' && isFull));
  const canRegister = canUseOnlineRegistration && registrationStatus === 'open' && !isFull;

  return {
    isFull,
    canRegister,
    canJoinWaitlist,
    canUseOnlineRegistration,
    message: getSeminarSeriesRegistrationMessage({
      isActive,
      allowsSelfEnrollment,
      registrationStatus,
      isFull,
      canRegister,
      canJoinWaitlist,
    }),
  };
}

export function getSeminarRegistrationSummary(seriesList: SeminarRegistrationSeries[] | null | undefined) {
  const availability = (seriesList ?? []).map(getSeminarSeriesRegistrationAvailability);

  if (availability.some((state) => state.canRegister)) {
    return 'Online sign-up available';
  }

  if (availability.some((state) => state.canJoinWaitlist)) {
    return 'Online waitlist available';
  }

  if (availability.some((state) => state.canUseOnlineRegistration)) {
    return 'Registration not open';
  }

  return 'Contact us to register';
}

function getSeminarSeriesRegistrationMessage({
  isActive,
  allowsSelfEnrollment,
  registrationStatus,
  isFull,
  canRegister,
  canJoinWaitlist,
}: {
  isActive: boolean;
  allowsSelfEnrollment: boolean;
  registrationStatus: string;
  isFull: boolean;
  canRegister: boolean;
  canJoinWaitlist: boolean;
}) {
  if (!isActive) {
    return 'This series is not currently accepting online registration.';
  }

  if (!allowsSelfEnrollment) {
    return 'Contact us to register for this series.';
  }

  if (canJoinWaitlist) {
    return isFull
      ? 'This series is full. Join the waitlist and we will contact you if a spot opens.'
      : 'This series is currently waitlist only. Join the waitlist and we will contact you if a spot opens.';
  }

  if (canRegister) {
    return 'Self-registration is available for this series.';
  }

  if (registrationStatus === 'closed') {
    return 'Registration is not open for this series.';
  }

  return 'Contact us to register for this series.';
}
