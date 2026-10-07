/**
 * TASK-48 — print/export for the two dialogue reports.
 *
 * The point of these tests is AC2: the printed line must be the SAME string the
 * screen renders, not a lookalike. So the expectations here are built from the
 * screens' own exported helpers/constants rather than from copied literals — if
 * either screen's wording changes, these fail.
 */
jest.mock('expo-print', () => ({
  printAsync: jest.fn(),
  printToFileAsync: jest.fn(),
}));
jest.mock('expo-sharing', () => ({
  isAvailableAsync: jest.fn(),
  shareAsync: jest.fn(),
}));

// The screens are imported here only for their pure print/wording helpers, but
// importing them pulls in api/client.js → axios, whose fetch adapter throws at
// module load under jest-expo's stream polyfill. Stubbing the two api modules
// keeps this a unit test of the wording, which is all it is asserting.
jest.mock('../../api/dialogue', () => ({ dialogueApi: {} }));
jest.mock('../../api/level2', () => ({ level2Api: {} }));

import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { buildReportHtml, printReport } from '../reportPrint';
import {
  PLAIN_SCORE_LEAD,
  TIER2_RELIABILITY_CAVEAT,
  WORD_STATUS,
  buildTrajectoryPrintModel,
} from '../../screens/teacher/dialogue/TrajectoryReportScreen';
import {
  paragraphSentence,
  attemptSentence,
  buildLevel2PrintModel,
} from '../../screens/teacher/dialogue/Level2ReportScreen';

beforeEach(() => {
  jest.clearAllMocks();
  Print.printAsync.mockResolvedValue(undefined);
  Print.printToFileAsync.mockResolvedValue({ uri: 'file:///tmp/report.pdf' });
  Sharing.isAvailableAsync.mockResolvedValue(true);
  Sharing.shareAsync.mockResolvedValue(undefined);
});

// ---------------------------------------------------------------------------
// AC3 — self-contained, offline-safe document
// ---------------------------------------------------------------------------

