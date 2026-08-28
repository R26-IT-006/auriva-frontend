import { useState } from 'react';
import { View, Text, Image, ScrollView, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../../constants/colors';
import { Layout } from '../../constants/layout';
import { getConceptItem } from '../../data/conceptData';
import { formatConceptLabel } from './ConfusionList';
import { duration } from '../../constants/teacherWording';

/**
 * What happened on each day, grouped by category within the day.
 *
 * The report used to show a 30-day accuracy sparkline and nothing else about time.
 * A child works on fruits AND animals in one sitting, and a single line per day
 * could not express that — a teacher could see "Tuesday was 71%" and had no way to
 * find out 71% of what, or which groups it was spread across.
 *
 * Drawings made that day sit inside the same card. They were previously in a
 * detached strip on the profile screen with no date context, which made them
 * decoration; next to the concepts worked on the same afternoon they are evidence.
 *
 * One day is shown at a time, chosen from the strip of dates above it. A child
 * who works most weekdays fills a month with thirty of these cards, and stacking
 * them turned the section into most of the report's height — a teacher looking
 * for "what did we do on Tuesday" had to scroll past everything that was not
 * Tuesday. The strip makes the days that exist visible up front and costs one tap.
 */
export function DayByDay({ days = [], onOpenArtwork, accent = Colors.primary }) {
  const [selectedDate, setSelectedDate] = useState(null);

  if (days.length === 0) {
    return (
      <View style={styles.emptyWrap}>
        <Ionicons name="calendar-outline" size={18} color={Colors.icon.muted} />
        <Text style={styles.empty}>No sessions recorded yet.</Text>
      </View>
    );
  }

  // Resolved rather than stored: `days` is replaced on every pull-to-refresh, and
  // a date held in state can outlive the day it names once it drops out of the
  // report window. Falling back to the newest keeps a card on screen regardless.
  const active = days.find((d) => d.date === selectedDate) ?? days[0];

  return (
    <View style={styles.list}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.stripScroll}
        contentContainerStyle={styles.strip}
      >
        {days.map((day) => (
          <DateTile
            key={day.date}
            day={day}
            active={day.date === active.date}
            accent={accent}
            onPress={() => setSelectedDate(day.date)}
          />
        ))}
      </ScrollView>

      <DayCard day={active} onOpenArtwork={onOpenArtwork} />
    </View>
  );
}

/**
 * One day in the picker strip.
 *
 * Shaped like a calendar tile — weekday, then the number big — because that is
 * how a teacher holds a date in their head, and it stays scannable at a size that
 * fits a fortnight of them on screen at once.
 */
function DateTile({ day, active, accent, onPress }) {
  const { top, num, month } = tileParts(day.date);
  const hasArt = (day.artworks || []).length > 0;

  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.8}
      accessibilityRole="tab"
      accessibilityState={{ selected: active }}
      accessibilityLabel={`${top} ${num} ${month}${hasArt ? ', has drawings' : ''}`}
      style={[styles.tile, active && { backgroundColor: accent, borderColor: accent }]}
    >
      <Text style={[styles.tileTop, active && styles.tileTextActive]} numberOfLines={1}>{top}</Text>
      <Text style={[styles.tileNum, active && styles.tileTextActive]}>{num}</Text>
      <Text style={[styles.tileMonth, active && styles.tileTextActive]} numberOfLines={1}>{month}</Text>
      {/* Marks the days with drawings on them, so finding one does not mean
          opening every tile in turn. */}
      <View style={[
        styles.tileDot,
        hasArt && styles.tileDotOn,
        hasArt && active && styles.tileDotOnActive,
      ]} />
    </TouchableOpacity>
  );
}

