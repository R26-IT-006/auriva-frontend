import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  Image,
  ScrollView,
  StyleSheet,
  RefreshControl,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { Avatar } from '../../../components/common/Avatar';
import { Badge } from '../../../components/common/Badge';
import { Card } from '../../../components/common/Card';
import { MasteryRing } from '../../../components/charts/MasteryRing';
import { TierBar, TierLegend } from '../../../components/charts/TierBar';
import { Colors } from '../../../constants/colors';
import { Layout } from '../../../constants/layout';
import { teacherApi } from '../../../api/teacher';
import { conceptApi } from '../../../api/concept';
import { formatDate, ageFrom } from '../../../utils/formatters';
import { getConceptItem } from '../../../data/conceptData';

function InfoRow({ icon, label, value }) {
  if (!value) return null;
  return (
    <View style={styles.infoRow}>
      <View style={styles.infoIcon}>
        <Ionicons name={icon} size={15} color={Colors.icon.active} />
      </View>
      <View style={styles.infoContent}>
        <Text style={styles.infoLabel}>{label}</Text>
        <Text style={styles.infoValue}>{value}</Text>
      </View>
    </View>
  );
}

function StatLine({ label, value }) {
  return (
    <View style={styles.statLine}>
      <Text style={styles.statLabel}>{label}</Text>
      <Text style={styles.statValue}>{value}</Text>
    </View>
  );
}

function SectionHeader({ icon, title, action, onAction }) {
  return (
    <View style={styles.sectionHeader}>
      <View style={styles.sectionIcon}>
        <Ionicons name={icon} size={13} color={Colors.text.link} />
      </View>
      <Text style={styles.sectionTitle}>{title}</Text>
      {action ? (
        <TouchableOpacity onPress={onAction} activeOpacity={0.7}>
          <Text style={styles.sectionAction}>{action}</Text>
        </TouchableOpacity>
      ) : null}
    </View>
  );
}

// Only Concept Learning reports progress today; the rest render an unavailable
// panel until those modules ship, so the selector stays honest about coverage.
const MODULES = [
  { key: 'concept',       tab: 'Concepts',      title: 'Concept Learning',     icon: 'school-outline' },
  { key: 'writing',       tab: 'Writing',       title: 'Writing Module',       icon: 'create-outline' },
  { key: 'pronunciation', tab: 'Pronunciation', title: 'Pronunciation Module', icon: 'mic-outline' },
  { key: 'dialogue',      tab: 'Dialogue',      title: 'Dialogue Module',      icon: 'chatbubbles-outline' },
];

