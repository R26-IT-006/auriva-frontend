import {
  ROUND, countOf, duration, tries, mixUpWhere, mixUpReason, GAME_NAME, difficultyWord,
} from '../constants/teacherWording';
import { getConceptItem } from '../data/conceptData';

/**
 * A saved report as printable HTML.
 *
 * A pure string function — no components, no renderer, no React Native imports.
 * The same output goes to expo-print whether it is called from a screen or a
 * test, so the printed layout can be checked without printing anything.
 *
 * Every sentence about the child comes from `constants/teacherWording` (or the
 * frozen model summary) rather than being written again here. A printed report
 * that phrases things differently from the screen it was made from is worse than
 * no printout — a teacher reading both would have to work out whether the two
 * disagree about the child or only about the wording.
 *
 * Laid out for the teacher who prints it:
 *   - a branded header with the overall picture beside the child's name,
 *   - "Next steps" first, as a short tick-box list they can act on,
 *   - colour-coded sections (the same colours as the report screen's headings),
 *   - the model's notes made readable (milliseconds become seconds, ISO dates
 *     become "28 Aug"),
 *   - ruled lines at the end for their own notes.
 *
 * Two deliberate departures from the screen:
 *
 *  1. Day by day runs OLDEST FIRST. On screen the newest day is what a teacher
 *     wants; on paper a record reads forward in time, the way a diary does.
 *  2. Nothing is collapsible, so everything is printed. A folded section on paper
 *     is just missing.
 */

// ── Palette ──────────────────────────────────────────────────────────────────
// The app's brand green, and the per-section accents the report screen's headings
// use. Each accent is dark enough to survive a monochrome printer as a grey; the
// pale fills are decoration only, never the sole carrier of meaning.
const INK = '#1B1F24';
const MUTED = '#5B6672';
const LINE = '#DDE3E8';
const BRAND = '#2A7B51';
const BRAND_TEAL = '#31777E';
const BRAND_TINT = '#E4F4EC';
const TIER_INK = ['#BFE3CE', '#57B183', '#1B6E45'];

const ACCENT = {
  next:     { fg: '#2A7B51', bg: '#E4F4EC' },   // green
  groups:   { fg: '#C2573F', bg: '#FBE7E2' },   // coral
  insights: { fg: '#3B82C4', bg: '#E6F1FC' },   // blue
  muddled:  { fg: '#B86E12', bg: '#FDF1DC' },   // amber
  pace:     { fg: '#3B82C4', bg: '#E6F1FC' },   // blue
  days:     { fg: '#6C5CE0', bg: '#EFEBFA' },   // purple
  games:    { fg: '#2F8A96', bg: '#DFF3F4' },   // teal
  notes:    { fg: '#5B6672', bg: '#F1F4F7' },   // grey
};

