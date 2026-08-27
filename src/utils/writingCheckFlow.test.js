// Writing Check: the controller screen's loading flow and its handoff to the
// real writing screens.
//
// This suite exists because the screen shipped stuck on a spinner. Three
// separate defects were behind it, and each has a test here that fails if it
// comes back:
//
//   1. `import { uuid }` from a module that only exports `generateUuidV4` —
//      `uuid()` threw before any request was made, the async loader's promise
//      rejected unobserved, and the phase never left 'loading';
//   2. the 20 mixed-case pairs were handed to a screen that renders one case,
//      which silently dropped the 10 uppercase ones;
//   3. `writingCheckId` was passed but read by nobody, so a finished lowercase
//      batch continued into the RESEARCH data-collection protocol instead of
//      back to the check.
//
// None of the ML logic, the protocol, the 20 reference letters, the capture
// conditions or collection-mode behaviour is exercised or changed here.

// writingCheck.js reaches api/client -> storage.js -> expo-secure-store, whose
// ESM build this project's deliberately minimal jest config does not transform.
// Stubbed exactly as storage.test.js already does; no test here touches either.
jest.mock('expo-secure-store', () => ({
  getItemAsync: jest.fn(), setItemAsync: jest.fn(), deleteItemAsync: jest.fn(),
}));
jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock')
);

import fs from 'fs';
import path from 'path';

import * as uuidModule from './uuid';
import { WRITING_CHECK_REQUIRED_COUNT } from './writingCheck';

const read = (rel) => fs.readFileSync(path.resolve(__dirname, rel), 'utf8');
const screen      = read('../screens/handwriting/WritingCheckScreen.js');
const letterScreen = read('../screens/handwriting/LetterWritingScreen.js');
const upperScreen  = read('../screens/handwriting/uppercase/UppercaseWritingScreen.js');
const navigator    = read('../navigation/HandwritingNavigator.js');
const client       = read('./writingCheck.js');
const endpoints    = read('../constants/api.js');

function stripComments(s) {
  return s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
}

/** Slices from a start marker to the next occurrence of an end marker AFTER
 *  it — searching from index 0 would match the import lines at the top. */
function between(source, startMarker, endMarker) {
  const start = source.indexOf(startMarker);
  expect(start).toBeGreaterThan(-1);
  const end = source.indexOf(endMarker, start + startMarker.length);
  expect(end).toBeGreaterThan(start);
  return source.slice(start, end);
}

const loader  = between(screen, 'const load = useCallback', 'useFocusEffect(');
const handoff = between(screen, 'function nextBatch', 'const bg =');

// ─── ROOT CAUSE: the import that threw ──────────────────────────────────

