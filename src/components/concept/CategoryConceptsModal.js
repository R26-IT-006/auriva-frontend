import { useEffect, useState, useCallback } from 'react';
import {
  Modal,
  View,
  Text,
  Image,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../../constants/colors';
import { Layout } from '../../constants/layout';
import { conceptApi } from '../../api/concept';
import { getConceptItem, getConceptItemsForCategory } from '../../data/conceptData';

/**
 * Everything inside one group, as the pictures the child actually sees.
 *
 * The breakdown card says "8 of 21 learned" and stops there, which answers how
 * far along but never which — and "which" is the question a teacher asks when
 * they are deciding what to open next. This is the same picture grid the drawing
 * activity uses, with the real photographs rather than the colouring outlines,
 * split into what is already learned and what to do next.
 *
 * The order of "Up next" is the server's, not ours. `getConceptItems` returns the
 * category sequence already reordered by the child's own confusion pairs, and
 * flags the concepts that reordering actually promoted. Sorting it here by name
 * or by progress would throw away the one part of this screen the child's history
 * earned.
 */
export function CategoryConceptsModal({ visible, category, studentId, accent = Colors.primary, onClose }) {
  const [items, setItems]     = useState(null);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed]   = useState(false);

  // The analytics summary names it `category_key`; the local catalogue and the
  // concept screens name it `key`. Accepting both means this opens from either
  // without the caller having to reshape what it already has.
  const categoryKey = category?.category_key ?? category?.key ?? null;

  const load = useCallback(async () => {
    if (!categoryKey || !studentId) return;
    setLoading(true);
    setFailed(false);
    try {
      const rows  = await conceptApi.getConceptItems(categoryKey, studentId);
      const local = getConceptItemsForCategory(categoryKey);

      // Walk the server's rows, not the local list: the local list is in
      // catalogue order and the server's carries the recommended one.
      const merged = rows.map((r) => {
        const item = local.find((l) => l.key === r.concept_key);
        return {
          ...r,
          label: item?.label ?? r.concept_key,
          image: item?.real ?? item?.icon ?? null,
        };
      });
      setItems(merged);
    } catch {
      setFailed(true);
      setItems(null);
    } finally {
      setLoading(false);
    }
  }, [categoryKey, studentId]);

  // Refetches per open rather than caching: a teacher opens this after a session,
  // and a stale grid would show work the child has just finished as still to do.
  useEffect(() => { if (visible) load(); }, [visible, load]);

  // Mastery is tier 1 AND tier 2 — the picture and the word — which is the same
  // rule the "8 of 21" on the card that opened this counts by. Anything looser
  // here and the two numbers would disagree on the same screen.
  const learned = (items || []).filter(
    (i) => i.tier1_status === 'passed' && i.tier2_status === 'passed',
  );
  const upNext = (items || []).filter(
    (i) => !(i.tier1_status === 'passed' && i.tier2_status === 'passed'),
  );

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      statusBarTranslucent
      onRequestClose={onClose}
    >
      {/* Tapping the backdrop closes it. A floating dialog has dead space around
          it in a way an edge-anchored sheet does not, and tapping beside a dialog
          to dismiss it is the gesture people already have. */}
      <TouchableOpacity
        style={styles.backdrop}
        activeOpacity={1}
        onPress={onClose}
        accessibilityRole="button"
        accessibilityLabel="Close"
      >
        {/* Swallows taps so a press inside the card does not reach the backdrop. */}
        <TouchableOpacity style={styles.dialog} activeOpacity={1}>
          <View style={styles.head}>
            <View style={{ flex: 1 }}>
              <Text style={styles.title} numberOfLines={1}>{category?.label}</Text>
              {items ? (
                <Text style={styles.subtitle}>
                  {learned.length} of {items.length} learned
                </Text>
              ) : null}
            </View>
            <TouchableOpacity
              onPress={onClose}
              style={styles.closeBtn}
              activeOpacity={0.7}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              accessibilityRole="button"
              accessibilityLabel="Close"
            >
              <Ionicons name="close" size={20} color={Colors.text.secondary} />
            </TouchableOpacity>
          </View>

          {loading ? (
            <View style={styles.centre}><ActivityIndicator color={accent} /></View>
          ) : failed ? (
            <View style={styles.centre}>
              <Ionicons name="cloud-offline-outline" size={24} color={Colors.icon.muted} />
              <Text style={styles.centreText}>Couldn't load this group.</Text>
              <TouchableOpacity onPress={load} accessibilityRole="button">
                <Text style={[styles.retry, { color: accent }]}>Try again</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <ScrollView
              contentContainerStyle={styles.scroll}
              showsVerticalScrollIndicator={false}
            >
              {upNext.length > 0 && (
                <Section
                  title="Up next"
                  hint="In the order the app will offer them, worked out from what this child mixes up"
                  count={upNext.length}
                >
                  {upNext.map((i) => (
                    <ConceptCard key={i.concept_key} item={i} accent={accent} />
                  ))}
                </Section>
              )}

              {learned.length > 0 && (
                <Section title="Learned" count={learned.length}>
                  {learned.map((i) => (
                    <ConceptCard key={i.concept_key} item={i} accent={accent} learned />
                  ))}
                </Section>
              )}
            </ScrollView>
          )}
        </TouchableOpacity>
      </TouchableOpacity>
    </Modal>
  );
}

