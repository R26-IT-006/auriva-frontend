/**
 * Every word a teacher reads about a child's progress.
 *
 * The readers are special-education teachers, not engineers. Before this file the
 * report screens spoke the system's own vocabulary — "Tier 1", "distractor",
 * "mastery %", "sample size", and one section subtitle that read "Mixed-concept
 * rounds, scored on the server" — so a teacher had to translate before they could
 * use any of it.
 *
 * Rules the strings here follow, and that new copy must follow too:
 *
 *   1. No system vocabulary. A tier is a round, a distractor does not exist, a
 *      confusion is a mix-up. Nothing names the model, the graph, or the GAT.
 *   2. No percentage without the count beside it. "4 of 6" beats "67%": a teacher
 *      can act on the first and can only guess at what the second was out of.
 *   3. No precision a teacher cannot use. "About 4 seconds", never "3,847 ms".
 *   4. Name the child. "Ama takes longer", not "the student takes longer".
 *
 * Keep this the only place these words are written down. When they were inline,
 * "Identify" on one screen was "Finds the picture" on another and neither matched
 * what the child's own screen said.
 */

// ─── The three rounds ────────────────────────────────────────────────────────

// What the child actually does, in each round, described as an action rather than
// a level. Tier 3 is a video with no assessment, which is why it is "watched"
// and never "passed".
export const ROUND = {
  tier1: { short: 'Picture', label: 'Finds the picture', verb: 'found the picture' },
  tier2: { short: 'Word',    label: 'Knows the word',    verb: 'knew the word' },
  tier3: { short: 'Video',   label: 'Watched the video', verb: 'watched the video' },
};

export const ROUND_ORDER = ['tier1', 'tier2', 'tier3'];

/** For the concept rows, which key onto tier1_status / tier2_status / tier3_status. */
export const ROUND_BY_STATUS_KEY = {
  tier1_status: ROUND.tier1,
  tier2_status: ROUND.tier2,
  tier3_status: ROUND.tier3,
};

// ─── Section headings ────────────────────────────────────────────────────────

export const HEADING = {
  overview:    'How things are going',
  dayByDay:    'Day by day',
  categories:  'Groups',
  attention:   'Worth another look',
  mixUps:      'Mixed up',
  watchList:   'Worth keeping an eye on',
  responses:   'How long answers take',
  timeSpent:   'Time spent',
  games:       'Practice games',
  drawings:    'Drawings',
};

export const SUBHEADING = {
  // No "last 30 days · dashed line is the pass mark" — a teacher does not need to
  // be told what a dashed line is before they can read a chart.
  dayByDay:   'Pick a day to see what happened',
  attention:  'The ones giving the most trouble first',
  mixUps:     'Pairs that get muddled, and what might be behind it',
  watchList:  'Not a problem yet — just pairs children often muddle',
  responses:  'Quick answers can mean confident, or can mean guessing',
  // Not "games that mix several things together" — that describes the mixed
  // practice activity only, and this list also carries the memory game and the
  // photo-and-picture match, neither of which mixes anything.
  games:      'Played after a group of things is learned',
};

// ─── Status words ────────────────────────────────────────────────────────────

export const STATUS = {
  passed:      'Got it',
  failed:      'Not yet',
  in_progress: 'Partway',
  not_started: 'Not tried',
  locked:      'Not tried',
};

// ─── Numbers ─────────────────────────────────────────────────────────────────

/**
 * "4 of 6", never "67%".
 *
 * The report used formatPct everywhere, which is how a teacher ended up reading
 * "67%" with no way to know whether that was two tries or twenty.
 */
export function countOf(n, total) {
  if (typeof n !== 'number' || typeof total !== 'number' || total <= 0) return '—';
  return `${n} of ${total}`;
}

/**
 * Seconds, rounded to something a person would actually say out loud.
 *
 * Under ten seconds a half is still meaningful ("about 3.5 seconds"); above it,
 * the decimal is noise a teacher cannot act on.
 */
