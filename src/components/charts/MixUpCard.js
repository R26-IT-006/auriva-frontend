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
  const { category_key: cat, concept_a: a, concept_b: b, count, tiers = [] } = pair;

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
        <View style={styles.swapWrap}>
          <Ionicons name="swap-horizontal" size={18} color="#7B1FA2" />
        </View>
        <Face item={itemB} fallback={b} />
      </View>

      <Text style={styles.count}>
        Muddled {count === 1 ? 'once' : `${count} times`}
      </Text>
      <Text style={styles.where}>{mixUpWhere(tiers)}</Text>

      <View style={styles.reasonWrap}>
        <Ionicons name="chatbubble-ellipses-outline" size={14} color={Colors.text.secondary} />
        <Text style={styles.reason}>{reason}</Text>
      </View>
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
        {item?.label ?? formatConceptLabel(fallback)}
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
    borderRadius: Layout.radius.md,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.borderLight,
    gap: 6,
  },
  // A quiet purple edge rather than a warning colour: this is information for a
  // teacher, not an alarm about a child.
  cardBoth: { borderColor: '#D9C2E8', borderWidth: 1.5 },

  pairRow:  { flexDirection: 'row', alignItems: 'center', gap: Layout.spacing.sm },
  swapWrap: { paddingHorizontal: 2 },

  face:         { flex: 1, alignItems: 'center', gap: 4 },
  faceImageBox: {
    width: 62, height: 62,
    borderRadius: Layout.radius.md,
    backgroundColor: Colors.surfaceAlt,
    alignItems: 'center', justifyContent: 'center',
  },
  faceImage:  { width: '78%', height: '78%' },
  faceLabel:  { fontSize: Layout.fontSize.xs, fontFamily: 'DMSans_700Bold', color: Colors.text.primary },

  count: { fontSize: Layout.fontSize.sm, fontFamily: 'DMSans_700Bold', color: Colors.text.primary, marginTop: 2 },
  where: { fontSize: Layout.fontSize.xs, color: Colors.text.secondary },

  reasonWrap: {
    flexDirection: 'row',
    gap: 7,
    marginTop: 4,
    padding: Layout.spacing.sm,
    borderRadius: Layout.radius.sm,
    backgroundColor: Colors.surfaceAlt,
  },
  reason: { flex: 1, fontSize: Layout.fontSize.xs, color: Colors.text.secondary, lineHeight: 17 },

  emptyWrap: { flexDirection: 'row', alignItems: 'center', gap: 8, padding: Layout.spacing.md },
  empty:     { fontSize: Layout.fontSize.sm, color: Colors.text.secondary },
});