function Section({ title, hint, count, children }) {
  return (
    <View style={styles.section}>
      <View style={styles.sectionHead}>
        <Text style={styles.sectionTitle}>{title}</Text>
        <View style={styles.countPill}><Text style={styles.countText}>{count}</Text></View>
      </View>
      {hint ? <Text style={styles.sectionHint}>{hint}</Text> : null}
      <View style={styles.grid}>{children}</View>
    </View>
  );
}

function ConceptCard({ item, accent, learned }) {
  // Both ends of every confusion pair come back, so this fires on the concept the
  // child was asked about AND on the one they reached for instead.
  const mixedWith = (item.confused_with || [])
    .map((k) => getConceptItem(item.category_key, k)?.label)
    .filter(Boolean);

  return (
    <View
      style={[
        styles.card,
        learned && styles.cardLearned,
        item.is_priority && { borderColor: accent },
      ]}
      accessibilityLabel={
        `${item.label}. ${learned ? 'Learned' : 'Not learned yet'}` +
        (item.is_priority ? '. Worth doing next' : '') +
        (mixedWith.length ? `. Mixed up with ${mixedWith.join(', ')}` : '')
      }
    >
      <View style={styles.thumbWrap}>
        {item.image ? (
          <Image source={item.image} style={styles.thumb} resizeMode="contain" />
        ) : (
          <View style={styles.thumb} />
        )}

        {/* Dimming the picture, not hiding it: a teacher recognises the row by
            its photographs, so a learned concept still has to be findable. */}
        {learned ? (
          <View style={styles.doneBadge}>
            <Ionicons name="checkmark" size={12} color="#FFFFFF" />
          </View>
        ) : null}
      </View>

      <Text style={styles.cardLabel} numberOfLines={2}>{item.label}</Text>

      {/* The starred ones are those the confusion ordering actually moved up the
          sequence — not merely everything unfinished. */}
      {item.is_priority && !learned ? (
        <View style={[styles.nextPill, { backgroundColor: accent }]}>
          <Ionicons name="arrow-up" size={9} color="#FFFFFF" />
          <Text style={styles.nextText}>Next</Text>
        </View>
      ) : null}

      {mixedWith.length > 0 ? (
        <View style={styles.mixRow}>
          <Ionicons name="swap-horizontal" size={11} color="#B4780A" />
          <Text style={styles.mixText} numberOfLines={2}>{mixedWith.join(', ')}</Text>
        </View>
      ) : null}
    </View>
  );
}