export default function TeacherStudentDetailScreen({ route, navigation }) {
  const initialStudent = route.params?.student;
  const [student, setStudent] = useState(initialStudent);
  const [refreshing, setRefreshing] = useState(false);
  const [concepts, setConcepts] = useState(null);
  const [conceptsLoading, setConceptsLoading] = useState(true);
  const [activeModule, setActiveModule] = useState('concept');
  const [artworks, setArtworks] = useState([]);

  const fetch = useCallback(async () => {
    if (!initialStudent?.sid) { setRefreshing(false); return; }
    try {
      const s = await teacherApi.getStudent(initialStudent.sid);
      setStudent(s);
    } catch {
      // Use cached
    } finally {
      setRefreshing(false);
    }
  }, [initialStudent?.sid]);

  const fetchConcepts = useCallback(async () => {
    if (!initialStudent?.sid) return;
    try {
      setConcepts(await teacherApi.getConceptSummary(initialStudent.sid));
    } catch {
      setConcepts(null); // section renders an inline error rather than blanking
    } finally {
      setConceptsLoading(false);
    }
  }, [initialStudent?.sid]);

  const fetchArtworks = useCallback(async () => {
    if (!initialStudent?.sid) return;
    try {
      setArtworks(await conceptApi.listColoring({ studentId: initialStudent.sid }));
    } catch {
      setArtworks([]); // the section simply doesn't render
    }
  }, [initialStudent?.sid]);

  useEffect(() => { fetch(); }, [fetch]);

  // Refetch on focus so returning from the report reflects a session just played.
  useFocusEffect(useCallback(() => {
    fetchConcepts();
    fetchArtworks();
  }, [fetchConcepts, fetchArtworks]));

  if (!student) return null;

  // Categories the child has actually touched — showing all nine when eight are
  // empty buries the signal.
  const activeCategories = (concepts?.categories || []).filter((c) => c.started > 0);
  const needsAttention = (concepts?.categories || [])
    .reduce((n, c) => n + c.needs_attention.length, 0);
  const age = ageFrom(student.date_of_birth);
  const activeMeta = MODULES.find((m) => m.key === activeModule) ?? MODULES[0];
  const firstName  = student.full_name.split(' ')[0];

  return (
    <SafeAreaView style={styles.safe} edges={['bottom']}>
      <ScrollView
        contentContainerStyle={styles.scroll}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetch(); }} />}
        showsVerticalScrollIndicator={false}
      >
        {/* Hero */}
        <LinearGradient
          colors={Colors.primaryGradient}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.hero}
        >
          <View style={styles.avatarRing}>
            <Avatar name={student.full_name} uri={student.profile_photo_url} size={72} />
          </View>

          <View style={styles.heroMeta}>
            <Text style={styles.heroName} numberOfLines={2}>{student.full_name}</Text>
            <View style={styles.heroChips}>
              {student.student_code ? (
                <View style={styles.heroChip}>
                  <Ionicons name="card-outline" size={11} color="#FFFFFF" />
                  <Text style={styles.heroChipText}>{student.student_code}</Text>
                </View>
              ) : null}
              {age != null ? (
                <View style={styles.heroChip}>
                  <Ionicons name="balloon-outline" size={11} color="#FFFFFF" />
                  <Text style={styles.heroChipText}>{age} years old</Text>
                </View>
              ) : null}
              {student.disability ? (
                <View style={styles.heroChip}>
                  <Text style={styles.heroChipText} numberOfLines={1}>{student.disability}</Text>
                </View>
              ) : null}
            </View>
          </View>
        </LinearGradient>

        {/* Personal Info */}
        <SectionHeader icon="person-outline" title="Student Information" />
        <Card style={styles.infoCard} padding="none">
          <InfoRow icon="calendar-outline" label="Date of Birth" value={formatDate(student.date_of_birth)} />
          <View style={styles.divider} />
          <InfoRow icon="medical-outline" label="Disability" value={student.disability} />
          {student.address && <View style={styles.divider} />}
          <InfoRow icon="home-outline" label="Address" value={student.address} />
        </Card>

        {/* Contact */}
        {(student.father_name || student.mother_name || student.mobile_number || student.home_number) && (
          <>
            <SectionHeader icon="call-outline" title="Contact Information" />
            <Card style={styles.infoCard} padding="none">
              <InfoRow icon="person-outline" label="Father's Name" value={student.father_name} />
              {student.mother_name && <View style={styles.divider} />}
              <InfoRow icon="person-outline" label="Mother's Name" value={student.mother_name} />
              {student.mobile_number && <View style={styles.divider} />}
              <InfoRow icon="phone-portrait-outline" label="Mobile" value={student.mobile_number} />
              {student.home_number && <View style={styles.divider} />}
              <InfoRow icon="call-outline" label="Home" value={student.home_number} />
            </Card>
          </>
        )}

        {/* Module progress */}
        <SectionHeader
          icon="stats-chart-outline"
          title="Module Progress"
          action={activeModule === 'concept' && concepts && concepts.totals.started > 0 ? 'Report' : null}
          onAction={() => navigation.navigate('ConceptReport', { student })}
        />

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.moduleTabs}
        >
          {MODULES.map((m) => {
            const active = m.key === activeModule;
            return (
              <TouchableOpacity
                key={m.key}
                onPress={() => setActiveModule(m.key)}
                activeOpacity={0.8}
                accessibilityRole="tab"
                accessibilityState={{ selected: active }}
                style={[styles.moduleTab, active && styles.moduleTabActive]}
              >
                <Ionicons
                  name={m.icon}
                  size={15}
                  color={active ? '#FFFFFF' : Colors.text.muted}
                />
                <Text style={[styles.moduleTabText, active && styles.moduleTabTextActive]}>
                  {m.tab}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        <Card style={styles.infoCard} padding="none">
          {activeModule !== 'concept' ? (
            <View style={styles.conceptEmpty}>
              <Ionicons name={activeMeta.icon} size={22} color={Colors.text.muted} />
              <Text style={styles.conceptEmptyText}>
                {activeMeta.title} isn't available yet. {firstName}'s progress will
                appear here once the module is released.
              </Text>
            </View>
          ) : conceptsLoading ? (
            <View style={styles.conceptLoading}>
              <ActivityIndicator color={Colors.icon.active} />
            </View>
          ) : !concepts ? (
            <View style={styles.conceptEmpty}>
              <Ionicons name="cloud-offline-outline" size={22} color={Colors.text.muted} />
              <Text style={styles.conceptEmptyText}>Couldn't load concept progress.</Text>
              <TouchableOpacity onPress={() => { setConceptsLoading(true); fetchConcepts(); }}>
                <Text style={styles.retryText}>Retry</Text>
              </TouchableOpacity>
            </View>
          ) : concepts.totals.started === 0 ? (
            <View style={styles.conceptEmpty}>
              <Ionicons name="school-outline" size={22} color={Colors.text.muted} />
              <Text style={styles.conceptEmptyText}>
                No concept activity yet. Progress appears here once {student.full_name.split(' ')[0]} starts a session.
              </Text>
            </View>
          ) : (
            <>
              <View style={styles.conceptHeader}>
                <MasteryRing value={concepts.totals.mastery_pct} size={92} label="mastery" />
                <View style={styles.conceptStats}>
                  <StatLine
                    label="Mastered"
                    value={`${concepts.totals.mastered} / ${concepts.totals.catalogue_concepts}`}
                  />
                  <StatLine label="Started" value={String(concepts.totals.started)} />
                  <StatLine label="Identified" value={String(concepts.totals.tier1_passed)} />
                  <StatLine label="Needs work" value={String(needsAttention)} />
                </View>
              </View>

              <View style={styles.divider} />

              <View style={styles.categoryBlock}>
                {activeCategories.map((c) => (
                  <TierBar
                    key={c.category_key}
                    label={c.label}
                    total={c.total}
                    tier1={c.tier1_passed}
                    tier2={c.tier2_passed}
                    tier3={c.tier3_passed}
                    right={`${c.mastered}/${c.total}`}
                  />
                ))}
                <TierLegend />
              </View>

              <TouchableOpacity
                style={styles.reportLink}
                activeOpacity={0.7}
                onPress={() => navigation.navigate('ConceptReport', { student })}
              >
                <Text style={styles.reportLinkText}>View full report</Text>
                <Ionicons name="chevron-forward" size={16} color={Colors.text.link} />
              </TouchableOpacity>
            </>
          )}
        </Card>

        {/* Colouring artwork — only appears once the child has coloured something */}
        {artworks.length > 0 && (
          <>
            <SectionHeader icon="color-palette-outline" title="Colouring Artwork" />
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.artworkRow}
            >
              {artworks.map((art) => {
                const concept = getConceptItem(art.category_key, art.concept_key);
                return (
                  <View key={art.id} style={styles.artworkCard}>
                    <Image
                      source={{ uri: art.image_url }}
                      style={styles.artworkImage}
                      resizeMode="cover"
                    />
                    <Text style={styles.artworkLabel} numberOfLines={1}>
                      {concept?.label ?? art.concept_key}
                    </Text>
                    <Text style={styles.artworkDate}>{formatDate(art.created_at)}</Text>
                  </View>
                );
              })}
            </ScrollView>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.background },
  scroll: { padding: Layout.spacing.lg, paddingBottom: Layout.spacing.xxl },
  // ── Hero ──────────────────────────────────────────────────────────────────
  hero: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: Layout.radius.xl,
    padding: Layout.spacing.lg,
    marginBottom: Layout.spacing.lg,
    ...Layout.shadow.md,
  },
  avatarRing: {
    width: 84,
    height: 84,
    borderRadius: 42,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.28)',
  },
  heroMeta:  { flex: 1, marginLeft: Layout.spacing.lg },
  heroName:  {
    fontSize: Layout.fontSize.xl,
    fontFamily: 'DMSans_800ExtraBold',
    color: '#FFFFFF',
    lineHeight: Layout.fontSize.xl * 1.25,
  },
  heroChips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 8 },
  heroChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: Layout.radius.full,
    backgroundColor: 'rgba(255,255,255,0.22)',
  },
  heroChipText: {
    fontSize: Layout.fontSize.xs,
    color: '#FFFFFF',
    fontFamily: 'DMSans_700Bold',
    maxWidth: 150,
  },

  // ── Colouring artwork ─────────────────────────────────────────────────────
  artworkRow: {
    gap: Layout.spacing.sm,
    paddingHorizontal: Layout.spacing.md,
    paddingBottom: Layout.spacing.sm,
  },
  artworkCard: {
    width: 132,
    backgroundColor: Colors.surface,
    borderRadius: Layout.radius.lg,
    borderWidth: 1,
    borderColor: Colors.borderLight,
    padding: 8,
    ...Layout.shadow.sm,
  },
  artworkImage: {
    width: '100%',
    height: 116,
    borderRadius: Layout.radius.md,
    backgroundColor: Colors.surfaceAlt,
  },
  artworkLabel: {
    fontSize: Layout.fontSize.sm,
    fontFamily: 'DMSans_700Bold',
    color: Colors.text.primary,
    marginTop: 6,
  },
  artworkDate: {
    fontSize: Layout.fontSize.xs,
    color: Colors.text.muted,
    marginTop: 1,
  },

  // ── Section headers ───────────────────────────────────────────────────────
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Layout.spacing.sm,
    marginBottom: Layout.spacing.sm,
    marginTop: Layout.spacing.xs,
  },
  sectionIcon: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: Colors.status.infoLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sectionTitle: {
    flex: 1,
    fontSize: Layout.fontSize.md,
    fontFamily: 'DMSans_700Bold',
    color: Colors.text.primary,
  },
  sectionAction: {
    fontSize: Layout.fontSize.xs,
    color: Colors.text.link,
    fontFamily: 'DMSans_700Bold',
  },
  infoCard: { marginBottom: Layout.spacing.md },
  infoRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: Layout.spacing.sm, paddingHorizontal: Layout.spacing.md },
  infoIcon: { width: 30, height: 30, borderRadius: 15, backgroundColor: Colors.status.infoLight, alignItems: 'center', justifyContent: 'center', marginRight: Layout.spacing.sm },
  infoContent: { flex: 1 },
  infoLabel: { fontSize: Layout.fontSize.xs, color: Colors.text.muted, marginBottom: 2 },
  infoValue: { fontSize: Layout.fontSize.sm, color: Colors.text.primary, fontFamily: 'DMSans_600SemiBold' },
  divider: { height: 1, backgroundColor: Colors.divider, marginLeft: 58 },

  // ── Module selector ───────────────────────────────────────────────────────
  moduleTabs: {
    gap: Layout.spacing.sm,
    paddingBottom: Layout.spacing.sm,
    paddingRight: Layout.spacing.md,
  },
  moduleTab: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: Layout.spacing.md,
    paddingVertical: Layout.spacing.sm,
    borderRadius: Layout.radius.full,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.borderLight,
  },
  moduleTabActive: {
    backgroundColor: Colors.text.link,
    borderColor: Colors.text.link,
  },
  moduleTabText: {
    fontSize: Layout.fontSize.sm,
    fontFamily: 'DMSans_700Bold',
    color: Colors.text.secondary,
  },
  moduleTabTextActive: { color: '#FFFFFF' },

  // ── Concept Learning ──────────────────────────────────────────────────────
  conceptLoading: { paddingVertical: Layout.spacing.xl, alignItems: 'center' },
  conceptEmpty: {
    paddingVertical: Layout.spacing.lg,
    paddingHorizontal: Layout.spacing.md,
    alignItems: 'center',
    gap: Layout.spacing.sm,
  },
  conceptEmptyText: {
    fontSize: Layout.fontSize.sm,
    color: Colors.text.secondary,
    textAlign: 'center',
  },
  retryText: {
    fontSize: Layout.fontSize.sm,
    color: Colors.text.link,
    fontFamily: 'DMSans_700Bold',
  },
  conceptHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: Layout.spacing.md,
    gap: Layout.spacing.lg,
  },
  conceptStats: { flex: 1, gap: 6 },
  statLine: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  statLabel: { fontSize: Layout.fontSize.xs, color: Colors.text.muted },
  statValue: {
    fontSize: Layout.fontSize.sm,
    color: Colors.text.primary,
    fontFamily: 'DMSans_700Bold',
  },
  categoryBlock: {
    paddingHorizontal: Layout.spacing.md,
    paddingVertical: Layout.spacing.md,
    gap: Layout.spacing.sm,
  },
  reportLink: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Layout.spacing.md,
    paddingVertical: Layout.spacing.md,
    borderTopWidth: 1,
    borderTopColor: Colors.divider,
  },
  reportLinkText: {
    fontSize: Layout.fontSize.sm,
    color: Colors.text.link,
    fontFamily: 'DMSans_700Bold',
  },
});
