import { View, Text, Image, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../../constants/colors';
import { Layout } from '../../constants/layout';
import { getConceptItem } from '../../data/conceptData';
import { formatConceptLabel } from './ConfusionList';
import { mixUpWhere, mixUpReason } from '../../constants/teacherWording';

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
export function MixUpCard({ pair, note }) {
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

  return (
    <View style={[styles.card, bothRounds && styles.cardBoth]}>
      <View style={styles.pairRow}>
        <Face item={itemA} fallback={a} />
        {/* The arrow sits in its own badge so it reads as the relationship
            between the two pictures rather than as a third item beside them. */}
        <View style={styles.swapBadge}>
          <Ionicons name="swap-horizontal" size={15} color="#C4674F" />
        </View>
        <Face item={itemB} fallback={b} />
      </View>

      <View style={styles.reasonWrap}>
        {/* A quotation mark, not a speech-bubble icon. The sentence is written
            about this pair rather than said by anyone, and the mark carries that
            without occupying a badge's worth of space. */}
        <Text style={styles.quoteMark}>“</Text>
        <Text style={styles.reason}>{reason}</Text>
      </View>

      {/* Which rounds it happened in, kept last and quiet: it qualifies the
          sentence above rather than competing with it. */}
      <Text style={styles.where}>{mixUpWhere(tiers)}</Text>
    </View>
  );
}

function Face({ item, fallback }) {
  return (
    <View style={styles.face}>
      <View style={styles.faceImageBox}>
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
      <Text style={styles.faceLabel} numberOfLines={1}>
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
    gap: 6,
  },
  // A quiet purple edge rather than a warning colour: this is information for a
  // teacher, not an alarm about a child.
  cardBoth: { borderColor: '#D9C2E8', borderWidth: 1.5 },

  pairRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 6 },

  swapBadge: {
    width: 28, height: 28, borderRadius: 14,
    backgroundColor: '#FBE7E2',
    alignItems: 'center', justifyContent: 'center',
    marginTop: 24,
  },
  quoteMark: { fontSize: 18, lineHeight: 18, color: '#D9BDB4', fontFamily: 'DMSans_800ExtraBold' },

  face:         { alignItems: 'center', gap: 6 },
  // Bigger and rounder. These pictures are what the child actually works with —
  // in a learning product they are the subject of the card, not a decoration
  // beside the numbers, and at 62px in a cold grey box they read as icons.
  faceImageBox: {
    width: 76, height: 76,
    borderRadius: Layout.radius.xl,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: Colors.borderLight,
    alignItems: 'center', justifyContent: 'center',
  },
  faceImage:  { width: '78%', height: '78%' },
  faceLabel:  { fontSize: 9, fontFamily: 'DMSans_700Bold', color: Colors.text.muted, letterSpacing: 0.7 },

  where: { fontSize: 10, color: Colors.text.muted, marginTop: 6 },

  reasonWrap: { flexDirection: 'row', gap: 6, marginTop: Layout.spacing.sm },
  reason: { flex: 1, fontSize: 12, color: Colors.text.primary, lineHeight: 18 },

  emptyWrap: { flexDirection: 'row', alignItems: 'center', gap: 8, padding: Layout.spacing.md },
  empty:     { fontSize: 12, color: Colors.text.secondary },
});
