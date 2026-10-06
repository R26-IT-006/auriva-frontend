import {
  Modal,
  Pressable,
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../../constants/colors';
import { Layout } from '../../constants/layout';
import { rs, rf } from '../../utils/responsive';

/**
 * One pronunciation category's summary, opened from a card in the Student
 * Profile's Pronunciation tab — the counterpart of StrokeFamilyModal.
 *
 * Everything shown is already in the group built by
 * utils/pronunciationModuleSummary.js from the recent attempts the tab loaded.
 * No request is made here and nothing is written; per-attempt detail and audio
 * stay in the Sessions screen, which the footer link opens.
 */
export function PronunciationCategoryModal({ group, face, unit = 'words', onClose, onOpenSessions }) {
  const visible = !!group;
  const words = group?.words || [];
  const notYet = group?.notYet || [];
  const sounds = group?.sounds || [];
  const fg = face?.fg || Colors.brandDeep;
  const bg = face?.bg || '#E4F4EC';
  const change = group?.latestScore != null && group?.firstScore != null && group.attempts > 1
    ? group.latestScore - group.firstScore
    : null;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      statusBarTranslucent
      onRequestClose={onClose}
    >
      <View style={styles.backdrop}>
        {/* A sibling Pressable rather than a wrapper, so a drag inside the card
            reaches the ScrollView instead of being swallowed as a tap. */}
        <Pressable
          style={StyleSheet.absoluteFill}
          onPress={onClose}
          accessibilityRole="button"
          accessibilityLabel="Close"
        />

        <View style={styles.dialog}>
          <View style={[styles.head, { backgroundColor: bg }]}>
            <View style={styles.headIcon}>
              <Ionicons name={face?.icon || 'mic'} size={22} color={fg} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.title} numberOfLines={1}>{group?.label}</Text>
              <Text style={[styles.subtitle, { color: fg }]}>
                {group?.practised ?? 0}{group?.total ? ` of ${group.total}` : ''} {unit} practised
                {' · '}{group?.attempts ?? 0} {group?.attempts === 1 ? 'try' : 'tries'}
              </Text>
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

          <ScrollView
            style={styles.scrollView}
            contentContainerStyle={styles.scroll}
            showsVerticalScrollIndicator={false}
          >
            <View style={styles.stats}>
              <Stat label="Average" value={group?.average != null ? `${group.average}%` : '—'} tint={fg} />
              <Stat label="Latest" value={group?.latestScore != null ? `${group.latestScore}%` : '—'} />
              <Stat
                label="Change"
                value={change == null ? '—' : change > 0 ? `+${change}` : String(change)}
                tint={change > 0 ? '#2A7146' : change < 0 ? '#B86E12' : undefined}
              />
            </View>

            {group?.flagged > 0 ? (
              <View style={styles.flagRow}>
                <Ionicons name="flag" size={14} color="#B86E12" />
                <Text style={styles.flagText}>
                  {group.flagged} {group.flagged === 1 ? 'attempt is' : 'attempts are'} waiting in the review queue
                </Text>
              </View>
            ) : null}

            {sounds.length > 0 ? (
              <Section title="Sounds to practise" icon="ear" tint={fg} count={sounds.length}>
                <View style={styles.chips}>
                  {sounds.map((s) => (
                    <View key={s.text} style={[styles.chip, { backgroundColor: bg }]}>
                      <Text style={[styles.chipText, { color: fg }]}>{s.text}</Text>
                      <Text style={styles.chipMeta}>{s.average}% · {s.count}×</Text>
                    </View>
                  ))}
                </View>
              </Section>
            ) : null}

            {words.length > 0 ? (
              <Section title="Practised" icon="checkmark-circle" tint={fg} count={words.length}>
                <View style={styles.table}>
                  <View style={[styles.row, styles.headerRow]}>
                    <Text style={[styles.cellWord, styles.headerText]}>{unit === 'letters' ? 'Letter' : 'Word'}</Text>
                    <Text style={[styles.cellNum, styles.headerText]}>Latest</Text>
                    <Text style={[styles.cellNum, styles.headerText]}>Best</Text>
                    <Text style={[styles.cellNum, styles.headerText]}>Tries</Text>
                  </View>
                  {words.map((w) => (
                    <View
                      key={w.key}
                      style={styles.row}
                      accessibilityLabel={
                        `${w.label}. Latest ${w.latest ?? 'no'} percent, best ${w.best ?? 'no'} percent, ${w.attempts} tries`
                      }
                    >
                      <View style={[styles.cellWord, styles.wordCell]}>
                        <Text style={styles.wordText} numberOfLines={1}>{w.label}</Text>
                        {w.flagged ? <Ionicons name="flag" size={11} color="#B86E12" /> : null}
                        {w.delta != null && w.delta !== 0 ? (
                          <Ionicons
                            name={w.delta > 0 ? 'arrow-up' : 'arrow-down'}
                            size={11}
                            color={w.delta > 0 ? '#2A7146' : '#B86E12'}
                          />
                        ) : null}
                      </View>
                      <View style={styles.cellNum}>
                        <View style={[styles.scorePill, { backgroundColor: scoreTone(w.latest).bg }]}>
                          <Text style={[styles.scoreText, { color: scoreTone(w.latest).fg }]}>
                            {w.latest != null ? `${w.latest}%` : '—'}
                          </Text>
                        </View>
                      </View>
                      <Text style={[styles.cellNum, styles.numText]}>{w.best != null ? `${w.best}%` : '—'}</Text>
                      <Text style={[styles.cellNum, styles.numText]}>{w.attempts}</Text>
                    </View>
                  ))}
                </View>
              </Section>
            ) : null}

            {notYet.length > 0 ? (
              <Section title="Not practised yet" icon="ellipse-outline" tint={Colors.text.muted} count={notYet.length}>
                <View style={styles.chips}>
                  {notYet.map((label) => (
                    <View key={label} style={[styles.chip, styles.chipIdle]}>
                      <Text style={styles.chipIdleText}>{label}</Text>
                    </View>
                  ))}
                </View>
              </Section>
            ) : null}

            <TouchableOpacity
              style={styles.reportLink}
              activeOpacity={0.7}
              onPress={() => { onClose(); onOpenSessions(); }}
              accessibilityRole="button"
            >
              <Ionicons name="list-outline" size={15} color={Colors.brandDeep} />
              <Text style={styles.reportLinkText}>Every attempt and recording in Sessions</Text>
              <Ionicons name="chevron-forward" size={15} color={Colors.brandDeep} />
            </TouchableOpacity>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

// Same bands the rest of the pronunciation module uses: 80+ strong, 60+ on
// the way, below 60 worth another look.
function scoreTone(score) {
  if (score == null) return { bg: Colors.surfaceAlt, fg: Colors.text.muted };
  if (score >= 80) return { bg: '#E6F4EA', fg: '#2A7146' };
  if (score >= 60) return { bg: '#FAF0DF', fg: '#945D08' };
  return { bg: '#FBE9E4', fg: '#B5462C' };
}

function Stat({ label, value, tint }) {
  return (
    <View style={styles.stat}>
      <Text style={styles.statLabel}>{label}</Text>
      <Text style={[styles.statValue, tint ? { color: tint } : null]}>{value}</Text>
    </View>
  );
}

function Section({ title, icon, tint, count, children }) {
  return (
    <View style={styles.section}>
      <View style={styles.sectionHead}>
        <Ionicons name={icon} size={16} color={tint} />
        <Text style={styles.sectionTitle}>{title}</Text>
        <View style={[styles.countPill, { backgroundColor: tint + '1F' }]}>
          <Text style={[styles.countText, { color: tint }]}>{count}</Text>
        </View>
      </View>
      {children}
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
  dialog: {
    width: '100%',
    maxWidth: rs(560),
    maxHeight: '84%',
    backgroundColor: Colors.surface,
    borderRadius: rs(24),
    overflow: 'hidden',
  },

  head: { flexDirection: 'row', alignItems: 'center', gap: rs(12), paddingHorizontal: rs(20), paddingVertical: rs(16) },
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

  scrollView: { flexShrink: 1 },
  scroll: { padding: rs(20), paddingTop: rs(16), gap: rs(20) },

  stats: { flexDirection: 'row', gap: rs(8) },
  stat: {
    flex: 1,
    paddingVertical: rs(10),
    paddingHorizontal: rs(12),
    borderRadius: rs(14),
    backgroundColor: Colors.surfaceAlt,
  },
  statLabel: {
    fontSize: rf(11), fontFamily: 'DMSans_700Bold', color: Colors.text.secondary,
    textTransform: 'uppercase', letterSpacing: 0.8,
  },
  statValue: { fontSize: rf(20), fontFamily: 'DMSans_800ExtraBold', color: Colors.text.primary, marginTop: rs(4) },

  flagRow: {
    flexDirection: 'row', alignItems: 'center', gap: rs(6),
    paddingVertical: rs(8), paddingHorizontal: rs(12), borderRadius: rs(12), backgroundColor: '#FDF3E3',
  },
  flagText: { fontSize: rf(12.5), fontFamily: 'DMSans_600SemiBold', color: '#8A5208' },

  section: { gap: rs(10) },
  sectionHead: { flexDirection: 'row', alignItems: 'center', gap: rs(7) },
  sectionTitle: { fontSize: rf(15), fontFamily: 'DMSans_700Bold', color: Colors.text.primary },
  countPill: { paddingHorizontal: rs(8), paddingVertical: 2, borderRadius: Layout.radius.full },
  countText: { fontSize: rf(11), fontFamily: 'DMSans_700Bold' },

  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: rs(8) },
  chip: { flexDirection: 'row', alignItems: 'baseline', gap: rs(6), paddingHorizontal: rs(10), paddingVertical: rs(6), borderRadius: rs(12) },
  chipText: { fontSize: rf(15), fontFamily: 'DMSans_800ExtraBold' },
  chipMeta: { fontSize: rf(11), fontFamily: 'DMSans_600SemiBold', color: Colors.text.secondary },
  chipIdle: { backgroundColor: Colors.surfaceAlt },
  chipIdleText: { fontSize: rf(13), fontFamily: 'DMSans_600SemiBold', color: Colors.text.muted },

  table: {
    borderRadius: rs(14),
    borderWidth: 1,
    borderColor: Colors.borderLight,
    overflow: 'hidden',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: rs(12),
    paddingVertical: rs(9),
    borderTopWidth: 1,
    borderTopColor: Colors.borderLight,
  },
  headerRow: { borderTopWidth: 0, backgroundColor: Colors.surfaceAlt, paddingVertical: rs(7) },
  headerText: {
    fontSize: rf(10.5), fontFamily: 'DMSans_700Bold', color: Colors.text.secondary,
    textTransform: 'uppercase', letterSpacing: 0.6,
  },
  cellWord: { flex: 1 },
  cellNum: { width: rs(64), alignItems: 'center', textAlign: 'center' },
  wordCell: { flexDirection: 'row', alignItems: 'center', gap: rs(5) },
  wordText: { fontSize: rf(14), fontFamily: 'DMSans_700Bold', color: Colors.text.primary, flexShrink: 1 },
  numText: { fontSize: rf(13), fontFamily: 'DMSans_600SemiBold', color: Colors.text.secondary },
  scorePill: { borderRadius: rs(10), paddingHorizontal: rs(8), paddingVertical: 2 },
  scoreText: { fontSize: rf(12), fontFamily: 'DMSans_700Bold' },

  reportLink: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: rs(6),
    paddingVertical: rs(12),
    borderRadius: rs(14),
    backgroundColor: '#E4F4EC',
  },
  reportLinkText: { fontSize: rf(13), fontFamily: 'DMSans_700Bold', color: Colors.brandDeep },
});
