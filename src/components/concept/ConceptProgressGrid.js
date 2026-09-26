import { useState, useCallback } from 'react';
import { View, Text, Image, StyleSheet, ActivityIndicator } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../../constants/colors';
import { Layout } from '../../constants/layout';
import { getConceptItemsForCategory, categoryHasVideo } from '../../data/conceptData';
import { conceptApi } from '../../api/concept';
import { ROUND } from '../../constants/teacherWording';

/**
 * One category's concepts, each with where the child has reached.
 *
 * Lifted out of StudentConceptProgressScreen so the teacher's profile page can
 * show the same thing without navigating away. That screen owns a header, a theme
 * and a back button; this owns only the grid, which is the part worth reusing.
 *
 * Fetches its own items rather than taking them as a prop: the caller would
 * otherwise have to hold one request per category and keep them in sync with
 * whichever is on screen.
 */

const S_COLOR = {
  passed:      '#2A7146',
  in_progress: '#945D08',
  failed:      '#C0392B',
  not_started: '#9AA5B1',
  locked:      '#C7CDD6',
};
const S_BG = {
  passed:      '#E6F4EA',
  in_progress: '#FAF0DF',
  failed:      '#FBEAE8',
  not_started: '#F3F5F8',
  locked:      '#F3F5F8',
};
const S_ICON = {
  passed:      'checkmark-circle',
  in_progress: 'time-outline',
  failed:      'close-circle',
  not_started: 'ellipse-outline',
  locked:      'lock-closed-outline',
};

// Short enough to sit three-across on a card, and named after what the child does
// rather than the tier number — the same words the rest of the report uses.
const PILL_LABEL = {
  tier1: 'Pic',
  tier2: 'Word',
  tier3: 'Video',
};

function TierPill({ tier, status }) {
  const color = S_COLOR[status] ?? S_COLOR.not_started;
  const bg    = S_BG[status]    ?? S_BG.not_started;
  return (
    <View style={[styles.tierPill, { backgroundColor: bg, borderColor: color + '55' }]}>
      <Ionicons name={S_ICON[status] ?? 'ellipse-outline'} size={9} color={color} />
      <Text style={[styles.tierPillLabel, { color }]}>{PILL_LABEL[tier]}</Text>
    </View>
  );
}

function ConceptCard({ item, width, showTier3 }) {
  // A later round is only meaningful once the one before it is passed, so an
  // untouched tier 2 on a concept whose tier 1 is unfinished shows as locked
  // rather than as "not started" — the child was never offered it.
  const t2 = item.tier1_status === 'passed' ? item.tier2_status : 'locked';
  const t3 = item.tier2_status === 'passed' ? item.tier3_status : 'locked';

  const done = showTier3 ? item.tier3_status === 'passed' : item.tier2_status === 'passed';
  const accent = done ? '#2A7146'
    : item.tier1_status === 'passed' ? '#57B183'
    : item.tier1_status === 'in_progress' ? '#E0A030'
    : '#DDE3EA';

  return (
    <View style={[styles.card, { width, borderTopColor: accent }]}>
      {item.is_priority && (
        <View style={styles.priorityBadge}>
          <Ionicons name="star" size={10} color="#D32F2F" />
        </View>
      )}

      <View style={styles.cardImageBox}>
        <Image source={item.icon ?? item.real} style={styles.cardImage} resizeMode="contain" />
      </View>

      <Text style={styles.cardName} numberOfLines={1}>{item.label}</Text>

      <View style={styles.pillRow}>
        <TierPill tier="tier1" status={item.tier1_status} />
        <TierPill tier="tier2" status={t2} />
        {showTier3 && <TierPill tier="tier3" status={t3} />}
      </View>
    </View>
  );
}

