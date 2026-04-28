import { describe, expect, it } from 'vitest';
import {
  ANONYMOUS_HOMEPAGE_CACHE_CONTROL,
  NO_STORE_CACHE_CONTROL,
  getDocumentCacheControl,
  isAnonymousHomepageDocumentRequest,
} from '~/utils/public-cache.server';
import { shouldRevalidateRootForAnonymousCsrf } from '~/utils/public-cache';

function request(path: string, headers: HeadersInit = {}) {
  return new Request(`https://example.test${path}`, { headers });
}

describe('public document cache policy', () => {
  it('allows shared caching for anonymous homepage document requests', () => {
    const homepageRequest = request('/', {
      accept: 'text/html,application/xhtml+xml',
    });

    expect(isAnonymousHomepageDocumentRequest(homepageRequest)).toBe(true);
    expect(getDocumentCacheControl(homepageRequest)).toBe(ANONYMOUS_HOMEPAGE_CACHE_CONTROL);
  });

  it('keeps authenticated homepage requests private', () => {
    const homepageRequest = request('/', {
      accept: 'text/html',
      cookie: 'sb-example-auth-token=session-token',
    });

    expect(isAnonymousHomepageDocumentRequest(homepageRequest)).toBe(false);
    expect(getDocumentCacheControl(homepageRequest)).toBe(NO_STORE_CACHE_CONTROL);
  });

  it('keeps non-homepage and error documents non-cacheable', () => {
    expect(getDocumentCacheControl(request('/classes', { accept: 'text/html' })))
      .toBe(NO_STORE_CACHE_CONTROL);
    expect(getDocumentCacheControl(request('/', { accept: 'text/html' }), 500))
      .toBe(NO_STORE_CACHE_CONTROL);
  });

  it('revalidates root data when leaving the anonymous cached homepage', () => {
    expect(shouldRevalidateRootForAnonymousCsrf(
      new URL('https://example.test/'),
      new URL('https://example.test/login')
    )).toBe(true);
    expect(shouldRevalidateRootForAnonymousCsrf(
      new URL('https://example.test/classes'),
      new URL('https://example.test/login')
    )).toBe(false);
  });
});
