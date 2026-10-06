import { View, Text, TouchableOpacity } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useThemeMode, useThemedStyles, PALETTES } from '../../../context/ThemeModeContext';

const GREEN = '#3EBF78';

const OPTIONS = [
  { mode: 'light', label: 'Light', sub: 'Bright pages, dark text', icon: 'sunny' },
  { mode: 'dark',  label: 'Dark',  sub: 'Dark pages, light text — easier in low light', icon: 'moon' },
];

/** A miniature of the app in a given mode, so the choice is seen, not described. */
function Preview({ mode }) {
  const p = PALETTES[mode];
  return (
    <View style={{ height: 96, borderRadius: 12, overflow: 'hidden', flexDirection: 'row', backgroundColor: p.background, borderWidth: 1, borderColor: p.border }}>
      <View style={{ width: 26, backgroundColor: '#0D2535' }} />
      <View style={{ flex: 1, padding: 10, gap: 6 }}>
        <View style={{ height: 8, width: '55%', borderRadius: 4, backgroundColor: p.text, opacity: 0.85 }} />
        <View style={{ flexDirection: 'row', gap: 6, flex: 1 }}>
          {[0, 1, 2].map((i) => (
            <View key={i} style={{ flex: 1, borderRadius: 6, backgroundColor: p.surface, borderWidth: 1, borderColor: p.border, padding: 5, gap: 4 }}>
              <View style={{ height: 5, width: '60%', borderRadius: 3, backgroundColor: p.muted }} />
              <View style={{ height: 4, width: '80%', borderRadius: 2, backgroundColor: p.track }} />
            </View>
          ))}
        </View>
      </View>
    </View>
  );
}

/** Theme settings — light or dark mode for the principal app, saved on the device. */
export default function ThemeSettingsScreen() {
  const insets = useSafeAreaInsets();
  const { mode, setMode } = useThemeMode();
  const styles = useThemedStyles(makeStyles);

  return (
    <SafeAreaView style={styles.safe} edges={['bottom']}>
      <View style={[styles.topBar, { paddingTop: insets.top + 14 }]}>
        <View style={styles.titleRow}>
          <View style={styles.sectionBar} />
          <Text style={styles.pageTitle}>Theme Settings</Text>
        </View>
        <Text style={styles.pageSub}>Choose how the app looks on this device.</Text>
      </View>

      <View style={styles.body}>
        <Text style={styles.groupLabel}>APPEARANCE</Text>
        <View style={styles.options}>
          {OPTIONS.map((o) => {
            const on = o.mode === mode;
            return (
              <TouchableOpacity
                key={o.mode}
                style={[styles.option, on && styles.optionOn]}
                activeOpacity={0.85}
                onPress={() => setMode(o.mode)}
                accessibilityRole="radio"
                accessibilityState={{ checked: on }}
                accessibilityLabel={`${o.label} mode`}
              >
                <Preview mode={o.mode} />
                <View style={styles.optionRow}>
                  <View style={[styles.optionIcon, on && styles.optionIconOn]}>
                    <Ionicons name={o.icon} size={16} color={on ? '#FFFFFF' : GREEN} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.optionLabel}>{o.label}</Text>
                    <Text style={styles.optionSub}>{o.sub}</Text>
                  </View>
                  <Ionicons
                    name={on ? 'checkmark-circle' : 'ellipse-outline'}
                    size={22}
                    color={on ? GREEN : styles.optionSub.color}
                  />
                </View>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>
    </SafeAreaView>
  );
}

const makeStyles = (p) => ({
  safe: { flex: 1, backgroundColor: p.background },

  topBar: { backgroundColor: p.surface, paddingHorizontal: 24, paddingBottom: 16, gap: 4 },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  sectionBar: { width: 4, height: 22, borderRadius: 2, backgroundColor: GREEN },
  pageTitle: { fontSize: 22, fontFamily: 'DMSans_800ExtraBold', color: p.text },
  pageSub: { fontSize: 13, color: p.muted, marginLeft: 14 },

  body: { padding: 24, gap: 12 },
  groupLabel: { fontSize: 11, fontFamily: 'DMSans_700Bold', color: p.muted, letterSpacing: 1.2 },
  options: { flexDirection: 'row', flexWrap: 'wrap', gap: 16 },
  option: {
    flexGrow: 1, flexBasis: '46%',
    gap: 14, padding: 14,
    borderRadius: 18, borderWidth: 2, borderColor: p.border,
    backgroundColor: p.surface,
  },
  optionOn: { borderColor: GREEN },
  optionRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  optionIcon: {
    width: 34, height: 34, borderRadius: 17,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: GREEN + '1F',
  },
  optionIconOn: { backgroundColor: GREEN },
  optionLabel: { fontSize: 16, fontFamily: 'DMSans_700Bold', color: p.text },
  optionSub: { fontSize: 12, color: p.muted, marginTop: 1 },
});
