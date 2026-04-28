import { describe, expect, it } from 'vitest';
import {
  getSeminarRegistrationSummary,
  getSeminarSeriesRegistrationAvailability,
} from '../seminar-registration';

describe('seminar registration availability', () => {
  it('does not allow registration when self-enrollment is enabled but registration is closed', () => {
    const availability = getSeminarSeriesRegistrationAvailability({
      is_active: true,
      allow_self_enrollment: true,
      registration_status: 'closed',
    });

    expect(availability.canRegister).toBe(false);
    expect(availability.canJoinWaitlist).toBe(false);
    expect(availability.displayStatus).toBe('closed');
    expect(availability.message).toBe('Registration is not open for this series.');
  });

  it('allows registration only for open active self-enrollable series with capacity', () => {
    const availability = getSeminarSeriesRegistrationAvailability({
      is_active: true,
      allow_self_enrollment: true,
      registration_status: 'open',
      max_capacity: 12,
      enrollment_count: 8,
    });

    expect(availability.canRegister).toBe(true);
    expect(availability.canJoinWaitlist).toBe(false);
    expect(availability.displayStatus).toBe('open');
    expect(availability.message).toBe('Self-registration is available for this series.');
  });

  it('does not display open registration for inactive series with an open registration status', () => {
    const availability = getSeminarSeriesRegistrationAvailability({
      is_active: false,
      allow_self_enrollment: true,
      registration_status: 'open',
    });

    expect(availability.canRegister).toBe(false);
    expect(availability.canJoinWaitlist).toBe(false);
    expect(availability.displayStatus).toBe('unavailable');
    expect(availability.message).toBe('This series is not currently accepting online registration.');
  });

  it('uses waitlist messaging for waitlisted series', () => {
    const availability = getSeminarSeriesRegistrationAvailability({
      is_active: true,
      allow_self_enrollment: true,
      registration_status: 'waitlisted',
    });

    expect(availability.canRegister).toBe(false);
    expect(availability.canJoinWaitlist).toBe(true);
    expect(availability.displayStatus).toBe('waitlisted');
    expect(availability.message).toBe(
      'This series is currently waitlist only. Join the waitlist and we will contact you if a spot opens.',
    );
  });

  it('summarizes closed self-enrollable series as not open', () => {
    expect(
      getSeminarRegistrationSummary([
        {
          is_active: true,
          allow_self_enrollment: true,
          registration_status: 'closed',
        },
      ]),
    ).toBe('Registration not open');
  });
});
