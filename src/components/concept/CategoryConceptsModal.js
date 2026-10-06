import { useEffect, useState, useCallback } from 'react';
import {
  Modal,
  Pressable,
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
import { GROUP_FACE, FALLBACK_FACE } from '../charts/GroupProgress';
import { rs, rf } from '../../utils/responsive';

const GRID_GAP = rs(10);
// Four across when the dialog is wide enough for ~110pt cards, fewer otherwise.
const MIN_CARD = rs(110);
const SCROLL_PAD = rs(20);

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
  const [gridW, setGridW]     = useState(0);

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

  // The group's own colour and icon, as on the breakdown card that opened this.
  const face = GROUP_FACE[categoryKey] || FALLBACK_FACE;

  // Measured so the cards fill each row edge to edge instead of leaving a gap.
  const cols  = gridW
    ? Math.max(2, Math.min(4, Math.floor((gridW + GRID_GAP) / (MIN_CARD + GRID_GAP))))
    : 4;
  const cardW = gridW ? Math.floor((gridW - GRID_GAP * (cols - 1)) / cols) : MIN_CARD;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      statusBarTranslucent
      onRequestClose={onClose}
    >
      <View style={styles.backdrop}>
        {/* Tapping the backdrop closes it. A sibling Pressable rather than a
            wrapper around the card, so a drag inside the card reaches the
            ScrollView instead of being swallowed as a tap. */}
        <Pressable
          style={StyleSheet.absoluteFill}
          onPress={onClose}
          accessibilityRole="button"
          accessibilityLabel="Close"
        />

        <View style={styles.dialog}>
          <View style={[styles.head, { backgroundColor: face.bg }]}>
            <View style={styles.headIcon}>
              <Ionicons name={face.icon.replace(/-outline$/, '')} size={22} color={face.fg} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.title} numberOfLines={1}>{category?.label}</Text>
              {items ? (
                <Text style={[styles.subtitle, { color: face.fg }]}>
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
              style={styles.scrollView}
              contentContainerStyle={styles.scroll}
              showsVerticalScrollIndicator={false}
              // The grid's width is the scroller's less its side padding.
              onLayout={(e) => setGridW(e.nativeEvent.layout.width - SCROLL_PAD * 2)}
            >

              {upNext.length > 0 && (
                <Section
                  title="Up next"
                  icon="play-forward"
                  tint={accent}
                  hint="In the order the app will offer them, worked out from what this child mixes up"
                  count={upNext.length}
                >
                  {upNext.map((i) => (
                    <ConceptCard key={i.concept_key} item={i} accent={accent} width={cardW} />
                  ))}
                </Section>
              )}

              {learned.length > 0 && (
                <Section title="Learned" icon="checkmark-circle" tint="#3FAE6F" count={learned.length}>
                  {learned.map((i) => (
                    <ConceptCard key={i.concept_key} item={i} accent={accent} width={cardW} learned />
                  ))}
                </Section>
              )}
            </ScrollView>
          )}
        </View>
      </View>
    </Modal>
  );
}

function Section({ title, icon, tint, hint, count, children }) {
  return (
    <View style={styles.section}>
      <View style={styles.sectionHead}>
        <Ionicons name={icon} size={16} color={tint} />
        <Text style={styles.sectionTitle}>{title}</Text>
        <View style={[styles.countPill, { backgroundColor: tint + '1F' }]}>
          <Text style={[styles.countText, { color: tint }]}>{count}</Text>
        </View>
      </View>
      {hint ? (
        <View style={styles.hintBox}>
          <Ionicons name="information-circle-outline" size={14} color={Colors.text.muted} />
          <Text style={styles.sectionHint}>{hint}</Text>
        </View>
      ) : null}
      <View style={styles.grid}>{children}</View>
    </View>
  );
}

