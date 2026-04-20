import { describe, expect, it } from 'vitest';
import { getFamilyRegistrationWaiverStatus } from '../waiver.server';

function createClient(config: {
  profiles: { data: unknown; error: unknown };
  waivers: { data: unknown; error: unknown };
  signatures: { data: unknown; error: unknown };
}) {
  return {
    from(table: string) {
      if (table === 'profiles') {
        return {
          select: () => ({
            eq: () => ({
              limit: () => Promise.resolve(config.profiles),
            }),
          }),
        };
      }

      if (table === 'waivers') {
        return {
          select: () => ({
            eq: () => Promise.resolve(config.waivers),
          }),
        };
      }

      if (table === 'waiver_signatures') {
        return {
          select: () => ({
            in: () => Promise.resolve(config.signatures),
          }),
        };
      }

      throw new Error(`Unexpected table ${table}`);
    },
  };
}

describe('getFamilyRegistrationWaiverStatus', () => {
  it('treats a waiver signed by any family profile as complete', async () => {
    const client = createClient({
      profiles: {
        data: [{ id: 'profile-1' }, { id: 'profile-2' }],
        error: null,
      },
      waivers: {
        data: [{ id: 'waiver-1', title: 'Liability Release', required_for_registration: true }],
        error: null,
      },
      signatures: {
        data: [{ waiver_id: 'waiver-1', signed_at: '2026-04-20T18:00:00.000Z' }],
        error: null,
      },
    });

    const result = await getFamilyRegistrationWaiverStatus('family-1', client as never);

    expect(result.is_complete).toBe(true);
    expect(result.missing_waivers).toEqual([]);
    expect(result.signed_waivers.map((waiver) => waiver.id)).toEqual(['waiver-1']);
    expect(result.completed_at).toBe('2026-04-20T18:00:00.000Z');
  });

  it('reports missing family waivers when no family profile has signed them', async () => {
    const client = createClient({
      profiles: {
        data: [{ id: 'profile-1' }, { id: 'profile-2' }],
        error: null,
      },
      waivers: {
        data: [{ id: 'waiver-1', title: 'Liability Release', required_for_registration: true }],
        error: null,
      },
      signatures: {
        data: [],
        error: null,
      },
    });

    const result = await getFamilyRegistrationWaiverStatus('family-1', client as never);

    expect(result.is_complete).toBe(false);
    expect(result.missing_waivers.map((waiver) => waiver.id)).toEqual(['waiver-1']);
    expect(result.signed_waivers).toEqual([]);
  });
});
