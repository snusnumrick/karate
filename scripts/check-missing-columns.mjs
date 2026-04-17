import { readFileSync, readdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');

// Load all SQL content
const sqlFiles = [
  join(root, 'app/db/supabase-setup.sql'),
  ...readdirSync(join(root, 'supabase/migrations'))
    .filter(f => f.endsWith('.sql'))
    .map(f => join(root, 'supabase/migrations', f)),
];

const allSql = sqlFiles.map(f => readFileSync(f, 'utf8')).join('\n');

// Build a map of table -> set of defined columns from SQL
const definedColumns = {}; // table -> Set<column>

// 1. Extract columns from CREATE TABLE blocks
const createTableRe = /CREATE\s+TABLE(?:\s+IF\s+NOT\s+EXISTS)?\s+(?:public\.)?(\w+)\s*\(([^;]+?)\);/gis;
let m;
while ((m = createTableRe.exec(allSql)) !== null) {
  const table = m[1].toLowerCase();
  const body = m[2];
  const cols = definedColumns[table] ?? new Set();
  // Each line that starts with an identifier (not CONSTRAINT, CHECK, UNIQUE, PRIMARY, FOREIGN)
  for (const line of body.split('\n')) {
    const trimmed = line.trim();
    const colMatch = trimmed.match(/^(\w+)\s+/);
    if (colMatch) {
      const word = colMatch[1].toUpperCase();
      if (!['CONSTRAINT', 'CHECK', 'UNIQUE', 'PRIMARY', 'FOREIGN', 'LIKE'].includes(word)) {
        cols.add(colMatch[1].toLowerCase());
      }
    }
  }
  definedColumns[table] = cols;
}

// 2. Extract columns from ALTER TABLE ... ADD COLUMN statements
const alterRe = /ALTER\s+TABLE(?:\s+(?:IF\s+EXISTS\s+)?(?:public\.)?)?(\w+)\s+ADD\s+COLUMN(?:\s+IF\s+NOT\s+EXISTS)?\s+(\w+)/gis;
while ((m = alterRe.exec(allSql)) !== null) {
  const table = m[1].toLowerCase();
  const col = m[2].toLowerCase();
  const cols = definedColumns[table] ?? new Set();
  cols.add(col);
  definedColumns[table] = cols;
}

// Parse database.types.ts for table Row columns
const typesFile = readFileSync(
  join(root, 'supabase/functions/_shared/database.types.ts'),
  'utf8'
);

// Known views (computed columns, no ADD COLUMN needed)
const knownViews = new Set(['programs_with_belt_info', 'enrollment_summary', 'family_balance_summary']);

const tablePattern = /(\w+): \{\s*Row: \{([^}]+)\}/g;
const columnPattern = /^\s+(\w+):/gm;
const skipWords = new Set(['true', 'false', 'null', 'string', 'number', 'boolean']);

const missing = {};

while ((m = tablePattern.exec(typesFile)) !== null) {
  const tableName = m[1];
  if (knownViews.has(tableName)) continue;

  const rowBlock = m[2];
  const sqlCols = definedColumns[tableName.toLowerCase()] ?? new Set();

  let colMatch;
  while ((colMatch = columnPattern.exec(rowBlock)) !== null) {
    const col = colMatch[1];
    if (skipWords.has(col)) continue;
    if (!sqlCols.has(col.toLowerCase())) {
      (missing[tableName] ??= []).push(col);
    }
  }
}

if (Object.keys(missing).length === 0) {
  console.log('✅ No missing columns detected.');
} else {
  let total = 0;
  for (const cols of Object.values(missing)) total += cols.length;
  console.log(`⚠️  ${total} column(s) in ${Object.keys(missing).length} table(s) missing from SQL:\n`);
  for (const [table, cols] of Object.entries(missing)) {
    console.log(`  ${table}:`);
    for (const col of cols) console.log(`    - ${col}`);
  }
}
