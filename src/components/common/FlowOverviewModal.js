import { View, Text, Modal, TouchableOpacity, Pressable, ScrollView, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { rs, rf } from '../../utils/responsive';

/**
 * FlowOverviewModal.js
 *
 * Shared "How it works" pop-up: a teacher-facing, read-only overview of a
 * module's flow, drawn as an illustrated stepper — numbered stage cards on a
 * connector line, with what the child does and the support given after a
 * mistake. Each module supplies its own stages (data/conceptFlow.js,
 * data/handwritingFlow.js).
 *
 * Stage shape: { key, kind: 'start' | 'tier' | 'milestone', icon, title,
 *   subtitle, tier?, tag?, steps?: string[], childDoes, ifWrong?, note? }
 *
 * Same shell as ConceptSummaryModal (theme-framed card, icon title, round
 * close, backdrop that closes it, scrolling list).
 */
export default function FlowOverviewModal({
  visible,
  onClose,
  theme,
  stages = [],
  title = 'How it works',
  subtitle = 'What happens when an activity is selected',
}) {

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} accessibilityLabel="Close" />
        <View style={[styles.card, { backgroundColor: theme.cardSurface, borderColor: theme.cardOutline }]}>
          <View style={styles.header}>
            <View style={styles.titleRow}>
              <View style={[styles.titleIcon, { backgroundColor: theme.cardOutline }]}>
                <Ionicons name="map" size={18} color="#FFF" />
              </View>
              <View>
                <Text style={[styles.title, { color: theme.headingText }]}>{title}</Text>
                <Text style={[styles.subtitle, { color: theme.headingText }]}>{subtitle}</Text>
              </View>
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

          <ScrollView style={styles.scroll} contentContainerStyle={styles.list} showsVerticalScrollIndicator>
            {stages.map((s, i) => {
              const isLast = i === stages.length - 1;
              const isTier = s.kind === 'tier';
              const accent = s.kind === 'milestone' ? '#F59E0B' : theme.button;
              return (
                <View key={s.key} style={styles.stageRow}>
                  {/* Rail: numbered node + connector line to the next stage */}
                  <View style={styles.rail}>
                    <View style={[styles.node, { backgroundColor: accent }]}>
                      <Ionicons name={s.icon} size={20} color="#FFF" />
                    </View>
                    {!isLast && <View style={[styles.connector, { backgroundColor: theme.cardOutline }]} />}
                  </View>

                  <View style={[styles.stageCard, { borderColor: isTier ? theme.cardOutline : theme.cardOutline + '88' }]}>
                    <View style={styles.stageTop}>
                      <Text style={[styles.stageNum, { color: accent }]}>{`STEP ${i + 1}`}</Text>
                      {(s.tag || isTier) && (
                        <View style={[styles.tierPill, { backgroundColor: theme.button + '1A' }]}>
                          <Text style={[styles.tierPillText, { color: theme.button }]}>{s.tag ?? `Tier ${s.tier}`}</Text>
                        </View>
                      )}
                    </View>
                    <Text style={[styles.stageTitle, { color: theme.headingText }]}>{s.title}</Text>
                    <Text style={[styles.stageSubtitle, { color: theme.headingText }]}>{s.subtitle}</Text>

                    {/* Mini flow of the screens inside a tier */}
                    {s.steps && (
                      <View style={styles.stepsRow}>
                        {s.steps.map((step, j) => (
                          <View key={step} style={styles.stepItem}>
                            <View style={[styles.stepChip, { borderColor: theme.cardOutline }]}>
                              <Text style={[styles.stepChipText, { color: theme.headingText }]}>{step}</Text>
                            </View>
                            {j < s.steps.length - 1 && (
                              <Ionicons name="arrow-forward" size={14} color={theme.headingText} style={{ opacity: 0.45 }} />
                            )}
                          </View>
                        ))}
                      </View>
                    )}

                    <Text style={[styles.body, { color: theme.headingText }]}>
                      <Text style={styles.strong}>What the child does: </Text>{s.childDoes}
                    </Text>

                    {s.ifWrong && (
                      <View style={styles.supportBox}>
                        <Ionicons name="refresh-circle" size={18} color="#B45309" />
                        <Text style={styles.supportText}>
                          <Text style={styles.strong}>If they get it wrong: </Text>{s.ifWrong}
                        </Text>
                      </View>
                    )}

                    {s.note && (
                      <View style={styles.noteBox}>
                        <Ionicons name="information-circle" size={18} color="#475569" />
                        <Text style={styles.noteText}>{s.note}</Text>
                      </View>
                    )}
                  </View>
                </View>
              );
            })}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const NODE = 40;

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', alignItems: 'center', justifyContent: 'center' },
  card: {
    width: '90%', maxWidth: rs(820), maxHeight: '92%',
    borderRadius: rs(28), borderWidth: 3,
    paddingHorizontal: rs(26), paddingTop: rs(20), paddingBottom: rs(22), gap: rs(14),
    shadowColor: '#000', shadowOffset: { width: 0, height: rs(4) }, shadowOpacity: 0.1, shadowRadius: 10, elevation: 4,
  },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: rs(10), flexShrink: 1 },
  titleIcon: {
    width: rs(34), height: rs(34), borderRadius: rs(17), alignItems: 'center', justifyContent: 'center',
    shadowColor: '#000', shadowOffset: { width: 0, height: rs(3) }, shadowOpacity: 0.15, shadowRadius: 5, elevation: 3,
  },
  title: { fontSize: rf(24), fontFamily: 'DMSans_800ExtraBold', letterSpacing: -0.3 },
  subtitle: { fontSize: rf(13), fontFamily: 'DMSans_600SemiBold', opacity: 0.6 },
  closeBtn: { width: rs(40), height: rs(40), borderRadius: rs(20), alignItems: 'center', justifyContent: 'center' },

  // flexShrink lets the list fit inside the card's maxHeight and scroll.
  scroll: { flexShrink: 1 },
  list: { paddingBottom: rs(4) },

  stageRow: { flexDirection: 'row', gap: rs(14) },
  rail: { width: NODE, alignItems: 'center' },
  node: {
    width: NODE, height: NODE, borderRadius: NODE / 2, alignItems: 'center', justifyContent: 'center',
    borderWidth: 3, borderColor: '#FFFFFF',
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.12, shadowRadius: 4, elevation: 3,
  },
  connector: { flex: 1, width: rs(3), borderRadius: 2, marginVertical: 2, opacity: 0.6 },

  stageCard: {
    flex: 1, marginBottom: rs(14),
    backgroundColor: '#FFFFFF', borderRadius: rs(20), borderWidth: 2,
    paddingHorizontal: rs(16), paddingVertical: rs(12), gap: rs(4),
  },
  stageTop: { flexDirection: 'row', alignItems: 'center', gap: rs(8) },
  stageNum: { fontSize: rf(11), fontFamily: 'DMSans_800ExtraBold', letterSpacing: 1 },
  tierPill: { borderRadius: rs(999), paddingHorizontal: rs(8), paddingVertical: 2 },
  tierPillText: { fontSize: rf(11), fontFamily: 'DMSans_800ExtraBold' },
  stageTitle: { fontSize: rf(19), fontFamily: 'DMSans_800ExtraBold' },
  stageSubtitle: { fontSize: rf(13), fontFamily: 'DMSans_600SemiBold', opacity: 0.6, marginBottom: 2 },

  stepsRow: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: rs(6), marginVertical: rs(4) },
  stepItem: { flexDirection: 'row', alignItems: 'center', gap: rs(6) },
  stepChip: { borderWidth: 1.5, borderRadius: rs(999), paddingHorizontal: rs(10), paddingVertical: rs(4), backgroundColor: '#FFFFFF' },
  stepChipText: { fontSize: rf(12), fontFamily: 'DMSans_700Bold' },

  body: { fontSize: rf(14), fontFamily: 'DMSans_600SemiBold', lineHeight: rf(20), opacity: 0.85 },
  strong: { fontFamily: 'DMSans_800ExtraBold' },

  supportBox: {
    flexDirection: 'row', alignItems: 'flex-start', gap: rs(6), marginTop: rs(6),
    backgroundColor: '#FEF3C7', borderRadius: rs(12), paddingHorizontal: rs(10), paddingVertical: rs(8),
  },
  supportText: { flex: 1, fontSize: rf(13), fontFamily: 'DMSans_600SemiBold', color: '#78350F', lineHeight: rf(18) },
  noteBox: {
    flexDirection: 'row', alignItems: 'flex-start', gap: rs(6), marginTop: rs(6),
    backgroundColor: '#F1F5F9', borderRadius: rs(12), paddingHorizontal: rs(10), paddingVertical: rs(8),
  },
  noteText: { flex: 1, fontSize: rf(13), fontFamily: 'DMSans_600SemiBold', color: '#334155', lineHeight: rf(18) },
});
