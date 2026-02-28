import { describe, expect, it } from 'vitest';
import { mapProgramFromRow, mapProgramNullToUndefined } from '~/utils/mappers';
import { toCents } from '~/utils/money';
import type { Database } from '~/types/database.types';

type ProgramRow = Database['public']['Tables']['programs']['Row'];

describe('program mappers', () => {
  it('maps program rows with cent fields into Money values', () => {
    const mapped = mapProgramFromRow({
      id: 'prog_1',
      name: 'Little Ninjas',
      description: null,
      duration_minutes: 45,
      max_capacity: 0,
      sessions_per_week: 0,
      min_sessions_per_week: null,
      max_sessions_per_week: null,
      min_belt_rank: null,
      max_belt_rank: null,
      belt_rank_required: false,
      prerequisite_programs: null,
      min_age: null,
      max_age: null,
      gender_restriction: null,
      special_needs_support: null,
      monthly_fee: null,
      registration_fee: null,
      yearly_fee: null,
      individual_session_fee: null,
      monthly_fee_cents: 0,
      registration_fee_cents: 1234,
      yearly_fee_cents: 25000,
      individual_session_fee_cents: 999,
      ability_category: null,
      audience_scope: 'member_only',
      delivery_format: null,
      engagement_type: 'ongoing',
      min_capacity: null,
      required_waiver_id: null,
      seminar_type: null,
      single_purchase_price_cents: null,
      slug: null,
      subscription_monthly_price_cents: null,
      subscription_yearly_price_cents: null,
      is_active: true,
      created_at: '2026-01-01T00:00:00.000Z',
      updated_at: '2026-01-01T00:00:00.000Z',
    } as unknown as ProgramRow);

    expect(mapped.description).toBeUndefined();
    expect(mapped.max_capacity).toBe(0);
    expect(mapped.sessions_per_week).toBe(0);
    expect(mapped.belt_rank_required).toBe(false);
    expect(mapped.monthly_fee && toCents(mapped.monthly_fee)).toBe(0);
    expect(mapped.registration_fee && toCents(mapped.registration_fee)).toBe(1234);
    expect(mapped.yearly_fee && toCents(mapped.yearly_fee)).toBe(25000);
    expect(mapped.individual_session_fee && toCents(mapped.individual_session_fee)).toBe(999);
  });

  it('maps row-like objects passed through mapProgramNullToUndefined', () => {
    const mapped = mapProgramNullToUndefined({
      id: 'prog_2',
      name: 'Teens',
      description: null,
      duration_minutes: 60,
      max_capacity: null,
      sessions_per_week: 2,
      min_sessions_per_week: null,
      max_sessions_per_week: null,
      min_belt_rank: null,
      max_belt_rank: null,
      belt_rank_required: null,
      prerequisite_programs: null,
      min_age: 13,
      max_age: null,
      gender_restriction: null,
      special_needs_support: null,
      monthly_fee: null,
      registration_fee: null,
      yearly_fee: null,
      individual_session_fee: null,
      monthly_fee_cents: 7000,
      registration_fee_cents: 0,
      yearly_fee_cents: 0,
      individual_session_fee_cents: 0,
      ability_category: null,
      audience_scope: 'member_only',
      delivery_format: null,
      engagement_type: 'ongoing',
      min_capacity: null,
      required_waiver_id: null,
      seminar_type: null,
      single_purchase_price_cents: null,
      slug: null,
      subscription_monthly_price_cents: null,
      subscription_yearly_price_cents: null,
      is_active: true,
      created_at: '2026-01-01T00:00:00.000Z',
      updated_at: '2026-01-01T00:00:00.000Z',
    });

    expect(mapped.description).toBeUndefined();
    expect(mapped.belt_rank_required).toBe(false);
    expect(mapped.monthly_fee && toCents(mapped.monthly_fee)).toBe(7000);
  });
});
