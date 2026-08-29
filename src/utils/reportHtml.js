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
 * Every sentence comes from `constants/teacherWording` rather than being written
 * again here. A printed report that phrases things differently from the screen it
 * was made from is worse than no printout — a teacher reading both would have to
 * work out whether the two disagree about the child or only about the wording.
 *
 * Two deliberate departures from the screen:
 *
 *  1. Day by day runs OLDEST FIRST. On screen the newest day is what a teacher
 *     wants; on paper a record reads forward in time, the way a diary does.
 *  2. Nothing is collapsible, so everything is printed. A folded section on paper
 *     is just missing.
 */

// Print colours, not screen colours. The pastel fills of the app go to nothing on
// a monochrome classroom printer, so the palette is chosen for contrast in grey.
const INK = '#1B1F24';
const MUTED = '#5B6672';
const LINE = '#D7DDE3';
const TIER_INK = ['#BFE3CE', '#57B183', '#1B6E45'];

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

/** "Tuesday 25 August" — built from parts so a bare date is never read as UTC. */
function longDate(iso) {
  const [y, m, d] = String(iso || '').split('-').map(Number);
  if (!y || !m || !d) return iso || '';
  return new Date(y, m - 1, d).toLocaleDateString(undefined, {
    weekday: 'long', day: 'numeric', month: 'long',
  });
}

