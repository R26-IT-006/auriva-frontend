import { useEffect, useState } from 'react';
import {
  View, Text, Image, Modal, TouchableOpacity, Pressable, ScrollView, ActivityIndicator, StyleSheet,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { conceptApi } from '../../api/concept';
import { getOrderedCategories } from '../../data/conceptData';

/**
 * ConceptSummaryModal.js
 *
 * "Concept Summary" pop-up for ConceptCategoriesScreen: for every category,
 * what the child has done so far and what to do next, with the category's
 * completion badge (assets/Badges/Concept_Category_Completion) as its heading.
 *
 * Read-only. Uses the same per-category items call ConceptItemsScreen does,
 * and the same mastery rule as the server (tier 1 AND tier 2 passed).
 */

// Category key → completion badge. House Parts and Natural Environment have
// no badge artwork; they fall back to the category's tile image.
const BADGES = {
  animals:       require('../../../assets/Badges/Concept_Category_Completion/Animals.png'),
  classroom:     require('../../../assets/Badges/Concept_Category_Completion/Classroom Objects.png'),
  colors:        require('../../../assets/Badges/Concept_Category_Completion/Colours.png'),
  family:        require('../../../assets/Badges/Concept_Category_Completion/Family Members.png'),
  fruits:        require('../../../assets/Badges/Concept_Category_Completion/Fruits.png'),
  household:     require('../../../assets/Badges/Concept_Category_Completion/Household Items.png'),
  numbers:       require('../../../assets/Badges/Concept_Category_Completion/Numbers.png'),
  professionals: require('../../../assets/Badges/Concept_Category_Completion/Professionals.png'),
  shapes:        require('../../../assets/Badges/Concept_Category_Completion/Shapes.png'),
};

const isMastered = (s) => s?.tier1_status === 'passed' && s?.tier2_status === 'passed';
const isStarted  = (s) => s && (s.tier1_status !== 'not_started' || s.tier2_status !== 'not_started');

/** One category's summary from the catalogue + the server's progress rows. */
function summarise(category, serverItems) {
  const byKey = {};
  (Array.isArray(serverItems) ? serverItems : []).forEach((s) => { byKey[s.concept_key] = s; });

  // Same ordering as ConceptItemsScreen: the server's adaptive sequence first.
  const ordered = [...category.items].sort((a, b) => {
    const ai = byKey[a.key]?.sequence_index ?? category.items.indexOf(a);
    const bi = byKey[b.key]?.sequence_index ?? category.items.indexOf(b);
    return ai - bi;
  });

  const total     = ordered.length;
  const mastered  = ordered.filter((c) => isMastered(byKey[c.key]));
  const found     = ordered.filter((c) => byKey[c.key]?.tier1_status === 'passed').length;
  const named     = ordered.filter((c) => byKey[c.key]?.tier2_status === 'passed').length;
  const next      = ordered.find((c) => !isMastered(byKey[c.key])) ?? null;
  const started   = ordered.some((c) => isStarted(byKey[c.key]));

  const status = total > 0 && mastered.length === total ? 'complete'
    : started ? 'in_progress' : 'not_started';

  return { category, total, mastered, found, named, next, status };
}

const STATUS = {
  complete:    { label: 'Complete',    icon: 'checkmark-circle', fg: '#16A34A', bg: '#DCFCE7' },
  in_progress: { label: 'In progress', icon: 'time',             fg: '#B45309', bg: '#FEF3C7' },
  not_started: { label: 'Not started', icon: 'ellipse-outline',  fg: '#64748B', bg: '#F1F5F9' },
};

export default function ConceptSummaryModal({ visible, onClose, student, theme }) {
  const [loading, setLoading]   = useState(false);
  const [summary, setSummary]   = useState([]);

  useEffect(() => {
    if (!visible || !student?.sid) return undefined;
    let active = true;
    setLoading(true);
    const categories = getOrderedCategories().filter((c) => c.items.length > 0);
    Promise.allSettled(categories.map((c) => conceptApi.getConceptItems(c.key, student.sid)))
      .then((results) => {
        if (!active) return;
        setSummary(categories.map((c, i) => summarise(
          c, results[i].status === 'fulfilled' ? results[i].value : [],
        )));
      })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [visible, student?.sid]);

  const totalConcepts  = summary.reduce((n, s) => n + s.total, 0);
  const totalMastered  = summary.reduce((n, s) => n + s.mastered.length, 0);
  const pct            = totalConcepts ? Math.round((totalMastered / totalConcepts) * 100) : 0;
  // Next up: carry on with an unfinished category before opening a new one.
  const nextCategory   = summary.find((s) => s.status === 'in_progress')
    ?? summary.find((s) => s.status === 'not_started')
    ?? null;

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.overlay}>
        {/* Backdrop sits behind the card, so tapping outside closes it while
            the card itself is a plain View — a touchable wrapper would swallow
            the list's scroll gestures. */}
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} accessibilityLabel="Close" />
        <View
          style={[styles.card, { backgroundColor: theme.cardSurface, borderColor: theme.cardOutline }]}
        >
          {/* Header — same icon circle + round close as the other Progress pop-ups. */}
          <View style={styles.header}>
            <View style={styles.titleRow}>
              <View style={[styles.titleIcon, { backgroundColor: theme.cardOutline }]}>
                <Ionicons name="trophy" size={18} color="#FFF" />
              </View>
              <Text style={[styles.title, { color: theme.headingText }]}>Concept Summary</Text>
            </View>
            <TouchableOpacity
              onPress={onClose}
              style={[styles.closeBtn, { backgroundColor: theme.cardOutline + '1F' }]}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              accessibilityLabel="Close"
            >
              <Ionicons name="close" size={22} color={theme.headingText} />
            </TouchableOpacity>
          </View>

          {loading ? (
            <View style={styles.loading}>
              <ActivityIndicator size="large" color={theme.button} />
            </View>
          ) : (
            <>
              {/* Overall + what to do next */}
              <View style={[styles.overview, { borderColor: theme.cardOutline }]}>
                <View style={{ flex: 1, gap: 8 }}>
                  <Text style={[styles.overviewTitle, { color: theme.headingText }]}>
                    {totalMastered} of {totalConcepts} concepts learnt
                  </Text>
                  <View style={styles.barTrack}>
                    <View style={[styles.barFill, { width: `${pct}%`, backgroundColor: theme.button }]} />
                  </View>
                </View>
                <View style={[styles.nextBox, { backgroundColor: theme.button + '14', borderColor: theme.button + '55' }]}>
                  <Text style={[styles.nextLabel, { color: theme.button }]}>NEXT UP</Text>
                  <Text style={[styles.nextText, { color: theme.headingText }]} numberOfLines={2}>
                    {nextCategory?.next
                      ? `${nextCategory.category.label}: ${nextCategory.next.label}`
                      : 'All categories complete! 🎉'}
                  </Text>
                </View>
              </View>

              {/* flexShrink lets the list fit inside the card's maxHeight and
                  scroll, instead of growing past the bottom of the card. */}
              <ScrollView style={styles.scroll} contentContainerStyle={styles.list} showsVerticalScrollIndicator>
                {summary.map((s) => {
                  const st    = STATUS[s.status];
                  const badge = BADGES[s.category.key] ?? s.category.image;
                  return (
                    <View key={s.category.key} style={[styles.row, { borderColor: theme.cardOutline + '66' }]}>
                      {/* Category heading = its completion badge, shown in full;
                          a green tick marks it as earned. */}
                      <View style={styles.badgeWrap}>
                        <Image source={badge} style={styles.badge} resizeMode="contain" />
                        {s.status === 'complete' && (
                          <View style={styles.badgeTick}>
                            <Ionicons name="checkmark" size={14} color="#FFFFFF" />
                          </View>
                        )}
                      </View>

                      <View style={styles.rowBody}>
                        <View style={styles.rowTop}>
                          <Text style={[styles.rowTitle, { color: theme.headingText }]}>{s.category.label}</Text>
                          <View style={[styles.statusPill, { backgroundColor: st.bg }]}>
                            <Ionicons name={st.icon} size={13} color={st.fg} />
                            <Text style={[styles.statusText, { color: st.fg }]}>{st.label}</Text>
                          </View>
                        </View>

                        <View style={styles.barTrackSm}>
                          <View
                            style={[
                              styles.barFill,
                              { width: `${s.total ? (s.mastered.length / s.total) * 100 : 0}%`, backgroundColor: theme.button },
                            ]}
                          />
                        </View>

                        <Text style={[styles.doneText, { color: theme.headingText }]}>
                          <Text style={styles.strong}>Done: </Text>
                          {s.mastered.length} / {s.total} learnt · {s.found} found · {s.named} named
                        </Text>
                        <Text style={[styles.doneText, { color: theme.headingText }]} numberOfLines={1}>
                          <Text style={styles.strong}>Next: </Text>
                          {s.next ? s.next.label : 'Play the review games'}
                        </Text>
                      </View>
                    </View>
                  );
                })}
              </ScrollView>
            </>
          )}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', alignItems: 'center', justifyContent: 'center' },
  // Landing-page card frame; surface and outline come from the avatar theme.
  card: {
    width: '90%', maxWidth: 860, maxHeight: '92%',
    borderRadius: 28, borderWidth: 3,
    paddingHorizontal: 28, paddingTop: 20, paddingBottom: 24, gap: 16,
    shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.1, shadowRadius: 10, elevation: 4,
  },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  titleIcon: {
    width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center',
    shadowColor: '#000', shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.15, shadowRadius: 5, elevation: 3,
  },
  title: { fontSize: 24, fontFamily: 'DMSans_800ExtraBold', letterSpacing: -0.3 },
  closeBtn: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  loading: { paddingVertical: 60, alignItems: 'center' },

  overview: {
    flexDirection: 'row', alignItems: 'center', gap: 18,
    backgroundColor: '#FFFFFF', borderRadius: 20, borderWidth: 2,
    paddingHorizontal: 18, paddingVertical: 14,
  },
  overviewTitle: { fontSize: 18, fontFamily: 'DMSans_800ExtraBold' },
  barTrack: { height: 12, borderRadius: 6, backgroundColor: 'rgba(0,0,0,0.08)', overflow: 'hidden' },
  barTrackSm: { height: 8, borderRadius: 4, backgroundColor: 'rgba(0,0,0,0.08)', overflow: 'hidden', marginVertical: 2 },
  barFill: { height: '100%', borderRadius: 6 },
  nextBox: { width: 230, borderRadius: 16, borderWidth: 1.5, paddingHorizontal: 14, paddingVertical: 10, gap: 2 },
  nextLabel: { fontSize: 11, fontFamily: 'DMSans_800ExtraBold', letterSpacing: 1 },
  nextText: { fontSize: 15, fontFamily: 'DMSans_800ExtraBold' },

  scroll: { flexShrink: 1 },
  list: { gap: 12, paddingBottom: 4 },
  row: {
    flexDirection: 'row', alignItems: 'center', gap: 16,
    backgroundColor: '#FFFFFF', borderRadius: 20, borderWidth: 2,
    paddingHorizontal: 14, paddingVertical: 12,
  },
  badgeWrap: { width: 84, height: 84 },
  badge: { width: 84, height: 84 },
  badgeTick: {
    position: 'absolute', right: -2, bottom: -2,
    width: 26, height: 26, borderRadius: 13,
    backgroundColor: '#22C55E', borderWidth: 2, borderColor: '#FFFFFF',
    alignItems: 'center', justifyContent: 'center',
  },
  rowBody: { flex: 1, gap: 4 },
  rowTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
  rowTitle: { fontSize: 18, fontFamily: 'DMSans_800ExtraBold', flexShrink: 1 },
  statusPill: { flexDirection: 'row', alignItems: 'center', gap: 4, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4 },
  statusText: { fontSize: 12, fontFamily: 'DMSans_800ExtraBold' },
  doneText: { fontSize: 14, fontFamily: 'DMSans_600SemiBold', opacity: 0.8 },
  strong: { fontFamily: 'DMSans_800ExtraBold' },
});
