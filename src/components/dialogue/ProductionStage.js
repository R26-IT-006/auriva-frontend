import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { rs, rf } from '../../utils/responsive';

/**
 * ProductionStage.js
 *
 * The body of the dialogue "Can you say …?" production screens (magic words
 * and greetings), laid out like the other modules' activity screens: the
 * prompt, a large white word card framed in the theme outline (tap to
 * hear) and a raised 3D record button directly beneath it. No avatar.
 *
 * Presentation only — every state value and handler comes from the screen,
 * which keeps all of the prompting / recording / scoring logic.
 */

export default function ProductionStage({
  theme,
  wordLabel,
  wordParts,        // [prefix, cue, suffix] when the grapheme cue is showing, else null
  tileGlow,
  onTileTap,
  isRecording,
  btnGlow,
  isDimmed,
  onRecord,
  onNext,
}) {
  const wordUpper = wordLabel.toUpperCase();

  return (
    <View style={styles.content}>
      <View style={styles.centerCol}>
        <Text style={[styles.title, { color: theme.headingText }]}>
          {'Can you say '}
          <Text style={styles.titleEmphasis}>{`"${wordUpper}"`}</Text>
          {'?'}
        </Text>

        <TouchableOpacity
          style={[
            styles.wordTile,
            { borderColor: tileGlow ? theme.button : theme.cardOutline },
            tileGlow && styles.wordTileGlow,
            tileGlow && { shadowColor: theme.button },
          ]}
          onPress={onTileTap}
          activeOpacity={0.85}
          accessibilityRole="button"
          accessibilityLabel={`Hear ${wordLabel}`}
        >
          <View style={[styles.speakerCircle, { backgroundColor: theme.button }]}>
            <Ionicons name="volume-high" size={30} color={theme.buttonText ?? '#FFFFFF'} />
          </View>
          {wordParts ? (
            <Text style={[styles.wordText, { color: theme.button }]}>
              {wordParts[0]}
              <Text style={styles.wordTextCue}>{wordParts[1]}</Text>
              {wordParts[2]}
            </Text>
          ) : (
            <Text style={[styles.wordText, { color: theme.button }]}>{wordLabel}</Text>
          )}
        </TouchableOpacity>

        <View style={styles.hintPill}>
          <Ionicons name="hand-left-outline" size={15} color={theme.headingText} />
          <Text style={[styles.hintText, { color: theme.headingText }]}>Tap the card to hear the word</Text>
        </View>

        <TouchableOpacity
          style={[
            styles.recordBtn,
            isRecording ? styles.recordBtnStop : styles.recordBtnGo,
            btnGlow && styles.recordBtnGlow,
            isDimmed && styles.recordBtnDimmed,
          ]}
          onPress={onRecord}
          activeOpacity={0.85}
          disabled={isDimmed}
          accessibilityRole="button"
        >
          <Ionicons name={isRecording ? 'stop-circle' : 'mic'} size={26} color="#FFF" />
          <Text style={styles.recordBtnText}>
            {isRecording ? 'Stop Recording' : 'Record Audio'}
          </Text>
        </TouchableOpacity>
        <Text style={[styles.tapSpeak, { color: theme.headingText }]}>TAP AND SPEAK</Text>
      </View>

      {/* Next — teacher gate protected (the screen opens the gate). */}
      <TouchableOpacity
        style={[styles.nextBtn, { borderColor: theme.cardOutline }]}
        onPress={onNext}
        activeOpacity={0.8}
      >
        <Text style={[styles.nextBtnText, { color: theme.button }]}>Next</Text>
        <Ionicons name="arrow-forward" size={20} color={theme.button} />
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  content: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: rs(24),
    paddingBottom: rs(70),
  },

  centerCol: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },

  title: {
    fontSize: rf(26),
    fontFamily: 'DMSans_600SemiBold',
    textAlign: 'center',
    marginBottom: rs(16),
  },
  titleEmphasis: {
    fontFamily: 'DMSans_900Black',
  },

  wordTile: {
    minWidth: rs(340),
    backgroundColor: '#FFFFFF',
    borderRadius: rs(28),
    borderWidth: 3,
    paddingVertical: rs(26),
    paddingHorizontal: rs(40),
    alignItems: 'center',
    gap: rs(14),
    shadowColor: '#000',
    shadowOffset: { width: 0, height: rs(6) },
    shadowOpacity: 0.1,
    shadowRadius: 16,
    elevation: 6,
  },
  wordTileGlow: {
    borderWidth: 4,
    shadowOpacity: 0.4,
    shadowRadius: 18,
    elevation: 10,
  },
  speakerCircle: {
    width: rs(64),
    height: rs(64),
    borderRadius: rs(32),
    alignItems: 'center',
    justifyContent: 'center',
    borderBottomWidth: 4,
    borderBottomColor: 'rgba(0,0,0,0.18)',
  },
  wordText: {
    fontSize: rf(40),
    lineHeight: rf(48),
    fontFamily: 'DMSans_900Black',
    textAlign: 'center',
  },
  wordTextCue: {
    fontFamily: 'DMSans_900Black',
    textDecorationLine: 'underline',
    color: '#E05C2A',   // warm orange — contrasts with theme.button on all avatar themes
  },

  hintPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: rs(6),
    marginTop: rs(14),
    paddingHorizontal: rs(14),
    paddingVertical: rs(6),
    borderRadius: rs(999),
    backgroundColor: 'rgba(255,255,255,0.7)',
  },
  hintText: {
    fontSize: rf(13),
    fontFamily: 'DMSans_600SemiBold',
    opacity: 0.75,
  },

  // Raised 3D button, like the ones used in the other modules.
  recordBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: rs(10),
    marginTop: rs(84),
    paddingHorizontal: rs(40),
    paddingVertical: rs(16),
    borderRadius: rs(36),
    borderBottomWidth: 5,
    borderBottomColor: 'rgba(0,0,0,0.22)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: rs(4) },
    shadowOpacity: 0.18,
    shadowRadius: 10,
    elevation: 6,
  },
  recordBtnGo:   { backgroundColor: '#2DC98E' },
  recordBtnStop: { backgroundColor: '#FF4D6D' },
  recordBtnGlow: {
    borderWidth: 3,
    borderColor: '#FFFFFF',
    shadowColor: '#2DC98E',
    shadowOpacity: 0.55,
    shadowRadius: 16,
    elevation: 10,
  },
  recordBtnDimmed: { opacity: 0.4 },
  recordBtnText: {
    fontSize: rf(19),
    fontFamily: 'DMSans_800ExtraBold',
    color: '#FFF',
  },
  tapSpeak: {
    marginTop: rs(10),
    fontSize: rf(12),
    fontFamily: 'DMSans_700Bold',
    letterSpacing: 1.2,
    opacity: 0.5,
  },

  nextBtn: {
    position: 'absolute',
    right: rs(24),
    bottom: rs(16),
    flexDirection: 'row',
    alignItems: 'center',
    gap: rs(8),
    backgroundColor: '#FFFFFF',
    paddingHorizontal: rs(28),
    paddingVertical: rs(12),
    borderRadius: rs(18),
    borderWidth: 2,
    borderBottomWidth: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: rs(4) },
    shadowOpacity: 0.12,
    shadowRadius: 8,
    elevation: 4,
  },
  nextBtnText: {
    fontSize: rf(17),
    fontFamily: 'DMSans_800ExtraBold',
  },
});
