import { describe, expect, it } from 'vitest';

import { resolveLoginCopy } from '~/utils/login-page-copy';

describe('resolveLoginCopy', () => {
  it('returns event-specific copy for event registration redirects', () => {
    const copy = resolveLoginCopy('/events/event-123/register');

    expect(copy.heading).toBe('Sign in to register for this event');
    expect(copy.linkHref).toBe('/register?redirectTo=%2Fevents%2Fevent-123%2Fregister');
    expect(copy.extraMessage).toBe("You'll return to the event registration form right after you sign in.");
  });

  it('returns seminar-specific copy for seminar registration redirects', () => {
    const copy = resolveLoginCopy('/curriculum/seminars/intro-to-kata/register?seriesId=series-123');

    expect(copy.heading).toBe('Sign in to register for this seminar');
    expect(copy.linkHref).toBe('/register?redirectTo=%2Fcurriculum%2Fseminars%2Fintro-to-kata%2Fregister%3FseriesId%3Dseries-123');
    expect(copy.linkSuffix).toBe(' to complete your registration.');
    expect(copy.extraMessage).toBe("You'll return to the seminar registration form right after you sign in.");
  });

  it('keeps family portal copy for family redirects', () => {
    const copy = resolveLoginCopy('/family');

    expect(copy.heading).toBe('Sign in to manage your family portal');
    expect(copy.linkLabel).toBe('create a family portal account');
  });
});
