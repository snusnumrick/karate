import { describe, expect, it } from 'vitest';

import { resolveSessionGenerationDateDefaults } from '../session-generation-defaults';

describe('resolveSessionGenerationDateDefaults', () => {
  it('uses seminar series dates when both dates are configured', () => {
    expect(resolveSessionGenerationDateDefaults({
      isSeminar: true,
      seriesStartOn: '2026-06-01',
      seriesEndOn: '2026-06-15',
      fallbackStartDate: '2026-04-27',
      fallbackEndDate: '2027-04-27',
    })).toEqual({
      startDate: '2026-06-01',
      endDate: '2026-06-15',
    });
  });

  it('falls back independently when a seminar date is missing', () => {
    expect(resolveSessionGenerationDateDefaults({
      isSeminar: true,
      seriesStartOn: '2026-06-01',
      seriesEndOn: null,
      fallbackStartDate: '2026-04-27',
      fallbackEndDate: '2027-04-27',
    })).toEqual({
      startDate: '2026-06-01',
      endDate: '2027-04-27',
    });
  });

  it('keeps class session generation on the standard date range', () => {
    expect(resolveSessionGenerationDateDefaults({
      isSeminar: false,
      seriesStartOn: '2026-06-01',
      seriesEndOn: '2026-06-15',
      fallbackStartDate: '2026-04-27',
      fallbackEndDate: '2027-04-27',
    })).toEqual({
      startDate: '2026-04-27',
      endDate: '2027-04-27',
    });
  });
});
