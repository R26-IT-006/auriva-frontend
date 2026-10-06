import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  ScrollView,
  RefreshControl,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Avatar } from '../../../components/common/Avatar';
import { principalApi } from '../../../api/principal';
import { ageFrom } from '../../../utils/formatters';
import { useThemeMode, useThemedStyles } from '../../../context/ThemeModeContext';

const GREEN  = '#3EBF78';
const PURPLE = '#7B68C8';

// One band colour per student, picked from their name so it never changes.
const BANDS = ['#3EBF78', '#4A8FD8', '#7B68C8', '#F0A940', '#D95F50', '#2F9AA8'];
function bandFor(name) {
  let h = 0;
  for (const ch of String(name || '')) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return BANDS[h % BANDS.length];
}

function InfoRow({ icon, color, text, muted, styles }) {
  return (
    <View style={styles.infoRow}>
      <View style={[styles.infoIcon, { backgroundColor: color + '1F' }]}>
        <Ionicons name={icon} size={13} color={color} />
      </View>
      <Text style={[styles.infoText, muted && styles.infoMuted]} numberOfLines={1}>{text}</Text>
    </View>
  );
}

/**
 * Reports — every student as a profile card. Selecting one opens that
 * student's Student Profile from the teacher workspace, in its principal
 * (read-only) view, registered in this tab's own stack so Back returns here.
 */
