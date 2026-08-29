const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '../..');
const read = (relativePath) => fs.readFileSync(path.join(ROOT, relativePath), 'utf8');

describe('left-panel handwriting letterforms', () => {
  const stage = read('src/components/handwriting/LetterWritingStage.js');
  const lower = read('src/screens/handwriting/LetterWritingScreen.js');
  const upper = read('src/screens/handwriting/uppercase/UppercaseWritingScreen.js');
  const layout = read('src/constants/letterCanvasLayout.js');

  test('replaces the left font glyph with canonical vector geometry', () => {
    expect(stage).not.toMatch(/styles\.letterCardText/);
    expect(stage).not.toMatch(/letterCardText:/);
    expect(stage).toContain('viewBox={getCanonicalPreviewViewBox(rawPath)}');
    expect(stage).toContain('preserveAspectRatio="xMidYMid meet"');
  });

  test('left preview and right guide use the same rawPath and curve policy', () => {
    expect(stage.match(/d=\{isAngular \? toStraightPath\(rawPath\) : toSmoothPath\(rawPath\)\}/g))
      .toHaveLength(2);
    expect(stage).toContain('getGhostDots(rawPath).map((dot, idx) => (');
  });

  test.each([
    ['lowercase', lower],
    ['uppercase', upper],
  ])('%s supplies its current canonical target to the shared preview', (_name, source) => {
    expect(source).toContain('rawPath={LETTER_PATHS[letter]}');
    expect(source).toContain('isAngular={ANGULAR_LETTERS.has(letter)}');
  });

  test('the referenced lowercase a and uppercase I handwriting paths exist', () => {
    expect(lower).toMatch(/\ba:\s*\[/);
    expect(upper).toMatch(/\bI:\s*\[/);
  });

  test('reduces only the card inside the existing left column by 12 percent', () => {
    expect(stage).toContain('const PREVIEW_CARD_SIZE = Math.round(LETTER_CARD_SIZE * 0.88);');
    expect(stage).toMatch(/letterCard:\s*\{\s*width: PREVIEW_CARD_SIZE,\s*height: PREVIEW_CARD_SIZE/);
    expect(stage).toMatch(/letterCol:\s*\{\s*width: COL_L/);
  });

  test('right-side canvas allocation and established drawing hooks remain unchanged', () => {
    expect(layout).toMatch(/export const COL_L\s+= Math\.round\(SCREEN_W \* 0\.43\)/);
    expect(layout).toMatch(/export const CANVAS_W\s+= SCREEN_W - COL_L - PAD \* 2/);
    expect(layout).toMatch(/export const CANVAS_H\s+= Math\.round\(SCREEN_H \* 0\.50\)/);
    expect(stage).toContain('...(panHandlers ?? {})');
    expect(stage).toContain('{guideOpacity > 0 && rawPath && (');
    expect(stage).toContain('<Line x1={0} y1={LINE_1} x2={CANVAS_W}');
    expect(stage).toContain('<Line x1={0} y1={LINE_4} x2={CANVAS_W}');
  });
});
