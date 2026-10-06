// The "How it works" flow overview (data/conceptFlow.js) must describe the
// Concept module the way the screens actually run it.
//
// conceptPairMatch.js (source of MIN_PAIRS) imports the asset-heavy catalogue,
// whose .m4a requires this node project can't load — so the catalogue is
// mocked; buildConceptFlow takes its catalogue facts as arguments anyway.

jest.mock('../data/conceptData', () => ({
  getConceptItemsForCategory: () => [],
  categoryHasPairMatch: () => true,
}));

import { buildConceptFlow } from '../data/conceptFlow';
import { MIN_PAIRS } from '../data/conceptPairMatch';

const CATEGORIES = [
  { key: 'colors',  label: 'Colours',          items: [{ key: 'red' }] },
  { key: 'fruits',  label: 'Fruits',           items: [{ key: 'apple' }] },
  { key: 'family',  label: 'Family Members',   items: [{ key: 'mother' }] },
  { key: 'nature',  label: 'Natural Environment', items: [] },
];
const NO_VIDEO = new Set(['colors', 'family', 'nature']);
const hasVideo = (key) => !NO_VIDEO.has(key);

describe('Concept "How it works" flow', () => {
  const flow = buildConceptFlow(CATEGORIES, hasVideo);

  test('stages run in the module order: choose → T1 → T2 → T3 → learnt → games → badge', () => {
    expect(flow.map((s) => s.key)).toEqual(
      ['choose', 'tier1', 'tier2', 'tier3', 'mastered', 'games', 'badge'],
    );
    expect(flow.filter((s) => s.kind === 'tier').map((s) => s.tier)).toEqual([1, 2, 3]);
  });

  test('the two assessed tiers explain the support given after a mistake', () => {
    for (const key of ['tier1', 'tier2']) {
      expect(flow.find((s) => s.key === key).ifWrong).toEqual(expect.any(String));
    }
    expect(flow.find((s) => s.key === 'tier3').ifWrong).toBeUndefined();
  });

  test('the game unlock threshold comes from the shared MIN_PAIRS constant', () => {
    expect(flow.find((s) => s.key === 'games').childDoes).toContain(`after ${MIN_PAIRS}`);
  });

  test('the video-stage note lists exactly the authored categories without video', () => {
    // Natural Environment has no concepts yet, so it is not mentioned.
    expect(flow.find((s) => s.key === 'tier3').note).toBe('Skipped for Colours, Family Members.');
  });

  test('no video note when every category has the video stage', () => {
    const all = buildConceptFlow(CATEGORIES, () => true);
    expect(all.find((s) => s.key === 'tier3').note).toBeNull();
  });
});