describe('AC3 — the built HTML is fully self-contained', () => {
  const html = buildReportHtml({
    title: 'Level 1 Trajectory Report',
    studentName: 'Pansilu Binara Rathnayake',
    generatedAt: 'Aug 20, 2026',
    overview: [{ label: 'Fast', value: '2' }],
    sections: [{ heading: 'Greetings', lines: ['hello — fast.'] }],
    footnote: 'Based on the most recent session.',
  });

  it('contains no script tag', () => {
    expect(html).not.toMatch(/<script/i);
  });

  it('references no external resource', () => {
    expect(html).not.toMatch(/<link/i);
    expect(html).not.toMatch(/https?:\/\//);
    expect(html).not.toMatch(/@import/i);
    expect(html).not.toMatch(/src\s*=/i);
  });

  it('declares utf-8 so the plain-language em dashes survive printing', () => {
    expect(html).toContain('<meta charset="utf-8">');
  });

  it('escapes user data rather than interpolating it raw', () => {
    const nasty = buildReportHtml({
      title: 'R',
      studentName: '<script>alert(1)</script> & "friends"',
      sections: [{ heading: 'A & B', lines: ['5 < 6'] }],
    });
    expect(nasty).not.toMatch(/<script>alert/);
    expect(nasty).toContain('&lt;script&gt;');
    expect(nasty).toContain('A &amp; B');
    expect(nasty).toContain('5 &lt; 6');
  });
});

// ---------------------------------------------------------------------------
// AC5 — a brand-new student still prints
// ---------------------------------------------------------------------------

describe('AC5 — empty reports still produce valid HTML', () => {
  it('does not throw on an empty sections array', () => {
    expect(() => buildReportHtml({ title: 'R', sections: [], overview: [] })).not.toThrow();
  });

  it('says so plainly instead of rendering a blank page', () => {
    const html = buildReportHtml({ title: 'R', sections: [], overview: [] });
    expect(html).toContain('No activity has been recorded for this student yet.');
    expect(html).toContain('</html>');
  });

  it('does not throw when called with no arguments at all', () => {
    expect(() => buildReportHtml()).not.toThrow();
  });

  it('handles a section that has no lines', () => {
    const html = buildReportHtml({ sections: [{ heading: 'Greetings', lines: [] }] });
    expect(html).toContain('Greetings');
    expect(html).toContain('Nothing recorded yet.');
  });
});

// ---------------------------------------------------------------------------
// AC4 — print failure falls through to PDF + share sheet
// ---------------------------------------------------------------------------

describe('AC4 — printAsync rejection falls back to a shared PDF', () => {
  it('uses the OS print dialog when it works, and does not touch sharing', async () => {
    await printReport('<html></html>');
    expect(Print.printAsync).toHaveBeenCalledWith({ html: '<html></html>' });
    expect(Print.printToFileAsync).not.toHaveBeenCalled();
    expect(Sharing.shareAsync).not.toHaveBeenCalled();
  });

  it('falls back to printToFileAsync + shareAsync when printAsync rejects', async () => {
    Print.printAsync.mockRejectedValue(new Error('No print service'));
    await printReport('<html></html>');
    expect(Print.printToFileAsync).toHaveBeenCalledWith({ html: '<html></html>' });
    expect(Sharing.shareAsync).toHaveBeenCalledWith(
      'file:///tmp/report.pdf',
      { mimeType: 'application/pdf' },
    );
  });

  it('rethrows the original error when sharing is unavailable too', async () => {
    Print.printAsync.mockRejectedValue(new Error('No print service'));
    Sharing.isAvailableAsync.mockResolvedValue(false);
    await expect(printReport('<html></html>')).rejects.toThrow('No print service');
    expect(Sharing.shareAsync).not.toHaveBeenCalled();
  });
});

// The "older app build" degradation path is covered in
// reportPrint.nativeMissing.test.js — it needs a file with no expo-print mock
// of its own, because a file-level jest.mock is re-applied inside
// jest.isolateModules and would win over a doMock there.

// ---------------------------------------------------------------------------
// AC2 — printed lines are byte-identical to the on-screen wording
// ---------------------------------------------------------------------------

const L1_REPORT = {
  totals: {
    fast: 1, typical: 0, struggling: 1, disabled: 1,
    words_total: 3, words_predicted: 2, tier1: 1, tier2: 1, explained: 2,
  },
  words: [
    {
      word_id: 10, word: 'hello', category: 'greetings',
      trajectory: 'fast', tier: 'tier1', confidence: null, caveat: null,
      explanation: { label: 'fast', scored: true, terms: [], absentTerms: [], score: 0.81 },
    },
    {
      word_id: 11, word: 'please', category: 'magic_words',
      trajectory: 'struggling', tier: 'tier2', confidence: 0.73, caveat: null,
      explanation: { attributions: [] },
    },
    {
      word_id: 12, word: 'Clap', category: 'abilities',
      trajectory: 'typical', tier: 'disabled', confidence: null,
      caveat: 'Not enough recorded session data for this word yet.',
      explanation: null,
    },
  ],
};

describe('AC2 — Level 1 printout is a short summary in the screen\'s own labels', () => {
  const model = buildTrajectoryPrintModel(L1_REPORT, 'Pansilu');
  const html = buildReportHtml(model);

  it('lists each category\'s words under the status label its word cards show', () => {
    expect(model.sections.find((s) => s.heading === 'Greetings').lines[0])
      .toBe(`${WORD_STATUS.fast.label}: hello`);
    expect(model.sections.find((s) => s.heading === 'Magic words').lines[0])
      .toBe(`${WORD_STATUS.struggling.label}: please`);
  });

  it('keeps it short — no per-word sentences', () => {
    const all = model.sections.flatMap((s) => s.lines).join(' ');
    expect(all).not.toContain(PLAIN_SCORE_LEAD.fast);
    expect(all).not.toContain('The model’s prediction');
    expect(all).not.toContain('tier1');
    expect(all).not.toContain('tier2');
  });

  it('puts a word without a prediction under "No prediction", with the reason said once', () => {
    const lines = model.sections.find((s) => s.heading === 'Abilities').lines;
    expect(lines[0]).toBe(`${WORD_STATUS.none.label}: Clap`);
    expect(lines.join(' ')).not.toContain(WORD_STATUS.typical.label);
    expect(lines.filter((l) => l.startsWith('No prediction means'))).toHaveLength(1);
  });

  it('uses the screen\'s status labels in the overview too', () => {
    expect(model.overview.map((o) => o.label)).toEqual([
      WORD_STATUS.fast.label, WORD_STATUS.typical.label,
      WORD_STATUS.struggling.label, WORD_STATUS.none.label,
      'Words with a prediction',
    ]);
  });

  it('groups sections by category, skipping categories with no words', () => {
    expect(model.sections.map((s) => s.heading)).toEqual(['Greetings', 'Magic words', 'Abilities']);
  });

  it('carries the DEC-07 reliability caveat into the printout when Tier 2 is present', () => {
    // Asserted against the constant itself, so a reworded disclosure cannot
    // silently stop travelling with the printed page.
    expect(model.footnote).toContain(TIER2_RELIABILITY_CAVEAT);
    expect(html).toContain('still-learning model');
  });

  it('omits the DEC-07 caveat when no Tier 2 row is present', () => {
    const noTier2 = {
      ...L1_REPORT,
      totals: { ...L1_REPORT.totals, tier2: 0 },
      words: [L1_REPORT.words[0]],
    };
    const plain = buildTrajectoryPrintModel(noTier2, 'Pansilu');
    expect(plain.footnote).not.toContain(TIER2_RELIABILITY_CAVEAT);
    expect(plain.footnote).toContain('most recent recorded session');
  });

  it('excludes the per-word contribution bars (task §0)', () => {
    expect(html).not.toContain('counted for about');
  });

  it('includes the "Words by category" chart, self-contained', () => {
    expect(html).toContain('Words by category');
    expect(html).toContain('<svg');
    // Still offline-safe: no namespace URL, script or external resource.
    expect(html).not.toMatch(/https?:\/\//);
    expect(html).not.toMatch(/<script/i);
    // One bar per category with words, each segment named by its status.
    expect(html).toContain(`Greetings · ${WORD_STATUS.fast.label}: 1`);
    expect(html).toContain(`Abilities · ${WORD_STATUS.none.label}: 1`);
  });
});

const L2_REPORT = {
  totals: {
    topics_total: 3, topics_started: 1,
    mastered: 0, in_progress: 1, struggling: 0, not_started: 2,
  },
  topics: [
    {
      topic: 'self_introduction', status: 'in_progress', sessions_attempted: 2,
      last_session_date: '2026-08-18T09:12:00.000Z', last_pathway: 'verbal',
      elements_included: ['name', 'age'],
      elements_missing: ['hometown', 'gender', 'activity'],
      paragraph_score: 2, sentence_by_sentence_score: 3,
      sentences_needing_hints: 2, sentences_total: 5,
      used_picture_fallback: false, silence_timeout: false,
    },
    {
      topic: 'describe_friend', status: 'not_started', sessions_attempted: 0,
      last_session_date: null, last_pathway: null,
      elements_included: [], elements_missing: [],
      paragraph_score: null, sentence_by_sentence_score: null,
      sentences_needing_hints: 0, sentences_total: 0,
      used_picture_fallback: false, silence_timeout: false,
    },
    {
      topic: 'describe_pet', status: 'not_started', sessions_attempted: 0,
      last_session_date: null, last_pathway: null,
      elements_included: [], elements_missing: [],
      paragraph_score: null, sentence_by_sentence_score: null,
      sentences_needing_hints: 0, sentences_total: 0,
      used_picture_fallback: false, silence_timeout: false,
    },
  ],
};

describe('AC2 — Level 2 printed lines match the screen', () => {
  const model = buildLevel2PrintModel(L2_REPORT, 'Pansilu');

  it('prints the screen\'s own paragraph sentence, character for character', () => {
    const topic = L2_REPORT.topics[0];
    const lines = model.sections.find((s) => s.heading === 'Self-Introduction').lines;
    expect(lines).toContain(paragraphSentence(topic));
    expect(lines).toContain(attemptSentence(topic));
  });

  it('uses the child-facing topic names', () => {
    expect(model.sections.map((s) => s.heading))
      .toEqual(['Self-Introduction', 'Describing a Friend', 'Describing a Pet']);
  });

  it('renders a not-started topic unalarmingly and without invented detail', () => {
    const lines = model.sections.find((s) => s.heading === 'Describing a Friend').lines;
    expect(lines).toEqual(['Status: Not started', 'Not attempted yet.']);
  });

  it('reports the hint count for the session actually shown', () => {
    const lines = model.sections.find((s) => s.heading === 'Self-Introduction').lines;
    expect(lines).toContain('Needed a hint on 2 of 5 sentences.');
  });

  it('omits the picture-fallback line when it did not happen', () => {
    const all = model.sections.flatMap((s) => s.lines).join(' ');
    expect(all).not.toContain('picture-choice fallback');
  });

  it('never prints a raw enum value', () => {
    const all = JSON.stringify(model);
    for (const raw of ['in_progress', 'not_started', 'self_introduction', 'describe_friend', 'verbal']) {
      expect([raw, all.includes(raw)]).toEqual([raw, false]);
    }
  });
});
