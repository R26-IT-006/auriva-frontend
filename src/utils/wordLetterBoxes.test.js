import { buildWordGuide, buildWordLetterBoxes, wordGuideToSvgPath } from '../data/wordPaths';
import WORD_DATA from '../data/wordData';

const W = 490, H = 220;

// Word-writing guide-boxes task — pure-logic tests for buildWordLetterBoxes,
// matching this repo's existing test style (no React Native rendering
// harness is set up in this project; component-level behaviour — which
// attempts show boxes, that boxes never intercept touches, etc. — is
// verified by code review in the final report, not by a render() test).

describe('buildWordLetterBoxes — box count / structure', () => {
  test('CAT renders exactly 3 guide boxes', () => {
    const boxes = buildWordLetterBoxes('cat', W, H);
    expect(boxes).toHaveLength(3);
  });

  test('box count equals word length for a range of supported words', () => {
    for (const word of ['ox', 'bee', 'lamp', 'apple', 'butterfly', 'elephant']) {
      expect(buildWordLetterBoxes(word, W, H)).toHaveLength(word.length);
    }
  });

  test('an unsupported/empty word yields no boxes rather than throwing', () => {
    expect(buildWordLetterBoxes('123', W, H)).toEqual([]);
    expect(buildWordLetterBoxes('', W, H)).toEqual([]);
    expect(buildWordLetterBoxes(null, W, H)).toEqual([]);
  });

  test('non-finite or non-positive canvas dimensions yield no boxes rather than throwing', () => {
    expect(buildWordLetterBoxes('cat', NaN, H)).toEqual([]);
    expect(buildWordLetterBoxes('cat', W, 0)).toEqual([]);
    expect(buildWordLetterBoxes('cat', -10, H)).toEqual([]);
  });
});

describe('buildWordLetterBoxes — uppercase/lowercase template use', () => {
  test('first letter uses the uppercase canonical template (different real geometry than the lowercase letter)', () => {
    // 'Cat' — capital C's template spans fy 0.08–0.64 (cap height); lowercase
    // 'c' spans only fy 0.36–0.64 (x-height). The first box must reflect the
    // UPPERCASE template's own bounds, not a lowercase 'c' scaled up.
    const boxes = buildWordLetterBoxes('cat', W, H);
    const lowercaseCBox = buildWordLetterBoxes('act', W, H)[1]; // 'c' as a non-first (lowercase) letter
    expect(boxes[0].height).not.toBeCloseTo(lowercaseCBox.height, 1);
  });

  test('later letters use lowercase canonical templates', () => {
    const boxes = buildWordLetterBoxes('cat', W, H);
    expect(boxes[1].letter).toBe('a');
    expect(boxes[2].letter).toBe('t');
  });

  test("letter field matches the word's own characters in order", () => {
    const boxes = buildWordLetterBoxes('apple', W, H);
    expect(boxes.map(b => b.letter)).toEqual(['a', 'p', 'p', 'l', 'e']);
  });
});

describe('buildWordLetterBoxes — natural, non-uniform sizing', () => {
  test('boxes are not forced to identical width', () => {
    const boxes = buildWordLetterBoxes('cat', W, H);
    const widths = boxes.map(b => b.width);
    expect(new Set(widths.map(w => Math.round(w))).size).toBeGreaterThan(1);
  });

  test('boxes reflect real template proportions — a wide letter (m) is proportionally wider than a narrow one (i)', () => {
    const boxesM = buildWordLetterBoxes('mud', W, H);
    const boxesI = buildWordLetterBoxes('imp', W, H);
    // Compare each letter's box width relative to ITS OWN word's average
    // width, since absolute widths shift slightly between different words'
    // total layouts — the point is 'm' is proportionally wide, 'i' is not.
    const relM = boxesM[0].width / (boxesM.reduce((s, b) => s + b.width, 0) / boxesM.length);
    const relI = boxesI[0].width / (boxesI.reduce((s, b) => s + b.width, 0) / boxesI.length);
    expect(relM).toBeGreaterThan(relI);
  });
});

describe('buildWordLetterBoxes — degenerate/narrow-letter handling', () => {
  test('lowercase l (near-zero template width) still receives a usable, non-zero visual box width', () => {
    const boxes = buildWordLetterBoxes('elf', W, H);
    const lBox = boxes[1]; // 'e', 'l', 'f'
    expect(lBox.letter).toBe('l');
    expect(lBox.width).toBeGreaterThan(4); // comfortably non-zero in pixel space
  });

  test("the degenerate-width floor does not remove non-degenerate neighbours' letters", () => {
    const boxes = buildWordLetterBoxes('elf', W, H);
    expect(boxes[0].letter).toBe('e');
    expect(boxes[2].letter).toBe('f');
    expect(boxes[0].width).toBeGreaterThan(0);
    expect(boxes[2].width).toBeGreaterThan(0);
  });
});

describe('buildWordLetterBoxes — inter-box spacing follows canonical layout', () => {
  test('gaps between consecutive boxes are consistent with each other (single canonical gap per word)', () => {
    const boxes = buildWordLetterBoxes('cat', W, H);
    const gap1 = boxes[1].x - (boxes[0].x + boxes[0].width);
    const gap2 = boxes[2].x - (boxes[1].x + boxes[1].width);
    expect(Math.abs(gap1 - gap2)).toBeLessThan(Math.max(gap1, gap2) * 0.6 + 5);
  });

  test('boxes never overlap their neighbours for a straightforward supported word', () => {
    const boxes = buildWordLetterBoxes('sun', W, H);
    for (let i = 0; i < boxes.length - 1; i++) {
      expect(boxes[i + 1].x).toBeGreaterThanOrEqual(boxes[i].x + boxes[i].width - 1); // -1px float tolerance
    }
  });
});