/** Escapes anything that could otherwise close a tag or open one. */
function esc(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * apple_pie → Apple Pie. Restated rather than imported from ConfusionList,
 * which is a component module: pulling it in would drag react-native into a file
 * whose whole value is that it renders nothing.
 */
function fallbackLabel(key) {
  if (!key) return '';
  return String(key).replace(/[_-]/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

function conceptLabel(categoryKey, conceptKey) {
  const item = getConceptItem(categoryKey, conceptKey);
  return item?.label ?? fallbackLabel(conceptKey);
}

function parseDate(iso) {
  const [y, m, d] = String(iso || '').split('-').map(Number);
  if (!y || !m || !d) return null;
  return new Date(y, m - 1, d);
}

/** "Tuesday 25 August" — built from parts so a bare date is never read as UTC. */
function longDate(iso) {
  const date = parseDate(iso);
  if (!date) return iso || '';
  return date.toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long' });
}

/** Parts for the day badge: "MON", "24", "AUG". */
function badgeDate(iso) {
  const date = parseDate(iso);
  if (!date) return { dow: '', day: iso || '', mon: '' };
  return {
    dow: date.toLocaleDateString(undefined, { weekday: 'short' }).toUpperCase(),
    day: String(date.getDate()),
    mon: date.toLocaleDateString(undefined, { month: 'short' }).toUpperCase(),
  };
}

function pct(value) {
  return typeof value === 'number' ? `${Math.round(value * 100)}%` : '—';
}

/** seconds() without its "about" prefix reading oddly mid-sentence. */
function secondsish(ms) {
  if (typeof ms !== 'number' || !Number.isFinite(ms) || ms <= 0) return '—';
  const s = ms / 1000;
  if (s < 10) return `about ${Math.round(s * 2) / 2} seconds`;
  return `about ${Math.round(s)} seconds`;
}

/** "4.5 s" — the short form for a figure tile. */
function shortSeconds(ms) {
  if (typeof ms !== 'number' || !Number.isFinite(ms) || ms <= 0) return '—';
  const s = ms / 1000;
  return s < 10 ? `${Math.round(s * 10) / 10} s` : `${Math.round(s)} s`;
}

/**
 * The model's sentences, made readable for a teacher: "4337 ms" becomes
 * "about 4.5 seconds" and "2026-08-28" becomes "28 Aug". The figures are the
 * same; only the units a person reads change.
 */
function readable(text) {
  return String(text ?? '')
    .replace(/(\d+(?:\.\d+)?)\s?ms\b/g, (_, n) => secondsish(Number(n)))
    .replace(/\b(\d{4})-(\d{2})-(\d{2})\b/g, (iso) => {
      const date = parseDate(iso);
      return date ? date.toLocaleDateString(undefined, { day: 'numeric', month: 'short' }) : iso;
    });
}

/** A three-band progress bar, the same nesting the screen draws. */
function bar(total, t1, t2, t3) {
  if (!total) return '';
  const w = (n) => `${Math.min(100, ((n || 0) / total) * 100)}%`;
  return `<span class="bar">
    <span class="seg" style="width:${w(t1)};background:${TIER_INK[0]}"></span>
    <span class="seg" style="width:${w(t2)};background:${TIER_INK[1]}"></span>
    <span class="seg" style="width:${w(t3)};background:${TIER_INK[2]}"></span>
  </span>`;
}

/** A section with a coloured marker beside its heading. */
function section(key, title, body, sub) {
  if (!body) return '';
  const a = ACCENT[key] || ACCENT.notes;
  return `<section class="sec">
    <div class="sechead">
      <span class="dot" style="background:${a.fg}"></span>
      <h2>${esc(title)}</h2>
      ${sub ? `<span class="secsub">${esc(sub)}</span>` : ''}
    </div>
    ${body}
  </section>`;
}

/**
 * @param {object}  report   the saved row: period labels, payload, narrative
 * @param {object}  student  { full_name }
 * @param {object}  opts     { includeArtwork } — drawings are remote images, so a
 *                           printer with no network prints empty boxes
 */
export function buildReportHtml(report = {}, student = {}, opts = {}) {
  const { includeArtwork = true } = opts;
  const p = report.payload || {};
  const totals = p.totals || {};
  const name = esc(student.full_name || 'This child');
  const firstName = esc(String(student.full_name || 'This child').trim().split(/\s+/)[0]);

  // The model's summary, frozen into this report when it was generated.
  // generateCached wraps the model output under a `summary` key, so the fields
  // sit one level deeper than the property name suggests.
  const ai = report.narrative?.summary || {};

  // ── Header ─────────────────────────────────────────────────────────────────
  const learnedAll = totals.mastered ?? 0;
  const catalogue = totals.catalogue_concepts ?? 0;
  const overallPct = catalogue ? Math.round((learnedAll / catalogue) * 100) : 0;

  const header = `<header class="hero">
    <div class="herotext">
      <p class="brand">AURIVA &middot; CONCEPT LEARNING REPORT</p>
      <h1>${name}</h1>
      <p class="period">${esc(report.label || '')}${
        report.range_label ? ` &middot; ${esc(report.range_label)}` : ''}</p>
      ${report.generated_at ? `<p class="made">Prepared ${esc(longDate(String(report.generated_at).slice(0, 10)))}</p>` : ''}
    </div>
    <div class="overall">
      <p class="overallnum">${esc(String(learnedAll))}<span> / ${esc(String(catalogue))}</span></p>
      <p class="overalllabel">things learned overall</p>
      <span class="overallbar"><span style="width:${overallPct}%"></span></span>
      <p class="overallpct">${overallPct}% of everything taught</p>
    </div>
  </header>`;

  // ── At a glance ────────────────────────────────────────────────────────────
  const h = report.headline || {};
  const facts = [
    ['Learned this period', h.learned_in_period ?? '—', ACCENT.next],
    ['Days worked', h.session_days ?? 0, ACCENT.days],
    ['Time on task', duration(h.time_spent_ms), ACCENT.games],
    ['Answers right', pct(h.accuracy), ACCENT.insights],
  ].map(([k, v, a]) => `<div class="fact" style="border-top-color:${a.fg}">
      <dt>${esc(k)}</dt><dd style="color:${a.fg}">${esc(v)}</dd></div>`).join('');

  const lede = ai.headline ? `<p class="lede">${esc(readable(ai.headline))}</p>` : '';

  // ── Pace, read the way the screen reads it ─────────────────────────────────
  const rt = p.response_times || {};
  const eng = p.engagement || {};
  const timed = rt.sample_size >= 10 && rt.incorrect_avg_ms != null && rt.correct_avg_ms != null;
  const guessing = timed && rt.incorrect_avg_ms < rt.correct_avg_ms * 0.8;
  const labouring = timed && rt.incorrect_avg_ms > rt.correct_avg_ms * 1.6;
  const paceNote = guessing
    ? `${firstName} answers faster when wrong than when right. That often means guessing rather than not knowing — slowing the pace may help more than going over the same material again.`
    : labouring
      ? `${firstName} takes about ${Math.round(rt.incorrect_avg_ms / rt.correct_avg_ms)} times longer on the ones they get wrong — usually a good sign, meaning they are working the answer out rather than guessing.`
      : '';

  // ── Next steps for the teacher ─────────────────────────────────────────────
  // The model's own suggestions when there are any; otherwise steps built from the
  // same measured mix-ups the report lists. Plus the group closest to finished, and
  // the pace reading when there is one. Tick boxes, because this is the part of the
  // page a teacher works from.
  const steps = [];
  for (const s of ai.suggested_focus || []) steps.push(readable(s));
  if (!steps.length) {
    for (const m of (p.mix_ups || []).slice(0, 3)) {
      const a = conceptLabel(m.category_key, m.concept_a);
      const b = conceptLabel(m.category_key, m.concept_b);
      const words = (m.tiers || []).includes(2);
      steps.push(words
        ? `${a} and ${b}: practise matching each picture to its written name, one pair at a time.`
        : `${a} and ${b}: look at the two pictures side by side and talk about what makes them different.`);
    }
  }
  const nearly = (p.categories || [])
    .filter((c) => c.started > 0 && c.total && c.mastered < c.total)
    .sort((a, b) => (b.mastered / b.total) - (a.mastered / a.total))[0];
  if (nearly) {
    steps.push(`${nearly.label} is the group furthest along (${countOf(nearly.mastered, nearly.total)}) — a good one to keep going with.`);
  }
  if (guessing) steps.push('Give more time on each question; the pace suggests guessing.');

  const nextSteps = steps.length
    ? `<ul class="steps">${steps.map((s) => `<li><span class="box"></span><span>${esc(s)}</span></li>`).join('')}</ul>`
    : '';

  // ── Groups ─────────────────────────────────────────────────────────────────
  const groups = (p.categories || [])
    .filter((c) => c.started > 0)
    .sort((a, b) => (b.mastered / (b.total || 1)) - (a.mastered / (a.total || 1)))
    .map((c) => `<tr>
        <td class="name">${esc(c.label)}</td>
        <td class="num">${esc(countOf(c.mastered, c.total))}</td>
        <td class="pctcell">${c.total ? Math.round((c.mastered / c.total) * 100) : 0}%</td>
        <td class="barcell">${bar(c.total, c.tier1_passed, c.tier2_passed, c.tier3_passed)}</td>
      </tr>`)
    .join('');

  const groupsTable = groups
    ? `<table class="groups"><tbody>${groups}</tbody></table>
       <p class="legend">
         <span class="key" style="background:${TIER_INK[0]}"></span>${esc(ROUND.tier1.label)}
         <span class="key" style="background:${TIER_INK[1]}"></span>${esc(ROUND.tier2.label)}
         <span class="key" style="background:${TIER_INK[2]}"></span>${esc(ROUND.tier3.label)}
       </p>`
    : '';

  // ── What this looks like ───────────────────────────────────────────────────
  const card = (title, items, a, mark) => (items || []).length
    ? `<div class="icard" style="border-left-color:${a.fg};background:${a.bg}">
        <h4 style="color:${a.fg}"><span class="mark" style="background:${a.fg}">${mark}</span>${esc(title)}</h4>
        <ul>${items.map((x) => `<li>${esc(readable(x))}</li>`).join('')}</ul>
      </div>`
    : '';

  const insights = [
    card('Going well', ai.strengths, { fg: '#2A7B51', bg: '#F1F9F4' }, '&#10003;'),
    card('Worth watching', ai.watch_areas, { fg: '#B86E12', bg: '#FFF8EC' }, '!'),
    card('Might be worth revisiting', ai.suggested_focus, { fg: '#3B82C4', bg: '#F2F7FD' }, '&#8635;'),
    ai.caveat ? `<p class="caveat">${esc(readable(ai.caveat))}</p>` : '',
  ].join('');

  // ── Mix-ups ────────────────────────────────────────────────────────────────
  // The model's per-pair note when there is one, the measured fallback when not,
  // exactly as the cards on screen decide it.
  // mix_up_notes is an ARRAY of { pair, note }, keyed back to a map here exactly
  // as the report screen does it. Matching by position instead would put the
  // wrong explanation on a pair the moment the model omits one — and a wrong
  // reason on a mix-up card is worse than no reason at all.
  const notes = {};
  for (const item of ai.mix_up_notes || []) {
    if (item?.pair && item?.note) notes[item.pair] = item.note;
  }
  const mixUps = (p.mix_ups || []).map((m, i) => {
    const key = `${m.concept_a}|${m.concept_b}`;
    const why = notes[key] || mixUpReason({
      tiers: m.tiers, visual: m.visual_similarity, phonetic: m.phonetic_similarity,
    });
    return `<div class="mix">
      <p class="pair"><span class="rank">${i + 1}</span>${esc(conceptLabel(m.category_key, m.concept_a))}
         <span class="swap">&#8644;</span>
         ${esc(conceptLabel(m.category_key, m.concept_b))}</p>
      <p class="why">${esc(readable(why))}</p>
      <span class="where">${esc(mixUpWhere(m.tiers))}</span>
    </div>`;
  }).join('');

  const mixUpsBlock = mixUps
    ? `<div class="mixgrid">${mixUps}</div>`
    : '<p class="none">Nothing was getting muddled in this period.</p>';

  // ── Day by day, oldest first ───────────────────────────────────────────────
  const days = [...(p.days || [])].sort((a, b) => (a.date < b.date ? -1 : 1)).map((day) => {
    const b = badgeDate(day.date);
    const cats = (day.categories || []).map((cat) => {
      const chips = (cat.concepts || []).map((c) => {
        const mark = c.passed ? ' &#10003;' : c.struggled ? ' &middot;' : '';
        return `<span class="chip${c.passed ? ' done' : c.struggled ? ' tricky' : ''}">${
          esc(conceptLabel(cat.category_key, c.concept_key))}${mark}</span>`;
      }).join('');
      return `<div class="catrow"><span class="cat">${esc(cat.label)}</span><span class="chips">${chips}</span></div>`;
    }).join('');

    const art = includeArtwork && (day.artworks || []).length
      ? `<div class="art">${(day.artworks || [])
          .map((a) => `<img src="${esc(a.image_url)}" alt="Drawing of ${
            esc(conceptLabel(a.category_key, a.concept_key))}" />`).join('')}</div>`
      : '';

    return `<div class="day">
      <div class="badge"><span class="dow">${esc(b.dow)}</span><span class="dnum">${esc(b.day)}</span><span class="mon">${esc(b.mon)}</span></div>
      <div class="daybody">
        <div class="dayhead"><h3>${esc(longDate(day.date))}</h3>
          ${day.time_spent_ms ? `<span class="timepill">${esc(duration(day.time_spent_ms))}</span>` : ''}</div>
        ${cats}${art}
      </div>
    </div>`;
  }).join('');

  // ── How they work ──────────────────────────────────────────────────────────
  const paceTiles = [
    rt.sample_size ? ['Usual answer time', shortSeconds(rt.overall_avg_ms), tries(rt.sample_size)] : null,
    rt.correct_avg_ms ? ['When right', shortSeconds(rt.correct_avg_ms), 'average'] : null,
    rt.incorrect_avg_ms ? ['When wrong', shortSeconds(rt.incorrect_avg_ms), 'average'] : null,
    eng.video_ms ? ['Video watched', duration(eng.video_ms), 'in total'] : null,
    eng.coloring_sessions ? ['Colouring in', String(eng.coloring_sessions), eng.coloring_sessions === 1 ? 'time' : 'times'] : null,
  ].filter(Boolean).map(([k, v, s]) => `<div class="ptile"><dt>${esc(k)}</dt><dd>${esc(v)}</dd><span>${esc(s)}</span></div>`).join('');

  const pace = paceTiles
    ? `<div class="ptiles">${paceTiles}</div>${paceNote
        ? `<p class="callout${guessing ? ' warn' : ''}">${esc(paceNote)}</p>` : ''}`
    : '';

  // ── Practice games ─────────────────────────────────────────────────────────
  // A game counts as played once it has an outcome, pass or fail — the same rule
  // the report screen uses. There is no 'completed' status in the data; testing
  // for one labelled every finished game "not finished".
  const acts = p.activities || [];
  const finished = acts.filter((a) => a.status === 'passed' || a.status === 'failed');
  const right = finished.reduce((n, a) => n + (a.correct_count || 0), 0);
  const rounds = finished.reduce((n, a) => n + (a.total_rounds || 0), 0);

  const games = acts.map((a) => {
    const done = a.status === 'passed' || a.status === 'failed';
    const w = a.total_rounds ? Math.round(((a.correct_count || 0) / a.total_rounds) * 100) : 0;
    return `<tr>
      <td class="gname">${esc(GAME_NAME[a.activity_type] || 'Practice')}</td>
      <td>${esc(difficultyWord(a.difficulty_level) || '—')}</td>
      <td class="num">${esc(done && a.total_rounds ? countOf(a.correct_count, a.total_rounds) : '—')}</td>
      <td class="gbar">${done && a.total_rounds ? `<span class="minibar"><span style="width:${w}%"></span></span>` : ''}</td>
      <td><span class="status${done ? '' : ' open'}">${esc(done ? 'Played' : 'Not finished')}</span></td>
    </tr>`;
  }).join('');

  const gamesTable = games
    ? `<p class="gsum">${finished.length} of ${acts.length} games finished${
        rounds ? ` &middot; ${right} of ${rounds} rounds right (${Math.round((right / rounds) * 100)}%)` : ''}</p>
       <table class="games">
         <thead><tr><th>Game</th><th>Level</th><th>Right</th><th></th><th></th></tr></thead>
         <tbody>${games}</tbody>
       </table>`
    : '';

  // ── Teacher's notes ────────────────────────────────────────────────────────
  const notesBlock = `<div class="lines">${'<div class="line"></div>'.repeat(5)}</div>`;

  return `<title>${name} — ${esc(report.label || 'Learning report')}</title>
<style>
  /* Print sizing, not screen sizing: pt, and a margin the printer will honour. */
  @page { margin: 13mm; }
  * { box-sizing: border-box; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  body { font-family: -apple-system, "Segoe UI", Roboto, sans-serif;
         color: ${INK}; font-size: 10pt; line-height: 1.45; margin: 0; }

  /* Header */
  .hero { display: flex; align-items: stretch; gap: 14pt; margin-bottom: 12pt;
          border-radius: 10pt; overflow: hidden;
          background: linear-gradient(120deg, ${BRAND_TEAL}, ${BRAND}); color: #FFFFFF; }
  .herotext { flex: 1; padding: 14pt 16pt; }
  .brand { font-size: 7.5pt; letter-spacing: 1.2pt; opacity: 0.85; margin: 0 0 4pt; font-weight: 700; }
  h1 { font-size: 21pt; margin: 0 0 2pt; letter-spacing: -0.4pt; }
  .period { font-size: 10.5pt; margin: 0; opacity: 0.95; }
  .made { font-size: 8pt; margin: 4pt 0 0; opacity: 0.8; }
  .overall { width: 150pt; padding: 14pt 16pt; background: rgba(255,255,255,0.14); }
  .overallnum { font-size: 22pt; font-weight: 700; margin: 0; line-height: 1.1; }
  .overallnum span { font-size: 12pt; font-weight: 400; opacity: 0.85; }
  .overalllabel { font-size: 8.5pt; margin: 2pt 0 6pt; opacity: 0.9; }
  .overallbar { display: block; height: 6pt; border-radius: 3pt; background: rgba(255,255,255,0.3); overflow: hidden; }
  .overallbar span { display: block; height: 100%; background: #FFFFFF; border-radius: 3pt; }
  .overallpct { font-size: 8pt; margin: 4pt 0 0; opacity: 0.85; }

  .lede { font-size: 11pt; margin: 0 0 10pt; padding: 8pt 12pt; border-radius: 8pt;
          background: ${BRAND_TINT}; border-left: 3pt solid ${BRAND}; }

  .facts { display: flex; gap: 8pt; margin: 0 0 14pt; }
  .fact { flex: 1; border: 1pt solid ${LINE}; border-top: 3pt solid ${BRAND};
          border-radius: 8pt; padding: 7pt 9pt; }
  .fact dt { font-size: 7.5pt; color: ${MUTED}; text-transform: uppercase; letter-spacing: 0.4pt; }
  .fact dd { font-size: 16pt; font-weight: 700; margin: 2pt 0 0; }

  /* Sections must not be split across a page break mid-heading. */
  .sec { margin-bottom: 14pt; break-inside: avoid-page; }
  .sechead { display: flex; align-items: center; gap: 7pt; margin: 0 0 7pt;
             padding-bottom: 4pt; border-bottom: 1pt solid ${LINE}; }
  .dot { width: 9pt; height: 9pt; border-radius: 5pt; flex: none; }
  h2 { font-size: 12.5pt; margin: 0; }
  .secsub { margin-left: auto; font-size: 8pt; color: ${MUTED}; }
  h3 { font-size: 10.5pt; margin: 0; }

  /* Next steps */
  .steps { list-style: none; padding: 9pt 11pt; margin: 0; border-radius: 8pt;
           background: ${ACCENT.next.bg}; }
  .steps li { display: flex; gap: 8pt; align-items: flex-start; margin: 3pt 0; }
  .box { flex: none; width: 10pt; height: 10pt; margin-top: 2pt; border: 1.2pt solid ${BRAND};
         border-radius: 2pt; background: #FFFFFF; }

  /* Groups */
  table { width: 100%; border-collapse: collapse; }
  th { text-align: left; font-size: 7.5pt; color: ${MUTED}; text-transform: uppercase;
       letter-spacing: 0.4pt; padding: 0 6pt 3pt 0; }
  td { padding: 4pt 6pt 4pt 0; vertical-align: middle; border-top: 1pt solid ${LINE}; }
  .groups .name { width: 30%; font-weight: 700; }
  .groups .num { width: 13%; color: ${MUTED}; white-space: nowrap; }
  .pctcell { width: 9%; font-weight: 700; color: ${BRAND}; }
  .num { white-space: nowrap; }
  .barcell { width: 48%; }
  .bar { position: relative; display: block; height: 7pt; border-radius: 4pt;
         background: #EFF2F4; overflow: hidden; }
  .seg { position: absolute; left: 0; top: 0; bottom: 0; border-radius: 4pt; }
  .legend { font-size: 8pt; color: ${MUTED}; margin: 5pt 0 0; }
  .key { display: inline-block; width: 7pt; height: 7pt; border-radius: 4pt;
         margin: 0 3pt 0 10pt; vertical-align: middle; }
  .legend .key:first-child { margin-left: 0; }

  /* What this looks like */
  .icard { border-left: 3pt solid; border-radius: 6pt; padding: 7pt 10pt; margin-bottom: 7pt;
           break-inside: avoid-page; }
  .icard h4 { display: flex; align-items: center; gap: 6pt; font-size: 9pt; margin: 0 0 3pt;
              text-transform: uppercase; letter-spacing: 0.4pt; }
  .mark { display: inline-flex; align-items: center; justify-content: center; width: 13pt; height: 13pt;
          border-radius: 7pt; color: #FFFFFF; font-size: 8pt; font-weight: 700; }
  .icard ul { margin: 0; padding-left: 14pt; }
  .caveat { font-size: 8.5pt; color: ${MUTED}; font-style: italic; margin: 4pt 0 0; }

  /* Mix-ups: two to a row */
  .mixgrid { display: flex; flex-wrap: wrap; gap: 7pt; }
  .mix { flex: 1 1 46%; border: 1pt solid ${LINE}; border-radius: 8pt; padding: 7pt 9pt;
         break-inside: avoid-page; }
  .pair { font-weight: 700; margin: 0; display: flex; align-items: center; gap: 4pt; }
  .rank { display: inline-flex; align-items: center; justify-content: center; width: 13pt; height: 13pt;
          border-radius: 7pt; background: ${ACCENT.muddled.fg}; color: #FFFFFF; font-size: 7.5pt; margin-right: 3pt; }
  .swap { color: ${ACCENT.muddled.fg}; padding: 0 2pt; }
  .why { margin: 3pt 0 4pt; }
  .where { display: inline-block; font-size: 7.5pt; color: ${ACCENT.muddled.fg};
           background: ${ACCENT.muddled.bg}; border-radius: 8pt; padding: 1pt 7pt; }
  .none { color: ${MUTED}; margin: 0; }

  /* How they work */
  .ptiles { display: flex; gap: 7pt; }
  .ptile { flex: 1; border: 1pt solid ${LINE}; border-radius: 8pt; padding: 6pt 8pt; }
  .ptile dt { font-size: 7.5pt; color: ${MUTED}; text-transform: uppercase; letter-spacing: 0.3pt; }
  .ptile dd { font-size: 14pt; font-weight: 700; margin: 1pt 0 0; color: ${ACCENT.pace.fg}; }
  .ptile span { font-size: 7.5pt; color: ${MUTED}; }
  .callout { margin: 8pt 0 0; padding: 7pt 10pt; border-radius: 8pt; font-size: 9.5pt;
             background: ${BRAND_TINT}; border-left: 3pt solid ${BRAND}; }
  .callout.warn { background: #FFF8EC; border-left-color: #B86E12; }

  /* Day by day */
  .day { display: flex; gap: 10pt; padding: 7pt 0; border-top: 1pt solid ${LINE}; break-inside: avoid-page; }
  .day:first-child { border-top: 0; padding-top: 0; }
  .badge { flex: none; width: 38pt; text-align: center; border-radius: 7pt; padding: 4pt 0;
           background: ${ACCENT.days.bg}; color: ${ACCENT.days.fg}; }
  .badge span { display: block; line-height: 1.15; }
  .dow, .mon { font-size: 6.5pt; font-weight: 700; letter-spacing: 0.5pt; }
  .dnum { font-size: 14pt; font-weight: 700; }
  .daybody { flex: 1; }
  .dayhead { display: flex; align-items: center; justify-content: space-between; margin-bottom: 3pt; }
  .timepill { font-size: 7.5pt; color: ${ACCENT.days.fg}; background: ${ACCENT.days.bg};
              border-radius: 8pt; padding: 1pt 7pt; }
  .catrow { display: flex; gap: 6pt; align-items: baseline; margin: 2pt 0; }
  .cat { flex: none; width: 90pt; font-size: 7pt; color: ${MUTED}; text-transform: uppercase; letter-spacing: 0.5pt; }
  .chips { flex: 1; }
  .chip { display: inline-block; border: 1pt solid ${LINE}; border-radius: 8pt;
          padding: 1pt 6pt; margin: 0 3pt 3pt 0; font-size: 8.5pt; }
  .chip.done { border-color: ${TIER_INK[1]}; background: #F1F9F4; }
  .chip.tricky { border-color: #E0B75E; background: #FDF6E7; }
  .art img { height: 70pt; border: 1pt solid ${LINE}; border-radius: 6pt; margin: 4pt 4pt 0 0; }

  /* Practice games */
  .gsum { margin: 0 0 5pt; font-size: 9pt; color: ${MUTED}; }
  .gname { font-weight: 700; }
  .gbar { width: 22%; }
  .minibar { display: block; height: 6pt; border-radius: 3pt; background: #EFF2F4; overflow: hidden; }
  .minibar span { display: block; height: 100%; background: ${ACCENT.games.fg}; border-radius: 3pt; }
  .status { font-size: 7.5pt; border-radius: 8pt; padding: 1pt 7pt;
            color: ${BRAND}; background: ${BRAND_TINT}; white-space: nowrap; }
  .status.open { color: #B86E12; background: #FDF1DC; }

  /* Teacher's notes */
  .lines { padding-top: 4pt; }
  .line { height: 20pt; border-bottom: 1pt solid ${LINE}; }

  footer { margin-top: 14pt; padding-top: 6pt; border-top: 1pt solid ${LINE};
           font-size: 8pt; color: ${MUTED}; display: flex; justify-content: space-between; gap: 10pt; }
</style>

${header}
${lede}
<div class="facts">${facts}</div>

${section('next', 'Next steps', nextSteps, 'tick off as you go')}
${section('groups', 'Where they are up to', groupsTable)}
${section('insights', 'What this looks like', insights)}
${section('muddled', 'Things that get muddled', mixUpsBlock, mixUps ? 'most worth your time first' : '')}
${section('pace', 'How they work', pace)}
${section('days', 'Day by day', days)}
${section('games', 'Practice games', gamesTable)}
${section('notes', "Teacher's notes", notesBlock)}

<footer>
  <span>${name} has learned ${esc(String(learnedAll))} of ${esc(String(catalogue))} things in total.
  This report covers ${esc(report.range_label || 'the period shown')} and does not change.</span>
  <span>Auriva</span>
</footer>`;
}
