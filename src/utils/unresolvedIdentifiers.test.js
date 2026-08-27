// Every identifier in a source file must actually resolve.
//
// WHY THIS EXISTS: the extracted stage components shipped with
//
//     borderRadius: POINTER_HALF,
//
// while the import line above brought in only POINTER_SIZE. It parsed
// perfectly, so `sourceParses.test.js` passed; it crashed at runtime with
// "Property 'POINTER_HALF' doesn't exist" the first time the screen rendered.
//
// Nothing in this project's test setup renders react-native components — the
// jest config deliberately runs a plain node environment — so a screen or
// component file is otherwise only ever checked as TEXT. This suite closes
// that gap the cheap way: parse each file and walk its scopes, exactly as
// ESLint's no-undef would, and report any identifier with no binding and no
// global.
//
// It is a static check, not a render. It cannot catch a wrong VALUE, only a
// missing one — which is the class of mistake that extracting code between
// files actually produces.
//
// ── The first version of this file was VACUOUS, and shipped anyway ───────
// It skipped any identifier where `scope.hasGlobal(name)` was true. Babel
// populates `scope.globals` with exactly the identifiers that are REFERENCED
// BUT NOT BOUND — so that check was true for every real finding, and the
// suite passed on a file that crashed on the device with
// "Property 'SCREEN_WIDTH' doesn't exist".
//
// So the detector is now built as a pure function over source text, and the
// first thing this suite does is prove it FIRES on a deliberately broken
// snippet. A detector that cannot be shown to detect is worse than none: it
// reports safety it is not providing.

const fs = require('fs');
const path = require('path');
const parser = require('@babel/parser');
const traverse = require('@babel/traverse').default;

const SRC = path.resolve(__dirname, '..');

/** Globals a React Native module may legitimately reference. */
const KNOWN_GLOBALS = new Set([
  '__DEV__', 'require', 'module', 'exports', 'process', 'global', 'globalThis',
  'console', 'setTimeout', 'clearTimeout', 'setInterval', 'clearInterval',
  'requestAnimationFrame', 'cancelAnimationFrame', 'fetch', 'FormData', 'Blob',
  'URL', 'URLSearchParams', 'TextEncoder', 'TextDecoder', 'AbortController',
  'Promise', 'Map', 'Set', 'WeakMap', 'WeakSet', 'Symbol', 'Proxy', 'Reflect',
  'Object', 'Array', 'String', 'Number', 'Boolean', 'Math', 'JSON', 'Date',
  'RegExp', 'Error', 'TypeError', 'RangeError', 'Infinity', 'NaN', 'undefined',
  'isNaN', 'isFinite', 'parseInt', 'parseFloat', 'encodeURIComponent',
  'decodeURIComponent', 'Intl', 'performance', 'structuredClone', 'queueMicrotask',
  // Available in React Native since 0.73 — see store/authStore.js's own note.
  'atob', 'btoa',
]);

function walk(dir, acc = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full, acc);
    else if (entry.name.endsWith('.js') && !entry.name.endsWith('.test.js')) acc.push(full);
  }
  return acc;
}

/**
 * The detector, as a pure function over source text so it can be pointed at a
 * known-broken fixture and shown to work.
 *
 * `scope.hasBinding` is the ONLY question asked. `scope.hasGlobal` is
 * deliberately not consulted: Babel fills `scope.globals` with the
 * referenced-but-unbound identifiers, so consulting it would skip precisely
 * the findings this exists to make.
 *
 * @returns {string[]|null} unresolved names, or null if the source will not
 *   parse (that is sourceParses.test.js's job to report, not this one's).
 */
function unresolvedIdentifiers(code) {
  let ast;
  try {
    ast = parser.parse(code, {
      sourceType: 'unambiguous',
      plugins: ['jsx', 'classProperties', 'optionalChaining', 'nullishCoalescingOperator'],
    });
  } catch {
    return null;
  }

  const missing = new Set();
  traverse(ast, {
    ReferencedIdentifier(p) {
      const name = p.node.name;
      if (KNOWN_GLOBALS.has(name)) return;
      if (p.scope.hasBinding(name)) return;
      missing.add(name);
    },
  });
  return [...missing];
}

const unresolvedIn = (file) => unresolvedIdentifiers(fs.readFileSync(file, 'utf8'));

// ─── The detector must be able to detect ────────────────────────────────

