import { describe, it, expect } from 'vitest';
import { deriveNonceForRequest } from '~/utils/nonce.server';

function makeRequest(url = 'http://localhost:5176/', headers: Record<string,string> = {}) {
  return new Request(url, { headers });
}

describe('deriveNonceForRequest', () => {
  it('returns a stable, 22-char nonce for identical requests', () => {
    const headers = {
      'user-agent': 'vitest',
      'accept-language': 'en-US',
      'x-forwarded-host': 'localhost:5176',
      'x-forwarded-proto': 'http',
    };
    const r1 = makeRequest('http://localhost:5176/', headers);
    const r2 = makeRequest('http://localhost:5176/', headers);
    const n1 = deriveNonceForRequest(r1);
    const n2 = deriveNonceForRequest(r2);
    expect(n1).toHaveLength(22);
    expect(n2).toBe(n1);
  });

  it('produces different nonces when headers change', () => {
    const r1 = makeRequest('http://localhost:5176/', { 'user-agent': 'a' });
    const r2 = makeRequest('http://localhost:5176/', { 'user-agent': 'b' });
    const n1 = deriveNonceForRequest(r1);
    const n2 = deriveNonceForRequest(r2);
    expect(n1).not.toBe(n2);
  });
});

