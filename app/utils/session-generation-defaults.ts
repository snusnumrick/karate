type SessionGenerationDateDefaultsInput = {
  isSeminar: boolean;
  seriesStartOn?: string | null;
  seriesEndOn?: string | null;
  fallbackStartDate: string;
  fallbackEndDate: string;
};

export function resolveSessionGenerationDateDefaults({
  isSeminar,
  seriesStartOn,
  seriesEndOn,
  fallbackStartDate,
  fallbackEndDate,
}: SessionGenerationDateDefaultsInput) {
  return {
    startDate: isSeminar && seriesStartOn ? seriesStartOn : fallbackStartDate,
    endDate: isSeminar && seriesEndOn ? seriesEndOn : fallbackEndDate,
  };
}
