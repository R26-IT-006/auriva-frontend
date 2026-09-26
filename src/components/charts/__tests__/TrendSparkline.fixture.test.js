/**
 * TASK-47 AC1 — the timeline endpoints' `points` payload must be exactly what
 * TrendSparkline consumes. These fixtures are copied verbatim from the backend
 * services' own output shape (dialogueAnalyticsService / level2AnalyticsService),
 * so a drift on either side fails here rather than silently rendering nothing.
 *
 * TrendSparkline itself is shared infrastructure and is NOT modified by this
 * task — this only renders it. `act()` wrapping follows the convention
 * portrait.test.js already established in this repo.
 */
import { create, act } from 'react-test-renderer';
import { TrendSparkline } from '../TrendSparkline';

// Exactly what dialogueAnalyticsService.getWordTimeline returns for the
// "attempted on the 24th, again on the 26th" case.
const LEVEL1_WORD_POINTS = [
  { date: '2026-08-24', attempts: 4, correct: 1, accuracy: 0.25 },
  { date: '2026-08-26', attempts: 3, correct: 3, accuracy: 1 },
];

// Exactly what level2AnalyticsService.getTopicTimeline returns.
const LEVEL2_TOPIC_POINTS = [
  { date: '2026-08-24', attempts: 1, correct: 0, accuracy: 0.4 },
  { date: '2026-08-26', attempts: 1, correct: 1, accuracy: 1 },
];

/**
 * Concatenates every string the tree renders. JSX splits `{n}% latest` into
 * separate text children, so the serialised JSON alone would not contain the
 * caption as a teacher reads it — flattening first makes the assertions match
 * what actually appears on screen.
 */
function flatten(node) {
  if (node == null) return '';
  if (typeof node === 'string') return node;
  if (Array.isArray(node)) return node.map(flatten).join('');
  return flatten(node.children);
}

/** Renders and returns the tree plus its visible text. */
function render(props) {
  let root;
  act(() => { root = create(<TrendSparkline {...props} />); });
  return { root, text: flatten(root.toJSON()) };
}

describe('TrendSparkline accepts the timeline payload shape', () => {
  it('renders Level 1 word history without prop-shape errors', () => {
    const spy = jest.spyOn(console, 'error').mockImplementation(() => {});
    const { root } = render({ points: LEVEL1_WORD_POINTS, width: 220, height: 48 });
    expect(root.toJSON()).toBeTruthy();
    expect(spy).not.toHaveBeenCalled();
    spy.mockRestore();
  });

  it('renders Level 2 topic history without prop-shape errors', () => {
    const spy = jest.spyOn(console, 'error').mockImplementation(() => {});
    const { root } = render({ points: LEVEL2_TOPIC_POINTS, width: 220, height: 48 });
    expect(root.toJSON()).toBeTruthy();
    expect(spy).not.toHaveBeenCalled();
    spy.mockRestore();
  });

  it('AC3 — two dated points render as a range, not a single date', () => {
    const { text } = render({ points: LEVEL1_WORD_POINTS });
    // The component's own caption proves both dates survived into the chart.
    expect(text).toContain('2026-08-24');
    expect(text).toContain('2026-08-26');
    expect(text).toContain('100% latest');
  });

  it('renders the Level 2 fixture\'s own dates and latest value', () => {
    const { text } = render({ points: LEVEL2_TOPIC_POINTS });
    expect(text).toContain('2026-08-24');
    expect(text).toContain('2026-08-26');
    expect(text).toContain('100% latest');
  });

  it('falls back to its own empty state for an empty points array', () => {
    const { text } = render({ points: [] });
    expect(text).toContain('Not enough activity yet to show a trend.');
  });

  it('ignores a point whose accuracy is null rather than plotting it as zero', () => {
    // The services emit accuracy: null when a date has no scoreable attempt.
    const { text } = render({
      points: [{ date: '2026-08-24', attempts: 0, correct: 0, accuracy: null }],
    });
    expect(text).toContain('Not enough activity yet to show a trend.');
  });

  it('renders a single-date history as a lone point, not a broken line', () => {
    const { text } = render({
      points: [{ date: '2026-08-24', attempts: 2, correct: 1, accuracy: 0.5 }],
    });
    expect(text).toContain('2026-08-24');
    expect(text).toContain('50% latest');
  });
});