describe('the detector itself', () => {
  it('FIRES on an identifier that is used but never imported or declared', () => {
    // This is the exact shape of both device crashes: a style referencing a
    // constant whose import line does not include it.
    const broken = `
      import { POINTER_SIZE } from './layout';
      const styles = { pointer: { width: POINTER_SIZE, borderRadius: POINTER_HALF } };
      export default styles;
    `;
    expect(unresolvedIdentifiers(broken)).toEqual(['POINTER_HALF']);
  });

  it('stays quiet when the same identifier IS imported', () => {
    const fixed = `
      import { POINTER_SIZE, POINTER_HALF } from './layout';
      const styles = { pointer: { width: POINTER_SIZE, borderRadius: POINTER_HALF } };
      export default styles;
    `;
    expect(unresolvedIdentifiers(fixed)).toEqual([]);
  });

  it('catches the SCREEN_WIDTH shape too — a deleted local declaration', () => {
    const broken = `
      import { CANVAS_WIDTH } from './layout';
      const styles = { bubble: { width: SCREEN_WIDTH * 0.36, height: CANVAS_WIDTH } };
      export default styles;
    `;
    expect(unresolvedIdentifiers(broken)).toEqual(['SCREEN_WIDTH']);
  });

  it('understands locals, params, destructuring, JSX and hoisted functions', () => {
    const fine = `
      import React from 'react';
      const { a, b } = require('./x');
      function helper(arg) { return arg + a + b + later(); }
      function later() { return 1; }
      export default function C({ prop }) {
        const [v, setV] = React.useState(0);
        return <View onPress={() => setV(helper(prop) + v)} />;
      }
      const View = () => null;
    `;
    expect(unresolvedIdentifiers(fine)).toEqual([]);
  });

  it('returns null rather than a false finding when the source will not parse', () => {
    expect(unresolvedIdentifiers('const = = ;')).toBeNull();
  });
});

// Every source file, not a curated list. The two crashes that reached the
// device were both in files an earlier, narrower list happened to include -
// but a list only protects what someone remembered to add to it, and the
// whole scan takes a few seconds.
describe('every identifier in the app resolves', () => {
  const FILES = walk(SRC).map((f) => path.relative(SRC, f).split(path.sep).join('/'));

  it('finds source files to check', () => {
    expect(FILES.length).toBeGreaterThan(50);
  });

  it('has no unresolved identifier anywhere in src/', () => {
    const findings = [];
    for (const rel of FILES) {
      const missing = unresolvedIn(path.join(SRC, rel));
      if (missing && missing.length > 0) findings.push({ file: rel, unresolved: missing });
    }
    // A readable failure: each offending file, and exactly what has no
    // binding in it.
    expect(findings).toEqual([]);
  });
});

describe('REGRESSION — the two bundler errors that reached the device', () => {
  it('ShapeAssessmentStage imports POINTER_HALF, which its styles use', () => {
    const src = fs.readFileSync(path.join(SRC, 'components/handwriting/ShapeAssessmentStage.js'), 'utf8');
    expect(src).toMatch(/POINTER_SIZE, POINTER_HALF,/);
    expect(src).toMatch(/borderRadius: POINTER_HALF/);
    // Asserted from source, not by requiring the module: shapeCanvasLayout
    // imports react-native's Dimensions, which this deliberately minimal jest
    // config does not transform.
    const layout = fs.readFileSync(path.join(SRC, 'constants/shapeCanvasLayout.js'), 'utf8');
    expect(layout).toMatch(/export const POINTER_SIZE = 14;/);
    expect(layout).toMatch(/export const POINTER_HALF = POINTER_SIZE \/ 2;/);
  });

  it('ShapeAssessmentScreen resolves SCREEN_WIDTH, which its styles use', () => {
    const src = fs.readFileSync(path.join(SRC, 'screens/handwriting/ShapeAssessmentScreen.js'), 'utf8');
    expect(unresolvedIdentifiers(src)).toEqual([]);
    // Aliased from the shared layout module - never a second Dimensions call.
    expect(src).toMatch(/const SCREEN_WIDTH\s+= SHAPE_SCREEN_WIDTH;/);
    expect(src).toMatch(/const SCREEN_HEIGHT = SHAPE_SCREEN_HEIGHT;/);
    // Scanned as code — the comment above the alias mentions the call it is
    // deliberately NOT making.
    const code = src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
    expect(code).not.toMatch(/Dimensions\.get\('window'\)/);
  });

  it('no file imports the same binding twice', () => {
    // `import { Ionicons } ...` appeared twice in ExerciseD_SpellWord, which
    // is a SyntaxError the bundler reports but a stale cache can hide.
    const offenders = [];
    for (const file of walk(SRC)) {
      const code = fs.readFileSync(file, 'utf8');
      let ast;
      try {
        ast = parser.parse(code, { sourceType: 'unambiguous', plugins: ['jsx'] });
      } catch { continue; }
      const seen = new Set();
      for (const node of ast.program.body) {
        if (node.type !== 'ImportDeclaration') continue;
        for (const spec of node.specifiers) {
          const name = spec.local.name;
          if (seen.has(name)) offenders.push(`${path.relative(SRC, file)}: ${name}`);
          seen.add(name);
        }
      }
    }
    expect(offenders).toEqual([]);
  });
});
