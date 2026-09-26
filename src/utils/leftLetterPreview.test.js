const fs = require('fs');
const path = require('path');
const {
  LEFT_PREVIEW_SHAPES,
  LEFT_PREVIEW_STROKE_WIDTH,
  LEFT_PREVIEW_VIEW_BOX,
} = require('../constants/leftLetterPreviewShapes');

const ROOT = path.resolve(__dirname, '../..');
const read = (relativePath) => fs.readFileSync(path.join(ROOT, relativePath), 'utf8');

describe('final left-preview policy: custom a/I only', () => {
  const stage = read('src/components/handwriting/LetterWritingStage.js');
  const lower = read('src/screens/handwriting/LetterWritingScreen.js');
  const upper = read('src/screens/handwriting/uppercase/UppercaseWritingScreen.js');
  const layout = read('src/constants/letterCanvasLayout.js');
  const dtw = read('src/utils/dtw.js');
  const scoring = read('src/utils/trajectoryFeatures.js');
  const leftPreviewBlock = stage.slice(
    stage.indexOf('{/* Left column'),
    stage.indexOf('{/* Right column'),
  );

  test('contains exactly the approved lowercase a and uppercase I overrides', () => {
    expect(Object.keys(LEFT_PREVIEW_SHAPES)).toEqual(['a', 'I']);
    expect(Object.isFrozen(LEFT_PREVIEW_SHAPES)).toBe(true);
    expect(LEFT_PREVIEW_STROKE_WIDTH).toBe(14);
    expect(LEFT_PREVIEW_VIEW_BOX).toBe('0 0 100 100');
  });

  test('keeps the approved connected lowercase a geometry exactly', () => {
    expect(LEFT_PREVIEW_SHAPES.a.elements).toHaveLength(1);
    expect(LEFT_PREVIEW_SHAPES.a.elements[0]).toEqual({
      type: 'path',
      d: 'M 69 27 L 69 54 C 69 69 60 79 47 79 C 32 79 22 69 22 54 C 22 39 31 28 47 28 C 60 28 69 38 69 54 L 69 72 C 69 78 73 80 77 77',
    });
  });

  test('keeps the approved uppercase I geometry exactly', () => {
    expect(LEFT_PREVIEW_SHAPES.I.elements).toEqual([
      { type: 'line', x1: 22, y1: 18, x2: 78, y2: 18 },
      { type: 'line', x1: 50, y1: 18, x2: 50, y2: 82 },
      { type: 'line', x1: 22, y1: 82, x2: 78, y2: 82 },
    ]);
  });

  test.each(['b', 'g', 'A', 'R'])('%s has no custom override', (letter) => {
    expect(LEFT_PREVIEW_SHAPES[letter]).toBeUndefined();
  });

  test('restores the original Text renderer and exact historical typography for every non-override', () => {
    expect(leftPreviewBlock).toContain('<Text style={[styles.letterCardText, { color: theme.buttonText }]}>');
    expect(leftPreviewBlock).toContain('{letter}');
    expect(stage).toMatch(/letterCardText:\s*\{\s*fontSize: Math\.round\(LETTER_CARD_SIZE \* 0\.60\),\s*fontWeight: '900',\s*lineHeight: Math\.round\(LETTER_CARD_SIZE \* 0\.75\),/);
    expect(stage).toContain('const previewShape = LEFT_PREVIEW_SHAPES[letter] ?? null;');
  });

  test('never uses canonical rawPath as the non-a/I left-preview fallback', () => {
    expect(leftPreviewBlock).not.toContain('rawPath');
    expect(leftPreviewBlock).not.toContain('toSmoothPath');
    expect(leftPreviewBlock).not.toContain('toStraightPath');
    expect(leftPreviewBlock).not.toContain('getCanonicalPreviewViewBox');
    expect(leftPreviewBlock).not.toContain('LETTER_PATHS');
  });

  test('keeps the right guide on its unchanged canonical rawPath policy', () => {
    expect(stage.match(/d=\{isAngular \? toStraightPath\(rawPath\) : toSmoothPath\(rawPath\)\}/g))
      .toHaveLength(1);
    expect(stage).toContain('{guideOpacity > 0 && rawPath && (');
    expect(stage).toContain('getGhostDots(rawPath).map((dot, idx) => (');
  });

  test.each([
    ['lowercase', lower],
    ['uppercase', upper],
  ])('%s writing screen still supplies only its canonical LETTER_PATHS target', (_name, source) => {
    expect(source).toContain('rawPath={LETTER_PATHS[letter]}');
    expect(source).toContain('isAngular={ANGULAR_LETTERS.has(letter)}');
    expect(source).not.toContain('LEFT_PREVIEW_SHAPES');
    expect(source).not.toContain('leftLetterPreviewShapes');
  });

  test('preview geometry cannot enter DTW or scoring', () => {
    expect(dtw).not.toContain('leftLetterPreviewShapes');
    expect(scoring).not.toContain('leftLetterPreviewShapes');
  });

  test('keeps the approved card and all right-side allocations unchanged', () => {
    expect(stage).toContain('const PREVIEW_CARD_SIZE = Math.round(LETTER_CARD_SIZE * 0.88);');
    expect(stage).toMatch(/letterCard:\s*\{\s*width: PREVIEW_CARD_SIZE,\s*height: PREVIEW_CARD_SIZE/);
    expect(stage).toMatch(/letterCol:\s*\{\s*width: COL_L/);
    expect(layout).toMatch(/export const COL_L\s+= Math\.round\(SCREEN_W \* 0\.43\)/);
    expect(layout).toMatch(/export const CANVAS_W\s+= SCREEN_W - COL_L - PAD \* 2/);
    expect(layout).toMatch(/export const CANVAS_H\s+= Math\.round\(SCREEN_H \* 0\.50\)/);
    expect(stage).toContain('...(panHandlers ?? {})');
    expect(stage).toContain('<Line x1={0} y1={LINE_1} x2={CANVAS_W}');
    expect(stage).toContain('<Line x1={0} y1={LINE_4} x2={CANVAS_W}');
  });
});