describe('buildWordLetterBoxes — same transform as the reference path', () => {
  test("every box fully contains its own letter's reference-path points", () => {
    const word = 'cat';
    const guide = buildWordGuide(word);
    const boxes = buildWordLetterBoxes(word, W, H);
    const aspect = W / H;
    const aspectX = fx => (0.5 + (fx - 0.5) / aspect) * W;
    guide.strokeDescriptors.forEach(({ points, letterIndex }) => {
      const box = boxes[letterIndex];
      points.forEach(p => {
        const x = aspectX(p.fx);
        const y = p.fy * H;
        expect(x).toBeGreaterThanOrEqual(box.x - 0.5);
        expect(x).toBeLessThanOrEqual(box.x + box.width + 0.5);
        expect(y).toBeGreaterThanOrEqual(box.y - 0.5);
        expect(y).toBeLessThanOrEqual(box.y + box.height + 0.5);
      });
    });
  });

  test('the reference SVG path itself renders (non-empty) at the same canvas the boxes are computed for', () => {
    const guide = buildWordGuide('cat');
    const d = wordGuideToSvgPath(guide.strokeDescriptors, W, H);
    expect(d.length).toBeGreaterThan(0);
  });
});

describe('buildWordLetterBoxes — responsive / device scaling', () => {
  test('2x canvas scale preserves proportional layout (each box scales by the same factor)', () => {
    const small = buildWordLetterBoxes('cat', W, H);
    const large = buildWordLetterBoxes('cat', W * 2, H * 2);
    small.forEach((box, i) => {
      expect(large[i].width).toBeCloseTo(box.width * 2, 0);
      expect(large[i].height).toBeCloseTo(box.height * 2, 0);
      expect(large[i].x).toBeCloseTo(box.x * 2, 0);
      expect(large[i].y).toBeCloseTo(box.y * 2, 0);
    });
  });

  test('a narrow canvas (different aspect ratio) still produces finite, ordered boxes', () => {
    const boxes = buildWordLetterBoxes('cat', 300, 220);
    expect(boxes).toHaveLength(3);
    boxes.forEach(b => {
      expect(Number.isFinite(b.x)).toBe(true);
      expect(Number.isFinite(b.y)).toBe(true);
      expect(Number.isFinite(b.width)).toBe(true);
      expect(Number.isFinite(b.height)).toBe(true);
      expect(b.width).toBeGreaterThan(0);
      expect(b.height).toBeGreaterThan(0);
    });
  });
});

describe('buildWordLetterBoxes — long words stay on canvas', () => {
  test('the longest supported words still produce boxes whose combined span fits within the canvas width', () => {
    const longWords = WORD_DATA.map(entry => entry.word).sort((a, b) => b.length - a.length).slice(0, 5);
    longWords.forEach(word => {
      const boxes = buildWordLetterBoxes(word, W, H);
      const last = boxes[boxes.length - 1];
      // buildWordGuide() normalizes the whole word into fx in [0,1], so the
      // rightmost box's right edge should land at/near the canvas's own
      // right edge (via the same aspect transform), never drift off-canvas.
      expect(last.x + last.width).toBeLessThan(W * 1.05);
      expect(boxes[0].x).toBeGreaterThan(-W * 0.05);
    });
  });
});

describe('buildWordLetterBoxes — 154-word canonical sweep', () => {
  test('every currently-supported word produces finite, positive-size box geometry with zero throws', () => {
    const words = WORD_DATA.map(entry => entry.word);
    expect(words.length).toBe(154);
    words.forEach(word => {
      let boxes;
      expect(() => { boxes = buildWordLetterBoxes(word, W, H); }).not.toThrow();
      // A handful of display words contain a hyphen/space ("x-mas tree",
      // "yo-yo", "zig-zag") — buildWordGuide() (and therefore this function)
      // strips non-letters before laying out boxes, same as it always has
      // for the reference path itself, so box count matches the CLEANED
      // letter count, not the raw display string's length.
      const cleanedLength = word.replace(/[^a-zA-Z]/g, '').length;
      expect(boxes.length).toBe(cleanedLength);
      boxes.forEach(b => {
        expect(Number.isFinite(b.x)).toBe(true);
        expect(Number.isFinite(b.y)).toBe(true);
        expect(Number.isFinite(b.width)).toBe(true);
        expect(Number.isFinite(b.height)).toBe(true);
        expect(b.width).toBeGreaterThan(0);
        expect(b.height).toBeGreaterThan(0);
      });
    });
  });
});

describe('buildWordLetterBoxes — no effect on scoring geometry', () => {
  test("calling buildWordLetterBoxes does not mutate or otherwise affect buildWordGuide's own output", () => {
    const before = JSON.stringify(buildWordGuide('cat'));
    buildWordLetterBoxes('cat', W, H);
    const after = JSON.stringify(buildWordGuide('cat'));
    expect(after).toEqual(before);
  });
});