export function ConceptProgressGrid({ studentId, categoryKey, width }) {
  const [items, setItems]     = useState([]);
  const [loading, setLoading] = useState(true);

  // Refetched on focus so a session played from this profile is reflected on the
  // way back, matching how the rest of the profile behaves.
  useFocusEffect(
    useCallback(() => {
      let active = true;
      setLoading(true);
      conceptApi.getConceptItems(categoryKey, studentId)
        .then((rows) => { if (active) setItems(rows); })
        .catch(() => { if (active) setItems([]); })
        .finally(() => { if (active) setLoading(false); });
      return () => { active = false; };
    }, [categoryKey, studentId]),
  );

  const local = getConceptItemsForCategory(categoryKey);
  const showTier3 = categoryHasVideo(categoryKey);

  if (loading) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator size="small" color={Colors.icon.active} />
      </View>
    );
  }

  // Server order is the adaptive order — a concept moved up because the child
  // muddled it should appear where the child will meet it, not alphabetically.
  const byKey = new Map(local.map((i) => [i.key, i]));
  const merged = (items.length ? items : local.map((i) => ({ concept_key: i.key })))
    .map((row) => {
      const art = byKey.get(row.concept_key);
      return art ? { ...art, ...row } : null;
    })
    .filter(Boolean);

  if (merged.length === 0) {
    return <Text style={styles.empty}>Nothing recorded in this group yet.</Text>;
  }

  // Sized from the pane rather than a fixed column count so the grid keeps
  // filling its row at any width the profile gives it.
  const GAP = 10;
  const cols = Math.max(2, Math.min(6, Math.floor((width + GAP) / (104 + GAP))));
  const cardW = Math.floor((width - GAP * (cols - 1)) / cols);

  return (
    <View>
      <View style={[styles.grid, { gap: GAP }]}>
        {merged.map((item) => (
          <ConceptCard key={item.concept_key} item={item} width={cardW} showTier3={showTier3} />
        ))}
      </View>

      <View style={styles.legend}>
        {['tier1', 'tier2', ...(showTier3 ? ['tier3'] : [])].map((t) => (
          <View key={t} style={styles.legendItem}>
            <View style={[styles.legendPill, { backgroundColor: S_BG.passed, borderColor: S_COLOR.passed + '55' }]}>
              <Text style={[styles.tierPillLabel, { color: S_COLOR.passed }]}>{PILL_LABEL[t]}</Text>
            </View>
            <Text style={styles.legendText}>{ROUND[t].label}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  loading: { paddingVertical: Layout.spacing.xl, alignItems: 'center' },
  empty:   { fontSize: Layout.fontSize.sm, color: Colors.text.muted, paddingVertical: Layout.spacing.md },

  grid: { flexDirection: 'row', flexWrap: 'wrap' },

  card: {
    backgroundColor: Colors.surface,
    borderRadius: Layout.radius.md,
    borderWidth: 1,
    borderColor: Colors.borderLight,
    // The accent rides the top edge, so the state of a card is readable down a
    // column of them without reading any of the pills.
    borderTopWidth: 3,
    paddingVertical: 8,
    paddingHorizontal: 6,
    alignItems: 'center',
    gap: 5,
  },
  priorityBadge: { position: 'absolute', top: 4, right: 5 },

  cardImageBox: {
    width: 40, height: 40,
    alignItems: 'center', justifyContent: 'center',
  },
  cardImage: { width: '100%', height: '100%' },

  cardName: {
    fontSize: 11,
    fontFamily: 'DMSans_700Bold',
    color: Colors.text.primary,
    textAlign: 'center',
  },

  pillRow: { flexDirection: 'row', gap: 3, flexWrap: 'wrap', justifyContent: 'center' },
  tierPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    paddingHorizontal: 4,
    paddingVertical: 2,
    borderRadius: 6,
    borderWidth: 1,
  },
  tierPillLabel: { fontSize: 8, fontFamily: 'DMSans_700Bold' },

  legend: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Layout.spacing.md,
    marginTop: Layout.spacing.md,
  },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  legendPill: { paddingHorizontal: 4, paddingVertical: 2, borderRadius: 6, borderWidth: 1 },
  legendText: { fontSize: 10, color: Colors.text.secondary },
});
