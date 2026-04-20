export interface LoginPageCopy {
  heading: string;
  linkPrefix: string;
  linkLabel?: string;
  linkHref?: string;
  linkSuffix?: string;
  extraMessage?: string;
}

export function resolveLoginCopy(redirectTo?: string): LoginPageCopy {
  const registerHref = redirectTo ? `/register?redirectTo=${encodeURIComponent(redirectTo)}` : '/register';

  if (!redirectTo) {
    return {
      heading: 'Sign in to your account',
      linkPrefix: 'Or ',
      linkLabel: 'register for classes',
      linkHref: registerHref,
    };
  }

  const redirectPath = redirectTo.split(/[?#]/)[0];

  if (redirectPath.startsWith('/events/') && redirectPath.endsWith('/register')) {
    return {
      heading: 'Sign in to register for this event',
      linkPrefix: 'Need an account? ',
      linkLabel: 'create a family portal account',
      linkHref: registerHref,
      linkSuffix: ' to finish your RSVP.',
      extraMessage: "You'll return to the event registration form right after you sign in.",
    };
  }

  if (redirectPath.startsWith('/curriculum/seminars/') && redirectPath.endsWith('/register')) {
    return {
      heading: 'Sign in to register for this seminar',
      linkPrefix: 'Need an account? ',
      linkLabel: 'create a family portal account',
      linkHref: registerHref,
      linkSuffix: ' to complete your registration.',
      extraMessage: "You'll return to the seminar registration form right after you sign in.",
    };
  }

  if (redirectPath.startsWith('/family')) {
    return {
      heading: 'Sign in to manage your family portal',
      linkPrefix: 'New to our programs? ',
      linkLabel: 'create a family portal account',
      linkHref: registerHref,
      linkSuffix: ' to get started.',
      extraMessage: 'Once signed in you can add students, view schedules, and complete registrations.',
    };
  }

  if (redirectPath.startsWith('/admin')) {
    return {
      heading: 'Sign in with your staff account',
      linkPrefix: 'Need access? ',
      linkLabel: 'contact the dojo team',
      linkHref: '/contact',
      linkSuffix: ' for credentials.',
    };
  }

  return {
    heading: 'Sign in to your account',
    linkPrefix: 'Or ',
    linkLabel: 'register for classes',
    linkHref: registerHref,
  };
}