describe('the id generator the screen imports actually exists', () => {
  it('utils/uuid exports generateUuidV4 and NOT uuid', () => {
    expect(typeof uuidModule.generateUuidV4).toBe('function');
    expect(uuidModule.uuid).toBeUndefined();
  });

  it('the screen imports the name that exists', () => {
    expect(screen).toMatch(/import \{ generateUuidV4 \} from '\.\.\/\.\.\/utils\/uuid'/);
    expect(screen).not.toMatch(/import \{ uuid \}/);
    expect(stripComments(screen)).not.toMatch(/[^A-Za-z]uuid\(\)/);
  });

  it('generateUuidV4 returns a usable collection_session_id', () => {
    const id = uuidModule.generateUuidV4();
    expect(typeof id).toBe('string');
    expect(id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
    expect(uuidModule.generateUuidV4()).not.toBe(id);
  });
});

// ─── The loading state can always be left ───────────────────────────────

describe('the loader cannot strand the screen on a spinner', () => {
  it('every path out of loading sets a terminal phase', () => {
    for (const phase of ['unavailable', 'done', 'ready', 'error']) {
      expect(loader).toContain(`phase: '${phase}'`);
    }
  });

  it('a throw inside the loader becomes a visible error, not a spinner', () => {
    expect(loader).toMatch(/catch \(err\)/);
    expect(loader).toMatch(/setState\(\{ phase: 'error'/);
    // And the real error is logged for whoever is debugging.
    expect(loader).toMatch(/console\.log\('\[WritingCheck\] load failed:/);
  });

  it('a missing check object is treated as unavailable, never dereferenced', () => {
    // `started.check.id` on a null check was a second way to throw.
    expect(loader).toMatch(/started\.status === 'unavailable' \|\| !started\.check\?\.id/);
  });

  it('the error state offers Try Again and Back', () => {
    expect(screen).toMatch(/Writing Check could not be loaded\./);
    expect(screen).toMatch(/onPress=\{load\}/);
    expect(screen).toMatch(/accessibilityLabel="Try again"/);
    expect(screen).toMatch(/Try Again/);
    expect(screen).toMatch(/>Back</);
  });

  it('the phases are the documented machine and nothing else', () => {
    const phases = new Set((screen.match(/phase: '(\w+)'/g) ?? [])
      .map((m) => m.match(/'(\w+)'/)[1]));
    expect([...phases].sort()).toEqual(['done', 'error', 'loading', 'ready', 'unavailable']);
  });
});

describe('the focus effect cannot loop', () => {
  it('reloads once per focus, on a dependency the loader does not set', () => {
    expect(screen).toMatch(/useFocusEffect\(useCallback\(\(\) => \{ load\(\); \}, \[load\]\)\)/);
    // `load` is memoised on the route param only — nothing it writes is in
    // its own dependency list, so setState cannot re-create it.
    expect(screen).toMatch(/\}, \[student\]\);/);
    for (const stateName of ['state', 'setState', 'captured', 'remaining']) {
      expect(screen).not.toMatch(new RegExp(`\\}, \\[[^\\]]*\\b${stateName}\\b[^\\]]*\\]\\);`));
    }
  });
});

// ─── The handoff to the real writing screens ────────────────────────────

describe('handing the child to the writing screen', () => {
  it('sends ONE case at a time, earlier case first', () => {
    expect(handoff).toMatch(/p\.caseType === 'lowercase'/);
    expect(handoff).toMatch(/p\.caseType === 'uppercase'/);
    expect(handoff).toMatch(/route: 'LetterWriting', caseType: 'lowercase'/);
    expect(handoff).toMatch(/route: 'UppercaseWriting', caseType: 'uppercase'/);
  });

  it('passes the caseType, so the target screen does not filter the batch away', () => {
    // LetterWritingScreen filters the sequence it receives down to its own
    // caseType, defaulting to 'lowercase' — the bug that dropped 10 letters.
    expect(handoff).toMatch(/caseType: batch\.caseType/);
    expect(letterScreen).toMatch(/letterSequence\.filter\(l => l\.caseType === caseType\)/);
  });

  it('passes collectionMode and the checks own collection_session_id', () => {
    expect(handoff).toMatch(/collectionMode: true/);
    expect(handoff).toMatch(/collectionSessionId: state\.check\.collection_session_id/);
    expect(handoff).toMatch(/writingCheckId: state\.check\.id/);
  });

  it('sends the protocol order it was given, never a local letter list', () => {
    expect(handoff).toMatch(/batch\.pairs\.map\(p => \(\{ letter: p\.letter, caseType: p\.caseType \}\)\)/);
    // No second hardcoded 20-letter list anywhere in the screen.
    expect(screen).not.toMatch(/'[a-z]',\s*'[a-z]',\s*'[a-z]'/);
    expect(screen).toMatch(/WRITING_CHECK_REQUIRED_COUNT/);
    expect(WRITING_CHECK_REQUIRED_COUNT).toBe(20);
  });

  it('does nothing rather than navigating with no batch or no check', () => {
    expect(handoff).toMatch(/if \(!batch \|\| !state\.check\) return;/);
  });

  it('never routes into the normal adaptive sequence', () => {
    expect(handoff).not.toMatch(/LetterPractice|LetterHome|adaptiveSequenc/);
  });
});

// ─── Returning from a batch ─────────────────────────────────────────────

describe('a finished batch comes back to the Writing Check', () => {
  for (const [name, src] of [['lowercase', letterScreen], ['uppercase', upperScreen]]) {
    it(`${name}: reads writingCheckId from the route`, () => {
      expect(src).toMatch(/writingCheckId = null,/);
    });

    it(`${name}: returns to WritingCheck instead of the data-collection flow`, () => {
      expect(src).toMatch(/if \(writingCheckId\) \{[\s\S]*?navigation\.navigate\('WritingCheck', \{ student, theme \}\)/);
    });
  }

  it('lowercase no longer falls into the RESEARCH uppercase protocol', () => {
    const branch = between(letterScreen, 'if (isAllDone) {', 'Fixed research protocol');
    // The data-collection continuation still exists — it is now the ELSE.
    expect(branch).toMatch(/if \(writingCheckId\) \{/);
    expect(branch).toMatch(/\} else if \(collectionMode && caseType === 'lowercase'\) \{/);
    expect(branch).toMatch(/DATA_COLLECTION_PROTOCOL\.uppercase/);
    expect(branch.indexOf('writingCheckId')).toBeLessThan(branch.indexOf('DATA_COLLECTION_PROTOCOL'));
  });

  it('uppercase no longer ends a Writing Check on the data-collection screen', () => {
    const branch = between(upperScreen, 'if (isAllDone) {', 'Fixed research protocol');
    expect(branch.indexOf('writingCheckId')).toBeLessThan(branch.indexOf('DataCollectionDone'));
  });

  it('data collection is UNCHANGED when no writingCheckId is present', () => {
    // The research protocol's own continuations are still there, untouched.
    expect(letterScreen).toMatch(/letterSequence: DATA_COLLECTION_PROTOCOL\.uppercase/);
    expect(upperScreen).toMatch(/navigation\.navigate\('DataCollectionDone', \{ student, theme, collectionSessionId \}\)/);
  });
});

// ─── Resume, and completion ─────────────────────────────────────────────

describe('resume and completion', () => {
  it('resumes from live progress, never from the started response alone', () => {
    expect(loader).toMatch(/fetchWritingCheckProgress\(started\.check\.id\)/);
    expect(loader).toMatch(/progress\.status === 'found' \? progress\.remaining : started\.remaining/);
    expect(loader).toMatch(/progress\.status === 'found' \? progress\.capturedCount : 0/);
  });

  it('starts at most one check — start is called once per load', () => {
    expect((loader.match(/startWritingCheck\(/g) ?? []).length).toBe(1);
  });

  it('a fully captured check completes and shows done, never a spinner', () => {
    expect(loader).toMatch(/if \(remaining\.length === 0\) \{/);
    expect(loader).toMatch(/await completeWritingCheck\(started\.check\.id\)/);
    expect(loader).toMatch(/phase: 'done'/);
    expect(screen).toMatch(/All done!/);
  });

  it('a partly done check shows its real count and says "Keep going"', () => {
    expect(screen).toMatch(/state\.captured > 0 \? 'Keep going' : 'Start'/);
    expect(screen).toMatch(/\{state\.captured\} of \{WRITING_CHECK_REQUIRED_COUNT\}/);
  });
});

// ─── Contract with the backend ──────────────────────────────────────────

describe('the client reads the fields the backend actually sends', () => {
  it('start: status / check / remaining / required_count', () => {
    expect(client).toMatch(/data\.status !== 'started' && data\.status !== 'resumed'/);
    expect(client).toMatch(/check: data\.check \?\? null/);
    expect(client).toMatch(/Array\.isArray\(data\.remaining\)/);
    expect(client).toMatch(/data\.required_count/);
  });

  it('progress: status / check / captured_count / remaining / complete', () => {
    expect(client).toMatch(/data\.status !== 'found'/);
    expect(client).toMatch(/capturedCount: data\.captured_count \?\? 0/);
    expect(client).toMatch(/complete: Boolean\(data\.complete\)/);
  });

  it('the client never throws, so a network failure is a phase, not a crash', () => {
    expect((client.match(/catch \(err\)/g) ?? []).length).toBeGreaterThanOrEqual(4);
    expect(client).toMatch(/const FAILSAFE = Object\.freeze\(\{ status: 'unavailable'/);
  });

  it('the endpoints are the ones the routes register', () => {
    expect(endpoints).toMatch(/WRITING_CHECK_START:\s*\(\) => '\/handwriting\/writing-check\/start'/);
    expect(endpoints).toMatch(/WRITING_CHECK_PROGRESS: \(checkId\) => `\/handwriting\/writing-check\/\$\{checkId\}\/progress`/);
  });
});

// ─── Route + navigation params ──────────────────────────────────────────

describe('routing', () => {
  it('WritingCheck is registered in the handwriting stack', () => {
    expect(navigator).toMatch(/name="WritingCheck"/);
    expect(navigator).toMatch(/component=\{WritingCheckScreen\}/);
  });

  it('the screen needs only the params its callers actually pass', () => {
    expect(screen).toMatch(/const \{ student, theme \} = route\.params \?\? \{\};/);
    for (const caller of ['../screens/handwriting/LetterHomeScreen.js',
      '../screens/handwriting/reports/TeacherReportScreen.js']) {
      expect(read(caller)).toMatch(/navigation\.navigate\('WritingCheck', \{ student, theme \}\)/);
    }
    // The check id is fetched, never expected as a param — so a missing param
    // cannot produce a permanent spinner.
    expect(screen).not.toMatch(/route\.params\??\.?\.?(checkId|writingCheckId|patternCheckId)/);
  });

  it('is landscape, like every other child writing screen', () => {
    expect(screen).toMatch(/useLockLandscape\(\)/);
  });
});

// ─── The demo detour must not intercept a Writing Check ─────────────────

describe('the "watch first" demo never interrupts a Writing Check', () => {
  it('the letter detour is gated on collection mode', () => {
    const detour = between(letterScreen, 'const categoryDemoKey', 'Tracer dot animation');
    expect(detour).toMatch(/collectionMode,/);
    expect(read('./demoDetour.js')).toMatch(/if \(collectionMode\) return false;/);
    expect(read('./demoPolicy.js')).toMatch(/if \(collectionMode\) return false;/);
  });

  it('and a Writing Check batch carries no category, so no key can resolve', () => {
    // Second, independent guard: the pairs handed over are {letter, caseType}
    // only — makeLetterCategoryDemoKey returns null without a category.
    expect(handoff).toMatch(/\{ letter: p\.letter, caseType: p\.caseType \}/);
    expect(handoff).not.toMatch(/category/);
    const { makeLetterCategoryDemoKey } = require('./demoPolicy');
    expect(makeLetterCategoryDemoKey({ caseType: 'lowercase', category: undefined })).toBeNull();
  });
});

// ─── The shared stage still works in collection mode ────────────────────

describe('the extracted LetterWritingStage still serves collection mode', () => {
  const stage = read('../components/handwriting/LetterWritingStage.js');

  it('the practice screens still pass every capture-critical prop', () => {
    for (const src of [letterScreen, upperScreen]) {
      const call = src.slice(src.indexOf('<LetterWritingStage'), src.indexOf('/>', src.indexOf('<LetterWritingStage')));
      for (const prop of ['mode="practice"', 'guideOpacity={guideOpacity}',
        'supportPresentation={supportPresentation}', 'panHandlers={panResponder.panHandlers}',
        'canvasRef={canvasRef}', 'onCanvasLayout={measureCanvasOrigin}',
        'allPaths={allPaths}', 'currentPath={currentPath}', 'rawPath={LETTER_PATHS[letter]}']) {
        expect(call).toContain(prop);
      }
    }
  });

  it('collection mode still resolves its own guide opacity and support level', () => {
    for (const src of [letterScreen, upperScreen]) {
      expect(src).toMatch(/resolveSessionSupportLevel\(\{ attempt, collectionMode/);
      expect(src).toMatch(/getSupportPresentation\(\{ supportLevel, attempt, collectionMode \}\)/);
    }
  });

  it('the stage attaches real touch handlers in practice mode', () => {
    expect(stage).toMatch(/ref: canvasRef, onLayout: onCanvasLayout, \.\.\.\(panHandlers \?\? \{\}\)/);
    expect(stage).toMatch(/width=\{CANVAS_W\} height=\{CANVAS_H\}/);
  });
});