function ConceptCard({ item, accent, learned, width }) {
  // Both ends of every confusion pair come back, so this fires on the concept the
  // child was asked about AND on the one they reached for instead.
  const mixedWith = (item.confused_with || [])
    .map((k) => getConceptItem(item.category_key, k)?.label)
    .filter(Boolean);

  const priority = item.is_priority && !learned;

  return (
    <View
      style={[
        styles.card,
        { width },
        priority && { borderColor: accent, borderWidth: 2 },
      ]}
      accessibilityLabel={
        `${item.label}. ${learned ? 'Learned' : 'Not learned yet'}` +
        (item.is_priority ? '. Worth doing next' : '') +
        (mixedWith.length ? `. Mixed up with ${mixedWith.join(', ')}` : '')
      }
    >
      {/* The starred ones are those the confusion ordering actually moved up the
          sequence — not merely everything unfinished. On the card's top edge, so
          it reads as a tag on the card rather than part of the picture. */}
      {priority ? (
        <View style={styles.nextWrap} pointerEvents="none">
          <View style={[styles.nextPill, { backgroundColor: accent }]}>
            <Ionicons name="arrow-up" size={9} color="#FFFFFF" />
            <Text style={styles.nextText}>Next</Text>
          </View>
        </View>
      ) : null}

      <View style={[styles.thumbWrap, learned && styles.thumbWrapLearned]}>
        {item.image ? (
          <Image source={item.image} style={styles.thumb} resizeMode="contain" />
        ) : (
          <View style={styles.thumb} />
        )}

        {/* Marking the picture, not hiding it: a teacher recognises the row by
            its photographs, so a learned concept still has to be findable. */}
        {learned ? (
          <View style={styles.doneBadge}>
            <Ionicons name="checkmark" size={12} color="#FFFFFF" />
          </View>
        ) : null}
      </View>

      <Text style={styles.cardLabel} numberOfLines={2}>{item.label}</Text>

      {mixedWith.length > 0 ? (
        <View style={styles.mixRow}>
          <Ionicons name="swap-horizontal" size={11} color="#B4780A" />
          <Text style={styles.mixText} numberOfLines={2}>{mixedWith.join(', ')}</Text>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(16,20,34,0.45)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: Layout.spacing.lg,
  },
  // A dialog floating clear of every edge rather than a sheet joined to the
  // bottom of the screen. Capped rather than sized: a group of four should be a
  // small card, and only a group of twenty-one should reach for the height.
  dialog: {
    width: '100%',
    maxWidth: rs(580),
    maxHeight: '84%',
    backgroundColor: Colors.surface,
    borderRadius: rs(24),
    overflow: 'hidden',
  },

  head: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: rs(12),
    paddingHorizontal: rs(20),
    paddingVertical: rs(16),
  },
  headIcon: {
    width: rs(44), height: rs(44), borderRadius: rs(22),
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: '#FFFFFF',
  },
  title:    { fontSize: rf(20), fontFamily: 'DMSans_800ExtraBold', color: Colors.text.primary },
  subtitle: { fontSize: rf(13), fontFamily: 'DMSans_600SemiBold', marginTop: 1 },
  closeBtn: {
    width: rs(34), height: rs(34), borderRadius: rs(17),
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.85)',
  },

  centre: { paddingVertical: Layout.spacing.xxl, alignItems: 'center', gap: Layout.spacing.sm },
  centreText: { fontSize: Layout.fontSize.sm, color: Colors.text.secondary },
  retry: { fontSize: Layout.fontSize.sm, fontFamily: 'DMSans_700Bold' },

  // flexShrink lets the list scroll inside the capped dialog instead of pushing
  // past it.
  scrollView: { flexShrink: 1 },
  scroll:  { padding: SCROLL_PAD, paddingTop: rs(16), gap: rs(22) },
  section: { gap: rs(10) },
  sectionHead: { flexDirection: 'row', alignItems: 'center', gap: rs(7) },
  sectionTitle: { fontSize: rf(15), fontFamily: 'DMSans_700Bold', color: Colors.text.primary },
  countPill: {
    paddingHorizontal: rs(8), paddingVertical: 2,
    borderRadius: Layout.radius.full,
  },
  countText: { fontSize: rf(11), fontFamily: 'DMSans_700Bold' },
  hintBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: rs(6),
    paddingHorizontal: rs(10),
    paddingVertical: rs(7),
    borderRadius: rs(10),
    backgroundColor: Colors.surfaceAlt,
  },
  sectionHint: {
    flex: 1,
    fontSize: rf(11),
    lineHeight: rf(16),
    color: Colors.text.secondary,
  },

  // Top padding leaves room for the "Next" tags that sit on the first row's edge.
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: GRID_GAP, paddingTop: rs(8) },
  card: {
    padding: rs(8),
    paddingBottom: rs(10),
    gap: rs(6),
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: rs(16),
    borderColor: Colors.borderLight,
    backgroundColor: Colors.surface,
  },

  thumbWrap: {
    width: '100%',
    borderRadius: rs(12),
    padding: rs(6),
    backgroundColor: '#F6F8F9',
  },
  thumbWrapLearned: { backgroundColor: '#EEF7F1' },
  thumb: { width: '100%', height: rs(70) },
  doneBadge: {
    position: 'absolute',
    right: rs(4), top: rs(4),
    width: rs(20), height: rs(20), borderRadius: rs(10),
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: '#3FAE6F',
    borderWidth: 2,
    borderColor: Colors.surface,
  },

  cardLabel: {
    fontSize: rf(13),
    fontFamily: 'DMSans_600SemiBold',
    color: Colors.text.primary,
    textAlign: 'center',
  },
  nextWrap: {
    position: 'absolute',
    top: rs(-9),
    left: 0,
    right: 0,
    alignItems: 'center',
    zIndex: 2,
  },
  nextPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: rs(3),
    paddingHorizontal: rs(8),
    paddingVertical: 2,
    borderRadius: Layout.radius.full,
  },
  nextText: { fontSize: rf(9), fontFamily: 'DMSans_700Bold', color: '#FFFFFF', letterSpacing: 0.4 },

  mixRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: rs(3),
    alignSelf: 'stretch',
    paddingHorizontal: rs(6),
    paddingVertical: rs(3),
    borderRadius: rs(8),
    backgroundColor: '#FDF4E3',
  },
  mixText: {
    flex: 1,
    fontSize: rf(10),
    lineHeight: rf(13),
    color: '#8A5D06',
    fontFamily: 'DMSans_600SemiBold',
  },
});