export default function ReportsScreen({ navigation }) {
  const insets = useSafeAreaInsets();
  const { palette } = useThemeMode();
  const styles = useThemedStyles(makeStyles);

  const [students, setStudents]     = useState([]);
  const [loading, setLoading]       = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [failed, setFailed]         = useState(false);
  const [search, setSearch]         = useState('');
  const [gridW, setGridW]           = useState(0);
  // Three cards across when each keeps ~230pt, otherwise two.
  const cols = gridW >= 3 * 230 + 2 * 16 ? 3 : 2;
  const cardW = gridW ? Math.floor((gridW - 16 * (cols - 1)) / cols) : undefined;

  const load = useCallback(async () => {
    try {
      setFailed(false);
      const data = await principalApi.getStudents();
      setStudents(Array.isArray(data) ? data : (data?.students ?? []));
    } catch {
      setFailed(true);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    load();
    // Refresh on return, so an edit made from the details page shows here.
    const unsub = navigation.addListener('focus', load);
    return unsub;
  }, [load, navigation]);

  const shown = useMemo(() => {
    const q = search.trim().toLowerCase();
    const list = [...students].sort((a, b) => String(a.full_name).localeCompare(String(b.full_name)));
    if (!q) return list;
    return list.filter((s) =>
      [s.full_name, s.student_code, s.teacher?.full_name].some((v) => v?.toLowerCase().includes(q)));
  }, [students, search]);

  return (
    <SafeAreaView style={styles.safe} edges={['bottom']}>
      <View style={[styles.topBar, { paddingTop: insets.top + 14 }]}>
        <View style={styles.titleRow}>
          <View style={styles.sectionBar} />
          <Text style={styles.pageTitle}>Reports</Text>
          <View style={styles.countBadge}>
            <Text style={styles.countText}>{students.length}</Text>
          </View>
        </View>
        <Text style={styles.pageSub}>Select a student to open their profile.</Text>
      </View>

      <View style={styles.searchWrap}>
        <View style={styles.searchBox}>
          <Ionicons name="search-outline" size={16} color={palette.muted} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search name, ID or teacher…"
            placeholderTextColor={palette.muted}
            value={search}
            onChangeText={setSearch}
            autoCapitalize="none"
          />
          {search ? (
            <TouchableOpacity onPress={() => setSearch('')} activeOpacity={0.7} hitSlop={8}>
              <Ionicons name="close-circle" size={16} color={palette.muted} />
            </TouchableOpacity>
          ) : null}
        </View>
      </View>

      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} tintColor={GREEN} />
        }
      >
        {loading ? (
          <View style={styles.centre}><ActivityIndicator color={GREEN} /></View>
        ) : failed ? (
          <View style={styles.centre}>
            <Ionicons name="cloud-offline-outline" size={26} color={palette.muted} />
            <Text style={styles.centreText}>Couldn&apos;t load students.</Text>
            <TouchableOpacity onPress={() => { setLoading(true); load(); }} activeOpacity={0.7}>
              <Text style={styles.retry}>Try again</Text>
            </TouchableOpacity>
          </View>
        ) : shown.length === 0 ? (
          <View style={styles.centre}>
            <Ionicons name="school-outline" size={26} color={palette.muted} />
            <Text style={styles.centreText}>
              {search ? 'No students match your search.' : 'No students yet.'}
            </Text>
          </View>
        ) : (
          <View style={styles.grid} onLayout={(e) => setGridW(e.nativeEvent.layout.width)}>
            {shown.map((s) => {
              const band = bandFor(s.full_name);
              const age = ageFrom(s.date_of_birth);
              return (
                <TouchableOpacity
                  key={s.sid}
                  style={[styles.card, cardW ? { width: cardW } : null]}
                  activeOpacity={0.85}
                  onPress={() => navigation.navigate('ReportStudentDetail', { student: s, viewer: 'principal' })}
                  accessibilityRole="button"
                  accessibilityLabel={`${s.full_name}. Open profile`}
                >
                  <View style={[styles.band, { backgroundColor: band + '2E' }]}>
                    <View style={[styles.bandDot, { backgroundColor: band }]} />
                  </View>
                  <View style={styles.avatarRing}>
                    <Avatar name={s.full_name} uri={s.profile_photo_url} size={64} />
                  </View>

                  <View style={styles.cardBody}>
                    <Text style={styles.name} numberOfLines={1}>{s.full_name}</Text>
                    {s.student_code ? (
                      <View style={[styles.codeChip, { backgroundColor: band + '1F' }]}>
                        <Text style={[styles.code, { color: band }]}>{s.student_code}</Text>
                      </View>
                    ) : null}

                    <View style={styles.infoList}>
                      <InfoRow
                        styles={styles}
                        icon="calendar-outline"
                        color="#4A8FD8"
                        text={age != null ? `${age} years old` : 'Age not recorded'}
                        muted={age == null}
                      />
                      <InfoRow
                        styles={styles}
                        icon="person-outline"
                        color={PURPLE}
                        text={s.teacher?.full_name ?? 'Unassigned'}
                        muted={!s.teacher}
                      />
                      {s.disability ? (
                        <InfoRow styles={styles} icon="pulse-outline" color="#D95F50" text={s.disability} />
                      ) : null}
                    </View>
                  </View>

                  <View style={styles.cardFoot}>
                    <Text style={styles.footText}>View profile</Text>
                    <Ionicons name="arrow-forward" size={15} color={GREEN} />
                  </View>
                </TouchableOpacity>
              );
            })}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const makeStyles = (p) => ({
  safe: { flex: 1, backgroundColor: p.background },

  topBar: { backgroundColor: p.surface, paddingHorizontal: 24, paddingBottom: 16, gap: 4 },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  sectionBar: { width: 4, height: 22, borderRadius: 2, backgroundColor: GREEN },
  pageTitle: { fontSize: 22, fontFamily: 'DMSans_800ExtraBold', color: p.text },
  countBadge: { paddingHorizontal: 9, paddingVertical: 2, borderRadius: 10, backgroundColor: GREEN + '22' },
  countText: { fontSize: 12, fontFamily: 'DMSans_700Bold', color: GREEN },
  pageSub: { fontSize: 13, color: p.muted, marginLeft: 14 },

  searchWrap: { paddingHorizontal: 24, paddingTop: 16 },
  searchBox: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: p.surface, borderRadius: 12, borderWidth: 1, borderColor: p.border,
    paddingHorizontal: 14, height: 44,
  },
  searchInput: { flex: 1, fontSize: 14, color: p.text, fontFamily: 'DMSans_400Regular' },

  scroll: { padding: 24, paddingTop: 16, paddingBottom: 40 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 16 },
  card: {
    flexGrow: 0,
    backgroundColor: p.surface,
    borderRadius: 20,
    borderWidth: 1, borderColor: p.border,
    overflow: 'hidden',
    shadowColor: p.shadow, shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.06, shadowRadius: 8, elevation: 2,
  },
  band: { height: 56, alignItems: 'flex-end', padding: 12 },
  bandDot: { width: 8, height: 8, borderRadius: 4 },
  avatarRing: {
    alignSelf: 'center', marginTop: -36,
    padding: 4, borderRadius: 40, backgroundColor: p.surface,
  },
  cardBody: { alignItems: 'center', paddingHorizontal: 16, paddingTop: 8, gap: 6 },
  name: { fontSize: 17, fontFamily: 'DMSans_700Bold', color: p.text, textAlign: 'center' },
  codeChip: { paddingHorizontal: 10, paddingVertical: 3, borderRadius: 10 },
  code: { fontSize: 11, fontFamily: 'DMSans_700Bold', letterSpacing: 0.6 },
  infoList: { alignSelf: 'stretch', gap: 8, marginTop: 10 },
  infoRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  infoIcon: { width: 26, height: 26, borderRadius: 13, alignItems: 'center', justifyContent: 'center' },
  infoText: { flex: 1, fontSize: 13, color: p.text },
  infoMuted: { color: p.muted, fontStyle: 'italic' },
  cardFoot: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    marginTop: 16, paddingVertical: 12,
    borderTopWidth: 1, borderTopColor: p.border,
  },
  footText: { fontSize: 13, fontFamily: 'DMSans_700Bold', color: GREEN },

  centre: { alignItems: 'center', gap: 8, paddingVertical: 60 },
  centreText: { fontSize: 14, color: p.muted },
  retry: { fontSize: 14, color: GREEN, fontFamily: 'DMSans_700Bold' },
});