export function seconds(ms) {
  if (typeof ms !== 'number' || !Number.isFinite(ms) || ms <= 0) return '—';
  const s = ms / 1000;
  if (s < 10) return `about ${Math.round(s * 2) / 2} seconds`;
  if (s < 90) return `about ${Math.round(s)} seconds`;
  return `about ${Math.round(s / 60)} minutes`;
}

/** Longer spans — time spent on a screen, video watched. */
export function duration(ms) {
  if (typeof ms !== 'number' || !Number.isFinite(ms) || ms <= 0) return 'none yet';
  const mins = Math.round(ms / 60000);
  if (mins < 1) return 'under a minute';
  if (mins < 60) return `${mins} minute${mins === 1 ? '' : 's'}`;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return m === 0 ? `${h} hour${h === 1 ? '' : 's'}` : `${h}h ${m}m`;
}

/** "3 tries", "1 try" — never "n=3" or "sample size 3". */
export function tries(n) {
  if (typeof n !== 'number' || n <= 0) return 'not tried yet';
  return `${n} ${n === 1 ? 'try' : 'tries'}`;
}

/** First name only. The reports are about one child and they know them by name. */
export function firstNameOf(fullName) {
  return (fullName || '').trim().split(/\s+/)[0] || 'This child';
}

// ─── Sentences ───────────────────────────────────────────────────────────────

/**
 * The one-line summary at the top of the report. Three plain facts, no jargon,
 * readable in about five seconds — which is the whole design target for the
 * glance layer.
 */
export function overviewSentence({ name, learned, catalogue, mixUps, days }) {
  const parts = [];
  parts.push(learned > 0
    ? `${name} has learned ${learned} of ${catalogue} things so far`
    : `${name} is just getting started`);
  if (days > 0) parts.push(`across ${days} ${days === 1 ? 'day' : 'days'}`);
  const tail = mixUps > 0
    ? ` There ${mixUps === 1 ? 'is 1 pair' : `are ${mixUps} pairs`} that still get muddled.`
    : ' Nothing is getting muddled at the moment.';
  return `${parts.join(' ')}.${tail}`;
}

/**
 * Which round(s) a pair gets mixed up in, said plainly.
 *
 * This is the payoff from making both rounds draw distractors from the same pool:
 * before that change a pair could only ever be seen in one round, so this
 * three-way distinction did not exist to be reported.
 */
export function mixUpWhere(tiers = []) {
  const pic = tiers.includes(1);
  const word = tiers.includes(2);
  if (pic && word) return 'Muddled both when looking at pictures and when choosing the word';
  if (word)        return 'Muddled when choosing the word';
  return 'Muddled when looking at pictures';
}

/**
 * The fallback explanation, used when the model is unavailable so the card is
 * never left bare. Deliberately hedged — "look alike" is a statement about the
 * pictures, which is something we measured, not about the child.
 */
export function mixUpReason({ tiers = [], visual, phonetic }) {
  const pic = tiers.includes(1);
  const word = tiers.includes(2);
  if (pic && word) {
    return 'This pair gets muddled whichever way it is asked, so it may be the two things themselves that have not come apart yet.';
  }
  if (word && typeof phonetic === 'number' && phonetic >= 0.2) {
    return 'The two names sound similar, which may be what is catching them out.';
  }
  if (word) {
    return 'The pictures are told apart fine — it is the name that has not stuck to this one yet.';
  }
  if (typeof visual === 'number' && visual >= 0.9) {
    return 'These two pictures look very alike.';
  }
  return 'These two get picked for one another when the pictures are shown.';
}

// ─── Practice games ──────────────────────────────────────────────────────────

/**
 * Difficulty as a feeling rather than a number. "Level 4 of 5" invites a teacher
 * to think the number is a target to push; it is not, it is the system tracking
 * what the child can currently handle.
 */
export function difficultyWord(level) {
  if (typeof level !== 'number') return '';
  if (level <= 1) return 'Gentle';
  if (level === 2) return 'Getting going';
  if (level === 3) return 'About right';
  if (level === 4) return 'Stretching';
  return 'Hardest';
}

export const GAME_NAME = {
  practice:   'Mixed practice',
  pair_match: 'Photo and picture match',
  memory:     'Memory game',
};
