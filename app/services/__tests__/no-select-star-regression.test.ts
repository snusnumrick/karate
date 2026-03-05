import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

const SERVICES_DIR = path.resolve(process.cwd(), 'app/services');
const DIRECT_SELECT_STAR_PATTERN = /\.select\(\s*(['"`])\*\1\s*[,)]/g;

function collectServiceFiles(dir: string): string[] {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  const files: string[] = [];

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === '__tests__') continue;
      files.push(...collectServiceFiles(fullPath));
      continue;
    }

    if (!entry.isFile()) continue;
    if (!fullPath.endsWith('.ts') && !fullPath.endsWith('.tsx')) continue;
    if (fullPath.endsWith('.test.ts') || fullPath.endsWith('.test.tsx')) continue;

    files.push(fullPath);
  }

  return files;
}

function findDirectSelectStarUsages(filePath: string): string[] {
  const source = fs.readFileSync(filePath, 'utf8');
  const matches: string[] = [];
  let match: RegExpExecArray | null;

  while ((match = DIRECT_SELECT_STAR_PATTERN.exec(source)) !== null) {
    const prefix = source.slice(0, match.index);
    const line = prefix.split('\n').length;
    matches.push(`${path.relative(process.cwd(), filePath)}:${line}`);
  }

  return matches;
}

describe('select(*) regression guard', () => {
  it('prevents direct select(\"*\") usage in app/services', () => {
    const files = collectServiceFiles(SERVICES_DIR);
    const offenders = files.flatMap((filePath) => findDirectSelectStarUsages(filePath));

    expect(offenders).toEqual([]);
  });
});