const CARD_W = 104;

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(16,20,34,0.45)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: Layout.spacing.lg,
  },
  // A dialog floating clear of every edge rather than a sheet joined to the
  // bottom of the screen. It is one group's contents pulled out of the panel
  // behind it — a thing lifted off the page, not a drawer the page opens into —
  // and the backdrop showing on all four sides is what says so.
  //
  // Capped rather than sized: a group of four should be a small card, and only a
  // group of twenty-one should reach for the height.
  dialog: {
    width: '100%',
    maxWidth: 560,
    maxHeight: '82%',
    backgroundColor: Colors.surface,
    borderRadius: 28,
    overflow: 'hidden',
    ...Layout.shadow.lg,
  },

  head: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Layout.spacing.md,
    paddingHorizontal: Layout.spacing.lg,
    paddingTop: Layout.spacing.lg,
    paddingBottom: Layout.spacing.sm,
  },
  title:    { fontSize: Layout.fontSize.xl, fontFamily: 'DMSans_800ExtraBold', color: Colors.text.primary },
  subtitle: { fontSize: Layout.fontSize.sm, color: Colors.text.secondary, marginTop: 2 },
  closeBtn: {
    width: 34, height: 34, borderRadius: 17,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: Colors.surfaceAlt,
  },

  centre: { paddingVertical: Layout.spacing.xxl, alignItems: 'center', gap: Layout.spacing.sm },
  centreText: { fontSize: Layout.fontSize.sm, color: Colors.text.secondary },
  retry: { fontSize: Layout.fontSize.sm, fontFamily: 'DMSans_700Bold' },

  scroll:  { padding: Layout.spacing.lg, paddingTop: Layout.spacing.sm, gap: Layout.spacing.xl },
  section: { gap: Layout.spacing.sm },
  sectionHead: { flexDirection: 'row', alignItems: 'center', gap: Layout.spacing.sm },
  sectionTitle: { fontSize: Layout.fontSize.md, fontFamily: 'DMSans_800ExtraBold', color: Colors.text.primary },
  countPill: {
    paddingHorizontal: 8, paddingVertical: 2,
    borderRadius: Layout.radius.full,
    backgroundColor: Colors.surfaceAlt,
  },
  countText: { fontSize: 11, fontFamily: 'DMSans_700Bold', color: Colors.text.secondary },
  sectionHint: {
    fontSize: Layout.fontSize.xs,
    color: Colors.text.muted,
    lineHeight: Layout.fontSize.xs * 1.5,
  },

  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginTop: 4 },
  card: {
    width: CARD_W,
    padding: 8,
    gap: 5,
    alignItems: 'center',
    borderWidth: 2,
    borderRadius: 18,
    borderColor: Colors.borderLight,
    backgroundColor: Colors.surface,
  },
  cardLearned: { backgroundColor: Colors.surfaceAlt, borderColor: Colors.borderLight },

  thumbWrap: { width: '100%' },
  thumb: { width: '100%', height: 66 },
  doneBadge: {
    position: 'absolute',
    right: -2, top: -2,
    width: 18, height: 18, borderRadius: 9,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: '#3FAE6F',
    borderWidth: 2,
    borderColor: Colors.surface,
  },

  cardLabel: {
    fontSize: 13,
    fontFamily: 'DMSans_700Bold',
    color: Colors.text.primary,
    textAlign: 'center',
  },
  nextPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: Layout.radius.full,
  },
  nextText: { fontSize: 9, fontFamily: 'DMSans_700Bold', color: '#FFFFFF', letterSpacing: 0.4 },

  mixRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 3 },
  mixText: {
    flex: 1,
    fontSize: 10,
    lineHeight: 13,
    color: '#8A5D06',
    fontFamily: 'DMSans_600SemiBold',
  },
});
