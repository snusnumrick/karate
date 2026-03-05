export type SeededFixtureKey = 'familyId' | 'studentId' | 'waiverId' | 'invoiceId';

const FIXTURE_ENV_MAP: Record<SeededFixtureKey, string> = {
  familyId: 'TEST_FAMILY_ID',
  studentId: 'TEST_STUDENT_ID',
  waiverId: 'TEST_WAIVER_ID',
  invoiceId: 'TEST_INVOICE_ID',
};

export function getSeededFixture(key: SeededFixtureKey): string | undefined {
  const raw = process.env[FIXTURE_ENV_MAP[key]];
  if (!raw) return undefined;
  const value = raw.trim();
  return value.length > 0 ? value : undefined;
}

export function hasSeededFixtures(keys: SeededFixtureKey[]): boolean {
  return keys.every((key) => Boolean(getSeededFixture(key)));
}

export function missingSeededFixturesMessage(keys: SeededFixtureKey[]): string {
  const missing = keys.filter((key) => !getSeededFixture(key)).map((key) => FIXTURE_ENV_MAP[key]);
  return `Missing seeded fixture env var(s): ${missing.join(', ')}`;
}
