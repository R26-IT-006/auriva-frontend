// Every source file under src/ must actually PARSE with the project's own
// Babel config.
//
// Why this exists: several screen-level tests in this repo verify
// TeacherReportScreen.js and StudentDetailScreen.js by reading them as TEXT
// (they import 'react-native' and cannot be mounted under this plain-node jest
// config). Source-text assertions cannot detect a syntax error, so a file
// could pass its whole suite and still fail the Metro bundler at runtime —
// which is exactly what happened when a `{/* ... */}` JSX comment was placed
// in expression position (right after `&& (`) instead of in JSX-children
// position, making Babel read `{` as the start of an object literal.
//
// This test closes that gap for the whole tree, not just the files that
// happen to have text-based tests.

const babel = require('@babel/core');
const fs = require('fs');
const path = require('path');

const SRC = path.resolve(__dirname, '..');

function collectSourceFiles(dir, acc = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (!/^(node_modules|__snapshots__)$/.test(entry.name)) collectSourceFiles(full, acc);
    } else if (/\.(js|jsx)$/.test(entry.name)) {
      acc.push(full);
    }
  }
  return acc;
}

const files = collectSourceFiles(SRC);

describe('every source file parses with the project Babel config', () => {
  it('finds a non-trivial number of source files (guards against a broken walk)', () => {
    expect(files.length).toBeGreaterThan(100);
  });

  it.each(files.map(f => [path.relative(SRC, f), f]))('%s parses', (_rel, full) => {
    expect(() => babel.transformFileSync(full, { cwd: path.resolve(SRC, '..') })).not.toThrow();
  });
});
