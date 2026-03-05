import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

type WrapperExpectation = {
  file: string;
  requiredSnippets: string[];
  forbiddenSnippets?: string[];
};

const EXPECTATIONS: WrapperExpectation[] = [
  {
    file: 'app/routes/admin.classes._index.tsx',
    requiredSnippets: ['withAdminLoader', 'export const loader = withAdminLoader(loaderImpl);'],
    forbiddenSnippets: ['requireAdminUser(', 'requireRole('],
  },
  {
    file: 'app/routes/admin.invoices.new.tsx',
    requiredSnippets: [
      'withAdminLoader',
      'withAdminAction',
      'export const loader = withAdminLoader(loaderImpl);',
      'export const action = withAdminAction(actionImpl);',
    ],
    forbiddenSnippets: ['requireAdminUser(', 'requireRole('],
  },
  {
    file: 'app/routes/_layout.family.events.tsx',
    requiredSnippets: [
      'withFamilyLoader',
      'withFamilyAction',
      'export const loader = withFamilyLoader(loaderImpl);',
      'export const action = withFamilyAction(actionImpl);',
    ],
    forbiddenSnippets: ['requireUserId(', 'requireRole('],
  },
  {
    file: 'app/routes/instructor.attendance.tsx',
    requiredSnippets: [
      'withInstructorLoader',
      'withInstructorAction',
      'export const loader = withInstructorLoader(loaderImpl);',
      'export const action = withInstructorAction(actionImpl);',
    ],
    forbiddenSnippets: ['requireInstructorUser(', 'requireRole('],
  },
  {
    file: 'app/routes/api.invoices.$id.pdf.ts',
    requiredSnippets: ['withAdminLoader', 'export const loader = withAdminLoader(loaderImpl);'],
    forbiddenSnippets: ['requireAdminUser(', 'requireRole('],
  },
  {
    file: 'app/routes/api.push.test.ts',
    requiredSnippets: ['withUserAction', 'export const action = withUserAction(actionImpl);'],
    forbiddenSnippets: ['requireUserId(', 'requireRole('],
  },
];

function readRouteFile(relativePath: string): string {
  const absolutePath = path.resolve(process.cwd(), relativePath);
  return fs.readFileSync(absolutePath, 'utf8');
}

describe('auth wrapper adoption guard', () => {
  it('keeps representative migrated routes wired through auth wrappers', () => {
    for (const expectation of EXPECTATIONS) {
      const source = readRouteFile(expectation.file);

      for (const snippet of expectation.requiredSnippets) {
        expect(source).toContain(snippet);
      }

      for (const snippet of expectation.forbiddenSnippets ?? []) {
        expect(source).not.toContain(snippet);
      }
    }
  });
});