function DayCard({ day, onOpenArtwork }) {
  const categories = day.categories || [];
  const artworks   = day.artworks || [];

  // The header carries the shape of the day so the card can be skipped without
  // reading every chip — how much was covered, and how long it took.
  const conceptCount = categories.reduce((n, c) => n + (c.concepts || []).length, 0);

  return (
    <View style={styles.card}>
      <View style={styles.cardHead}>
        <Text style={styles.date}>{friendlyDate(day.date)}</Text>
        <View style={styles.metaRow}>
          {conceptCount > 0 && (
            <View style={styles.metaPill}>
              <Ionicons name="shapes-outline" size={11} color={Colors.text.secondary} />
              <Text style={styles.metaText}>
                {conceptCount} {conceptCount === 1 ? 'thing' : 'things'}
              </Text>
            </View>
          )}
          {day.time_spent_ms > 0 && (
            <View style={styles.metaPill}>
              <Ionicons name="time-outline" size={11} color={Colors.text.secondary} />
              <Text style={styles.metaText}>{duration(day.time_spent_ms)}</Text>
            </View>
          )}
        </View>
      </View>

      {categories.map((cat) => (
        <View key={cat.category_key} style={styles.catBlock}>
          <Text style={styles.catLabel}>{cat.label}</Text>
          <View style={styles.chipRow}>
            {(cat.concepts || []).map((c) => (
              <ConceptChip key={c.concept_key} concept={c} categoryKey={cat.category_key} />
            ))}
          </View>
        </View>
      ))}

      {artworks.length > 0 && (
        <View style={styles.artBlock}>
          <Text style={styles.artLabel}>
            {artworks.length === 1 ? 'Drawing from this day' : 'Drawings from this day'}
          </Text>
          <View style={styles.artRow}>
            {artworks.map((art) => (
              <TouchableOpacity
                key={art.id}
                activeOpacity={0.85}
                onPress={() => onOpenArtwork?.(art)}
                accessibilityRole="imagebutton"
                accessibilityLabel={`Drawing of ${labelFor(art)}. Opens full size.`}
                style={styles.artThumbWrap}
              >
                <Image source={{ uri: art.image_url }} style={styles.artThumb} resizeMode="cover" />
                {/* A thumbnail of a drawing looks like an illustration, not a
                    control. The corner glyph is what says it opens. */}
                <View style={styles.artExpand}>
                  <Ionicons name="expand-outline" size={11} color="#FFFFFF" />
                </View>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      )}
    </View>
  );
}

/**
 * One concept, with the day's outcome on its face.
 *
 * `passed` and `struggled` are not exclusive on purpose — a child can fail a round
 * and then clear it in the same session, which is a good day and should not read as
 * a bad one. Cleared-in-the-end wins; the retry shows as the small mark.
 *
 * Passing is the common case — most days are a full card of it — so it is the one
 * state that gets no fill. A green wash on every chip made a good day look like a
 * warning panel and left nothing for the eye to land on; colour now marks only the
 * concept that gave trouble, and the tick badge carries "done" on its own.
 */
function ConceptChip({ concept, categoryKey }) {
  const item = getConceptItem(categoryKey, concept.concept_key);
  const label = item?.label ?? formatConceptLabel(concept.concept_key);

  const tone = concept.passed ? 'good' : concept.struggled ? 'tricky' : 'neutral';

  return (
    <View style={[styles.chip, styles[`chip_${tone}`]]}>
      <Text style={[styles.chipText, styles[`chipText_${tone}`]]} numberOfLines={1}>{label}</Text>
      {concept.passed && (
        <View style={styles.doneBadge}>
          <Ionicons name="checkmark" size={10} color="#FFFFFF" />
        </View>
      )}
      {!concept.passed && concept.struggled && (
        <Ionicons name="swap-horizontal" size={13} color="#B4780A" />
      )}
    </View>
  );
}

function labelFor(art) {
  const item = getConceptItem(art.category_key, art.concept_key);
  return item?.label ?? formatConceptLabel(art.concept_key);
}

/**
 * Built from local parts rather than `new Date(iso)`: the backend sends a bare
 * YYYY-MM-DD, which JS parses as UTC midnight, so a teacher east of Greenwich
 * would see every session dated a day early.
 */
function parseLocalDate(iso) {
  const [y, m, d] = (iso || '').split('-').map(Number);
  if (!y || !m || !d) return null;
  return new Date(y, m - 1, d);
}

/** Whole days between `date` and today, in the viewer's own timezone. */
function daysAgo(date) {
  const at = (x) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
  return Math.round((at(new Date()) - at(date)) / 86400000);
}

/** "Today", "Yesterday", then "Tuesday 12 August". */
function friendlyDate(iso) {
  const date = parseLocalDate(iso);
  if (!date) return iso;

  const diff = daysAgo(date);
  if (diff === 0) return 'Today';
  if (diff === 1) return 'Yesterday';

  return date.toLocaleDateString(undefined, {
    weekday: 'long', day: 'numeric', month: 'long',
  });
}

/** The three lines of a picker tile: weekday, day number, month. */
function tileParts(iso) {
  const date = parseLocalDate(iso);
  if (!date) return { top: '', num: iso, month: '' };

  const diff = daysAgo(date);
  // Abbreviated on the tile — "Yesterday" does not fit, and the weekday is a
  // label here rather than a sentence.
  const top =
    diff === 0 ? 'Today' :
    diff === 1 ? 'Yest.' :
    date.toLocaleDateString(undefined, { weekday: 'short' });

  return {
    top,
    num:   String(date.getDate()),
    month: date.toLocaleDateString(undefined, { month: 'short' }),
  };
}

const styles = StyleSheet.create({
  list: { padding: Layout.spacing.md, gap: Layout.spacing.md },

  // ── Date picker ───────────────────────────────────────────────────────────
  // The strip bleeds through the list's own padding and puts it back inside the
  // content, so tiles scroll to the section's edges instead of appearing to be
  // clipped 16px short of them.
  stripScroll: { marginHorizontal: -Layout.spacing.md },
  strip: {
    gap: Layout.spacing.sm,
    paddingHorizontal: Layout.spacing.md,
    paddingVertical: 2,
  },
  tile: {
    width: 56,
    alignItems: 'center',
    paddingVertical: Layout.spacing.sm,
    borderRadius: Layout.radius.md,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  tileTop: {
    fontSize: Layout.fontSize.xs - 1,
    fontFamily: 'DMSans_600SemiBold',
    color: Colors.text.muted,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  tileNum: {
    fontSize: Layout.fontSize.lg,
    fontFamily: 'DMSans_800ExtraBold',
    color: Colors.text.primary,
    lineHeight: Layout.fontSize.lg * 1.25,
  },
  tileMonth: {
    fontSize: Layout.fontSize.xs - 1,
    fontFamily: 'DMSans_600SemiBold',
    color: Colors.text.muted,
  },
  tileTextActive: { color: '#FFFFFF' },
  // Always laid out, coloured in only when the day has drawings — reserving the
  // space keeps every tile the same height whether or not it has any.
  tileDot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    marginTop: 4,
    backgroundColor: 'transparent',
  },
  tileDotOn:       { backgroundColor: Colors.text.muted },
  tileDotOnActive: { backgroundColor: 'rgba(255,255,255,0.85)' },

  card: {
    padding: Layout.spacing.md,
    borderRadius: Layout.radius.md,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.borderLight,
    gap: Layout.spacing.sm,
    ...Layout.shadow.sm,
  },
  cardHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Layout.spacing.sm,
  },
  date: { fontSize: Layout.fontSize.md, fontFamily: 'DMSans_700Bold', color: Colors.text.primary },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  metaPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: Layout.radius.full,
    backgroundColor: Colors.surfaceAlt,
  },
  metaText: {
    fontSize: Layout.fontSize.xs,
    color: Colors.text.secondary,
    fontFamily: 'DMSans_600SemiBold',
  },

  catBlock: { gap: 6 },
  catLabel: {
    fontSize: Layout.fontSize.xs - 1,
    fontFamily: 'DMSans_600SemiBold',
    color: Colors.text.muted,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  chipRow:  { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },

  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 5,
    paddingHorizontal: 10,
    borderRadius: Layout.radius.full,
    borderWidth: 1,
  },
  // Passed is an outlined chip on the card's own white, so it sits a step above
  // the flat grey of a concept that was only attempted; the tick tells them
  // apart at a glance, and neither shouts.
  chip_good:    { backgroundColor: Colors.surface,    borderColor: Colors.border },
  chip_tricky:  { backgroundColor: '#FDF3E0',         borderColor: '#F0DBB0' },
  chip_neutral: { backgroundColor: Colors.surfaceAlt, borderColor: Colors.borderLight },

  chipText: { fontSize: Layout.fontSize.sm, fontFamily: 'DMSans_600SemiBold', maxWidth: 140 },
  chipText_good:    { color: Colors.text.primary },
  chipText_tricky:  { color: '#8A5D06' },
  chipText_neutral: { color: Colors.text.muted },

  // The whole of the green: a 15px badge instead of a chip-wide wash.
  doneBadge: {
    width: 15,
    height: 15,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#3FAE6F',
  },

  artBlock: {
    gap: 7,
    marginTop: 2,
    paddingTop: Layout.spacing.sm,
    borderTopWidth: 1,
    borderTopColor: Colors.divider,
  },
  artLabel: {
    fontSize: Layout.fontSize.xs - 1,
    fontFamily: 'DMSans_600SemiBold',
    color: Colors.text.muted,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  artRow:   { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  artThumbWrap: { borderRadius: Layout.radius.md, ...Layout.shadow.sm },
  artThumb: {
    // Up from 58: at that size a coloured-in drawing was a smudge, and the whole
    // point of showing it is that a teacher can tell what they are looking at.
    width: 72, height: 72,
    borderRadius: Layout.radius.md,
    backgroundColor: Colors.surfaceAlt,
    borderWidth: 1,
    borderColor: Colors.borderLight,
  },
  artExpand: {
    position: 'absolute',
    right: 4,
    bottom: 4,
    width: 19,
    height: 19,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(16,20,34,0.55)',
  },

  emptyWrap: { flexDirection: 'row', alignItems: 'center', gap: 8, padding: Layout.spacing.md },
  empty:     { fontSize: Layout.fontSize.sm, color: Colors.text.secondary },
});
