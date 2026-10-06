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

/**
 * One stroke family's letters, opened from a card in the Student Profile's
 * Writing tab — the handwriting counterpart of CategoryConceptsModal.
 *
 * Everything shown is already in the family object built by
 * utils/writingStrokeBreakdown.js from the Writing Progress Report's letter
 * rows. No request is made here and nothing is written: the per-letter
 * history, charts and recommendations stay in the report, which the footer
 * link opens.
 */
export function StrokeFamilyModal({ family, face, onClose, onOpenReport }) {
  const visible = !!family;
  const letters = family?.letters || [];
  const practised = letters.filter((l) => l.practised);
  const notYet = letters.filter((l) => !l.practised);
  const fg = face?.fg || Colors.brandDeep;
  const bg = face?.bg || '#E4F4EC';

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
              <Ionicons name={face?.icon || 'create'} size={22} color={fg} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.title} numberOfLines={1}>{family?.label}</Text>
              <Text style={[styles.subtitle, { color: fg }]}>
                {family?.practised ?? 0} of {family?.total ?? 0} letters practised
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
            {/* The family's averages, as the card shows them. */}
            {family?.current != null ? (
              <View style={styles.stats}>
                <Stat label="Now" value={`${family.current}%`} tint={fg} />
                <Stat label="First try" value={family.initial != null ? `${family.initial}%` : '—'} />
                <Stat
                  label="Change"
                  value={family.delta == null ? '—'
                    : family.delta > 0 ? `+${family.delta}` : String(family.delta)}
                  tint={family.delta > 0 ? '#2A7146' : family.delta < 0 ? '#B86E12' : undefined}
                />
              </View>
            ) : null}

            {practised.length > 0 ? (
              <Section title="Practised" icon="checkmark-circle" tint={fg} count={practised.length}>
                {practised.map((l) => <LetterTile key={l.form} letter={l} fg={fg} bg={bg} />)}
              </Section>
            ) : null}

            {notYet.length > 0 ? (
              <Section title="Not practised yet" icon="ellipse-outline" tint={Colors.text.muted} count={notYet.length}>
                {notYet.map((l) => (
                  <View key={l.form} style={[styles.tile, styles.tileIdle]}>
                    <Text style={[styles.glyph, styles.glyphIdle]}>{l.form}</Text>
                    <Text style={styles.idleText}>Not yet</Text>
                  </View>
                ))}
              </Section>
            ) : null}

            <TouchableOpacity
              style={styles.reportLink}
              activeOpacity={0.7}
              onPress={() => { onClose(); onOpenReport(); }}
              accessibilityRole="button"
            >
              <Ionicons name="document-text-outline" size={15} color={Colors.brandDeep} />
              <Text style={styles.reportLinkText}>Full letter history in the Writing report</Text>
              <Ionicons name="chevron-forward" size={15} color={Colors.brandDeep} />
            </TouchableOpacity>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
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
      <View style={styles.grid}>{children}</View>
    </View>
  );
}

function LetterTile({ letter: l, fg, bg }) {
  const up = l.delta != null && l.delta > 0;
  const down = l.delta != null && l.delta < 0;
  return (
    <View
      style={styles.tile}
      accessibilityLabel={
        `${l.form}. Latest ${l.latest ?? 'no'} percent` +
        (l.delta != null ? `, ${l.delta >= 0 ? 'up' : 'down'} ${Math.abs(l.delta)} since first try` : '') +
        (l.attempts != null ? `, ${l.attempts} attempts` : '')
      }
    >
      <View style={[styles.glyphWrap, { backgroundColor: bg }]}>
        <Text style={[styles.glyph, { color: fg }]}>{l.form}</Text>
      </View>

      <View style={[styles.scorePill, { backgroundColor: bg }]}>
        <Text style={[styles.scoreText, { color: fg }]}>{l.latest != null ? `${l.latest}%` : '—'}</Text>
      </View>

      {l.delta != null ? (
        <View style={styles.deltaRow}>
          <Ionicons
            name={up ? 'arrow-up' : down ? 'arrow-down' : 'remove'}
            size={10}
            color={up ? '#2A7146' : down ? '#B86E12' : Colors.text.muted}
          />
          <Text style={styles.metaText}>
            {l.delta === 0 ? 'No change' : `${Math.abs(l.delta)} since first`}
          </Text>
        </View>
      ) : null}

      {l.attempts != null ? (
        <Text style={styles.metaText}>
          {l.attempts} {l.attempts === 1 ? 'try' : 'tries'}
          {l.sessions != null ? ` · ${l.sessions} ${l.sessions === 1 ? 'session' : 'sessions'}` : ''}
        </Text>
      ) : null}
    </View>
  );
}

const TILE_W = 104;

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
    maxWidth: 560,
    maxHeight: '84%',
    backgroundColor: Colors.surface,
    borderRadius: 24,
    overflow: 'hidden',
  },

  head: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 20, paddingVertical: 16 },
  headIcon: {
    width: 44, height: 44, borderRadius: 22,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: '#FFFFFF',
  },
  title:    { fontSize: 20, fontFamily: 'DMSans_800ExtraBold', color: Colors.text.primary },
  subtitle: { fontSize: 13, fontFamily: 'DMSans_600SemiBold', marginTop: 1 },
  closeBtn: {
    width: 34, height: 34, borderRadius: 17,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.85)',
  },

  scrollView: { flexShrink: 1 },
  scroll: { padding: 20, paddingTop: 16, gap: 20 },

  stats: { flexDirection: 'row', gap: 8 },
  stat: {
    flex: 1,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 14,
    backgroundColor: Colors.surfaceAlt,
  },
  statLabel: {
    fontSize: 11, fontFamily: 'DMSans_700Bold', color: Colors.text.secondary,
    textTransform: 'uppercase', letterSpacing: 0.8,
  },
  statValue: { fontSize: 20, fontFamily: 'DMSans_800ExtraBold', color: Colors.text.primary, marginTop: 4 },

  section: { gap: 10 },
  sectionHead: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  sectionTitle: { fontSize: 15, fontFamily: 'DMSans_700Bold', color: Colors.text.primary },
  countPill: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: Layout.radius.full },
  countText: { fontSize: 11, fontFamily: 'DMSans_700Bold' },

  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  tile: {
    width: TILE_W,
    alignItems: 'center',
    gap: 6,
    padding: 8,
    paddingBottom: 10,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Colors.borderLight,
    backgroundColor: Colors.surface,
  },
  tileIdle: { width: 64, paddingVertical: 8, backgroundColor: Colors.surfaceAlt, borderColor: Colors.surfaceAlt },
  glyphWrap: {
    alignSelf: 'stretch',
    height: 56,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  glyph: { fontSize: 32, lineHeight: 38, fontFamily: 'DMSans_700Bold' },
  glyphIdle: { fontSize: 24, lineHeight: 30, color: Colors.text.muted },
  idleText: { fontSize: 10, color: Colors.text.muted },

  scorePill: { borderRadius: 10, paddingHorizontal: 8, paddingVertical: 2 },
  scoreText: { fontSize: 12, fontFamily: 'DMSans_700Bold' },
  deltaRow: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  metaText: { fontSize: 10, color: Colors.text.secondary, textAlign: 'center' },

  reportLink: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 12,
    borderRadius: 14,
    backgroundColor: '#E4F4EC',
  },
  reportLinkText: { fontSize: 13, fontFamily: 'DMSans_700Bold', color: Colors.brandDeep },
});
