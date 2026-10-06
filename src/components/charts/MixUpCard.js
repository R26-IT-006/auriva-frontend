import { View, Text, Image, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../../constants/colors';
import { Layout } from '../../constants/layout';
import { getConceptItem } from '../../data/conceptData';
import { formatConceptLabel } from './ConfusionList';
import { mixUpWhere, mixUpReason } from '../../constants/teacherWording';
import { rs, rf } from '../../utils/responsive';

/**
 * One muddled pair, shown as the two pictures the child actually sees.
 *
 * This replaces a text row that read "shown apple, chose cherry, 3 times". That
 * told a teacher what happened and nothing about why, and it made them hold two
 * concept names in their head to picture the mistake. Two thumbnails side by side
 * make the resemblance the point — which, for a look-alike mix-up, IS the finding.
 *
 * `note` is the model's sentence for this pair. When it is missing — the model is
 * off, the call failed, or it declined to explain this one — the card falls back to
 * a sentence built from the same figures the model was given, so a teacher is never
 * left with a bare pair and no reading of it.
 */
// `large` is the roomy variant used by the "What to work on" pop-up: bigger
// pictures and text, a green "where" chip, and (with `rank`) a numbered badge so
// "most worth your time first" is visible. The compact one stays on the page.
export function MixUpCard({ pair, note, rank = null, large = false }) {
  const { category_key: cat, concept_a: a, concept_b: b, tiers = [] } = pair;

  const itemA = getConceptItem(cat, a);
  const itemB = getConceptItem(cat, b);

  const reason = note || mixUpReason({
    tiers,
    visual:   pair.visual_similarity,
    phonetic: pair.phonetic_similarity,
  });

  // Both rounds means the pair is muddled whichever way it is asked, which is the
  // one case worth flagging harder — it points at the concepts rather than at the
  // pictures or the words.
  const bothRounds = tiers.includes(1) && tiers.includes(2);

  const body = (
    <View style={large ? styles.bodyLarge : null}>
      <View style={styles.pairRow}>
        <Face item={itemA} fallback={a} large={large} />
        {/* The arrow sits in its own badge so it reads as the relationship
            between the two pictures rather than as a third item beside them. */}
        <View style={[styles.swapBadge, large && styles.swapBadgeLarge]}>
          <Ionicons name="swap-horizontal" size={large ? 18 : 15} color={large ? Colors.brandDeep : '#C4674F'} />
        </View>
        <Face item={itemB} fallback={b} large={large} />
      </View>

      <View style={styles.reasonWrap}>
        {/* A quotation mark, not a speech-bubble icon. The sentence is written
            about this pair rather than said by anyone, and the mark carries that
            without occupying a badge's worth of space. */}
        <Text style={[styles.quoteMark, large && styles.quoteMarkLarge]}>“</Text>
        <Text style={[styles.reason, large && styles.reasonLarge]}>{reason}</Text>
      </View>

      {/* Which rounds it happened in, kept last and quiet: it qualifies the
          sentence above rather than competing with it. In the large variant it
          is a small green chip. */}
      {large ? (
        <View style={styles.whereChip}>
          <Text style={styles.whereChipText}>{mixUpWhere(tiers)}</Text>
        </View>
      ) : (
        <Text style={styles.where}>{mixUpWhere(tiers)}</Text>
      )}
    </View>
  );

  if (!large) {
    return <View style={[styles.card, bothRounds && styles.cardBoth]}>{body}</View>;
  }

  return (
    <View style={[styles.card, styles.cardLarge]}>
      {rank != null ? (
        <View style={styles.rankBadge}>
          <Text style={styles.rankText}>{rank}</Text>
        </View>
      ) : null}
      <View style={{ flex: 1 }}>{body}</View>
    </View>
  );
}

function Face({ item, fallback, large = false }) {
  return (
    <View style={styles.face}>
      <View style={[styles.faceImageBox, large && styles.faceImageBoxLarge]}>
        {item?.real || item?.icon ? (
          <Image
            source={item.real ?? item.icon}
            style={styles.faceImage}
            resizeMode="contain"
          />
        ) : (
          <Ionicons name="help-circle-outline" size={26} color={Colors.icon.muted} />
        )}
      </View>
      <Text style={[styles.faceLabel, large && styles.faceLabelLarge]} numberOfLines={1}>
        {(item?.label ?? formatConceptLabel(fallback)).toUpperCase()}
      </Text>
    </View>
  );
}

/** Empty state — worth saying explicitly, because "no card" reads as "not loaded". */
export function MixUpEmpty() {
  return (
    <View style={styles.emptyWrap}>
      <Ionicons name="checkmark-circle-outline" size={18} color={Colors.status.success} />
      <Text style={styles.empty}>Nothing is getting muddled at the moment.</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    padding: Layout.spacing.md,
    borderRadius: Layout.radius.xl,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.borderLight,
    gap: rs(6),
  },
  // A quiet purple edge rather than a warning colour: this is information for a
  // teacher, not an alarm about a child.
  cardBoth: { borderColor: '#D9C2E8', borderWidth: 1.5 },

  // ── Large variant ("What to work on" pop-up) ──────────────────────────────
  cardLarge: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: rs(12),
    padding: rs(12),
    borderRadius: rs(18),
    borderWidth: 1.5,
    borderColor: '#CDEBD8',
  },
  bodyLarge: { gap: rs(6) },
  rankBadge: {
    width: rs(26), height: rs(26), borderRadius: rs(13),
    backgroundColor: Colors.brandDeep,
    alignItems: 'center', justifyContent: 'center',
    marginTop: 2,
  },
  rankText: { fontSize: rf(13), fontFamily: 'DMSans_600SemiBold', color: '#FFFFFF' },
  swapBadgeLarge: { width: rs(28), height: rs(28), borderRadius: rs(14), backgroundColor: '#E4F4EC', marginTop: rs(26) },
  faceImageBoxLarge: { width: rs(76), height: rs(76), borderRadius: rs(20), borderColor: '#CDEBD8', borderWidth: 1.5 },
  faceLabelLarge: { fontSize: rf(11), letterSpacing: 0.8, color: Colors.text.secondary },
  quoteMarkLarge: { fontSize: rf(20), lineHeight: rf(20), color: Colors.brandDeep, opacity: 0.5 },
  reasonLarge: { fontSize: rf(13), lineHeight: rf(19) },
  whereChip: {
    alignSelf: 'flex-start',
    backgroundColor: '#E4F4EC',
    borderRadius: rs(999),
    paddingHorizontal: rs(10),
    paddingVertical: rs(4),
    marginTop: 2,
  },
  whereChipText: { fontSize: rf(11), fontFamily: 'DMSans_600SemiBold', color: Colors.brandDeep },

  pairRow: { flexDirection: 'row', alignItems: 'flex-start', gap: rs(6) },

  swapBadge: {
    width: rs(28), height: rs(28), borderRadius: rs(14),
    backgroundColor: '#FBE7E2',
    alignItems: 'center', justifyContent: 'center',
    marginTop: rs(24),
  },
  quoteMark: { fontSize: rf(18), lineHeight: rf(18), color: '#D9BDB4', fontFamily: 'DMSans_600SemiBold' },

  face:         { alignItems: 'center', gap: rs(6) },
  // Bigger and rounder. These pictures are what the child actually works with —
  // in a learning product they are the subject of the card, not a decoration
  // beside the numbers, and at 62px in a cold grey box they read as icons.
  faceImageBox: {
    width: rs(76), height: rs(76),
    borderRadius: Layout.radius.xl,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: Colors.borderLight,
    alignItems: 'center', justifyContent: 'center',
  },
  faceImage:  { width: '78%', height: '78%' },
  faceLabel:  { fontSize: rf(10), fontFamily: 'DMSans_600SemiBold', color: Colors.text.muted, letterSpacing: 0.7 },

  where: { fontSize: rf(11), color: Colors.text.muted, marginTop: rs(6) },

  reasonWrap: { flexDirection: 'row', gap: rs(6), marginTop: Layout.spacing.sm },
  reason: { flex: 1, fontSize: rf(13), color: Colors.text.primary, lineHeight: rf(18) },

  emptyWrap: { flexDirection: 'row', alignItems: 'center', gap: rs(8), padding: Layout.spacing.md },
  empty:     { fontSize: rf(12), color: Colors.text.secondary },
});