function pct(value) {
  return typeof value === 'number' ? `${Math.round(value * 100)}%` : '—';
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

function section(title, body) {
  if (!body) return '';
  return `<section><h2>${esc(title)}</h2>${body}</section>`;
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

  // ── Overview ───────────────────────────────────────────────────────────────
  const h = report.headline || {};
  const facts = [
    ['Things learned this period', h.learned_in_period ?? '—'],
    ['Days worked', h.session_days ?? 0],
    ['Time on task', duration(h.time_spent_ms)],
    ['Answers right', pct(h.accuracy)],
  ].map(([k, v]) => `<div class="fact"><dt>${esc(k)}</dt><dd>${esc(v)}</dd></div>`).join('');

  // The model's paragraph, frozen into this report when it was generated.
  // generateCached wraps the model output under a `summary` key, so the fields
  // sit one level deeper than the property name suggests.
  const ai = report.narrative?.summary || {};
  const narrative = ai.headline ? `<p class="lede">${esc(ai.headline)}</p>` : '';

  const bullets = (title, items) => (items || []).length
    ? `<div class="aiblock"><h4>${esc(title)}</h4><ul class="plain">${
        items.map((x) => `<li>${esc(x)}</li>`).join('')}</ul></div>`
    : '';

  // Printed in full. On screen these live behind an "insights" tap; on paper
  // there is nothing to tap, and a folded section is simply missing.
  const insights = [
    bullets('Going well', ai.strengths),
    bullets('Worth watching', ai.watch_areas),
    bullets('Might be worth revisiting', ai.suggested_focus),
    ai.caveat ? `<p class="caveat">${esc(ai.caveat)}</p>` : '',
  ].join('');

  // ── Groups ─────────────────────────────────────────────────────────────────
  const groups = (p.categories || [])
    .filter((c) => c.started > 0)
    .sort((a, b) => (b.mastered / (b.total || 1)) - (a.mastered / (a.total || 1)))
    .map((c) => `<tr>
        <td class="name">${esc(c.label)}</td>
        <td class="num">${esc(countOf(c.mastered, c.total))}</td>
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
  const mixUps = (p.mix_ups || []).map((m) => {
    const key = `${m.concept_a}|${m.concept_b}`;
    const why = notes[key] || mixUpReason({
      tiers: m.tiers, visual: m.visual_similarity, phonetic: m.phonetic_similarity,
    });
    return `<li>
      <p class="pair">${esc(conceptLabel(m.category_key, m.concept_a))}
         <span class="swap">&harr;</span>
         ${esc(conceptLabel(m.category_key, m.concept_b))}</p>
      <p class="why">${esc(why)}</p>
      <p class="where">${esc(mixUpWhere(m.tiers))}</p>
    </li>`;
  }).join('');

  const mixUpsBlock = mixUps
    ? `<ul class="mixups">${mixUps}</ul>`
    : '<p class="none">Nothing was getting muddled in this period.</p>';

  // ── Day by day, oldest first ───────────────────────────────────────────────
  const days = [...(p.days || [])].sort((a, b) => (a.date < b.date ? -1 : 1)).map((day) => {
    const cats = (day.categories || []).map((cat) => {
      const chips = (cat.concepts || []).map((c) => {
        const mark = c.passed ? '✓' : c.struggled ? '·' : '';
        return `<span class="chip${c.passed ? ' done' : c.struggled ? ' tricky' : ''}">${
          esc(conceptLabel(cat.category_key, c.concept_key))}${mark ? ` ${mark}` : ''}</span>`;
      }).join('');
      return `<div class="catrow"><span class="cat">${esc(cat.label)}</span>${chips}</div>`;
    }).join('');

    const art = includeArtwork && (day.artworks || []).length
      ? `<div class="art">${(day.artworks || [])
          .map((a) => `<img src="${esc(a.image_url)}" alt="Drawing of ${
            esc(conceptLabel(a.category_key, a.concept_key))}" />`).join('')}</div>`
      : '';

    return `<div class="day">
      <h3>${esc(longDate(day.date))}
        <span class="daymeta">${esc(duration(day.time_spent_ms))}</span></h3>
      ${cats}${art}
    </div>`;
  }).join('');

  // ── Practice games ─────────────────────────────────────────────────────────
  // A game counts as played once it has an outcome, pass or fail — the same rule
  // the report screen uses. There is no 'completed' status in the data; testing
  // for one labelled every finished game "not finished".
  const games = (p.activities || []).map((a) => {
    const done = a.status === 'passed' || a.status === 'failed';
    return `<tr>
      <td>${esc(GAME_NAME[a.activity_type] || 'Practice')}</td>
      <td>${esc(difficultyWord(a.difficulty_level) || '—')}</td>
      <td class="num">${esc(a.total_rounds ? countOf(a.correct_count, a.total_rounds) : '—')}</td>
      <td>${esc(done ? 'Played' : 'Started, not finished')}</td>
    </tr>`;
  }).join('');

  const gamesTable = games
    ? `<table class="games">
         <thead><tr><th>Game</th><th>Level</th><th>Right</th><th></th></tr></thead>
         <tbody>${games}</tbody>
       </table>`
    : '';

  // ── How they work ──────────────────────────────────────────────────────────
  const rt = p.response_times || {};
  const eng = p.engagement || {};
  const pace = rt.sample_size
    ? `<ul class="plain">
         <li>Usually answers in ${esc(secondsish(rt.overall_avg_ms))}, over ${esc(tries(rt.sample_size))}.</li>
         ${rt.correct_avg_ms ? `<li>When right: ${esc(secondsish(rt.correct_avg_ms))}.</li>` : ''}
         ${rt.incorrect_avg_ms ? `<li>When wrong: ${esc(secondsish(rt.incorrect_avg_ms))}.</li>` : ''}
         ${eng.video_ms ? `<li>Watched ${esc(duration(eng.video_ms))} of video.</li>` : ''}
         ${eng.coloring_sessions ? `<li>Coloured in ${eng.coloring_sessions} time${eng.coloring_sessions === 1 ? '' : 's'}.</li>` : ''}
       </ul>`
    : '';

  return `<title>${name} — ${esc(report.label || 'Learning report')}</title>
<style>
  /* Print sizing, not screen sizing: pt, and a margin the printer will honour. */
  @page { margin: 14mm; }
  * { box-sizing: border-box; }
  body { font-family: -apple-system, "Segoe UI", Roboto, sans-serif;
         color: ${INK}; font-size: 10.5pt; line-height: 1.45; margin: 0; }
  header { border-bottom: 2pt solid ${INK}; padding-bottom: 8pt; margin-bottom: 14pt; }
  h1 { font-size: 19pt; margin: 0 0 2pt; letter-spacing: -0.4pt; }
  .period { font-size: 11pt; color: ${MUTED}; margin: 0; }
  .made { font-size: 8.5pt; color: ${MUTED}; margin: 4pt 0 0; }

  /* Sections must not be split across a page break mid-heading. */
  section { margin-bottom: 15pt; break-inside: avoid-page; }
  h2 { font-size: 12pt; margin: 0 0 6pt; padding-bottom: 3pt; border-bottom: 1pt solid ${LINE}; }
  h3 { font-size: 10.5pt; margin: 0 0 4pt; }

  .facts { display: flex; flex-wrap: wrap; gap: 8pt; margin: 0 0 10pt; }
  .fact { flex: 1 1 22%; border: 1pt solid ${LINE}; border-radius: 4pt; padding: 6pt 8pt; }
  .fact dt { font-size: 7.5pt; color: ${MUTED}; text-transform: uppercase; letter-spacing: 0.4pt; }
  .fact dd { font-size: 15pt; font-weight: 700; margin: 2pt 0 0; }
  .lede { font-size: 11pt; margin: 0 0 10pt; }

  table { width: 100%; border-collapse: collapse; }
  th { text-align: left; font-size: 8pt; color: ${MUTED}; text-transform: uppercase;
       letter-spacing: 0.4pt; padding: 0 6pt 3pt 0; }
  td { padding: 3pt 6pt 3pt 0; vertical-align: middle; border-top: 1pt solid ${LINE}; }
  .groups .name { width: 32%; font-weight: 700; }
  .groups .num { width: 20%; color: ${MUTED}; white-space: nowrap; }
  .num { white-space: nowrap; }
  .barcell { width: 48%; }
  .bar { position: relative; display: block; height: 7pt; border-radius: 4pt;
         background: #EFF2F4; overflow: hidden; }
  .seg { position: absolute; left: 0; top: 0; bottom: 0; }
  .legend { font-size: 8pt; color: ${MUTED}; margin: 5pt 0 0; }
  .key { display: inline-block; width: 7pt; height: 7pt; border-radius: 4pt;
         margin: 0 3pt 0 10pt; vertical-align: middle; }
  .legend .key:first-child { margin-left: 0; }

  .mixups { list-style: none; padding: 0; margin: 0; }
  .mixups li { border: 1pt solid ${LINE}; border-radius: 4pt; padding: 6pt 8pt; margin-bottom: 5pt;
               break-inside: avoid-page; }
  .pair { font-weight: 700; margin: 0; }
  .swap { color: ${MUTED}; padding: 0 3pt; }
  .why { margin: 2pt 0 0; }
  .where { font-size: 8.5pt; color: ${MUTED}; margin: 2pt 0 0; }
  .none { color: ${MUTED}; margin: 0; }

  .day { border-top: 1pt solid ${LINE}; padding: 7pt 0; break-inside: avoid-page; }
  .day:first-child { border-top: 0; padding-top: 0; }
  .daymeta { float: right; font-size: 8.5pt; font-weight: 400; color: ${MUTED}; }
  .catrow { margin: 3pt 0; }
  .cat { font-size: 7.5pt; color: ${MUTED}; text-transform: uppercase;
         letter-spacing: 0.5pt; margin-right: 5pt; }
  .chip { display: inline-block; border: 1pt solid ${LINE}; border-radius: 8pt;
          padding: 1pt 6pt; margin: 0 3pt 3pt 0; font-size: 9pt; }
  .chip.done { border-color: ${TIER_INK[1]}; }
  .chip.tricky { border-color: #E0B75E; background: #FDF6E7; }
  .art img { height: 74pt; border: 1pt solid ${LINE}; border-radius: 4pt;
             margin: 4pt 4pt 0 0; }

  .plain { margin: 0; padding-left: 14pt; }
  .aiblock { margin-bottom: 7pt; }
  .aiblock h4 { font-size: 9pt; margin: 0 0 2pt; color: ;
                text-transform: uppercase; letter-spacing: 0.4pt; }
  .caveat { font-size: 8.5pt; color: ; font-style: italic; margin: 6pt 0 0; }
  footer { margin-top: 16pt; padding-top: 6pt; border-top: 1pt solid ${LINE};
           font-size: 8pt; color: ${MUTED}; }
</style>

<header>
  <h1>${name}</h1>
  <p class="period">${esc(report.label || '')}${
    report.range_label ? ` &middot; ${esc(report.range_label)}` : ''}</p>
  <p class="made">Learning report &middot; prepared ${esc(longDate(
    String(report.generated_at || '').slice(0, 10)))}</p>
</header>

${narrative}
<div class="facts">${facts}</div>

${section('Where they are up to', groupsTable)}
${section('What this looks like', insights)}
${section('Things that get muddled', mixUpsBlock)}
${section('Day by day', days)}
${section('How they work', pace)}
${section('Practice games', gamesTable)}

<footer>
  ${name} has learned ${esc(String(totals.mastered ?? 0))} of ${
    esc(String(totals.catalogue_concepts ?? 0))} things in total.
  This report covers ${esc(report.range_label || 'the period shown')} and does not change.
</footer>`;
}

/** seconds() without its "about" prefix reading oddly mid-sentence. */
function secondsish(ms) {
  if (typeof ms !== 'number' || !Number.isFinite(ms) || ms <= 0) return '—';
  const s = ms / 1000;
  if (s < 10) return `about ${Math.round(s * 2) / 2} seconds`;
  return `about ${Math.round(s)} seconds`;
}
