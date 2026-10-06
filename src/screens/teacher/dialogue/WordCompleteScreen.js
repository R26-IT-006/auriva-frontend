import { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { getAvatarTheme } from '../../../constants/avatarThemes';
import { ParentGateModal } from '../../../components/common/ParentGateModal';
import { dialogueApi } from '../../../api/dialogue';
import { clearRestartCount } from '../../../utils/sessionRetryTracker';
import Phase1CompleteCelebration from '../../../components/feedback/Phase1CompleteCelebration';
import { rs, rf } from '../../../utils/responsive';

function getCategoryStartScreen(category) {
  switch (category) {
    case 'greetings':    return 'GreetingPhase1Video';
    case 'magic_words':
    default:             return 'Phase1Video';
  }
}

export default function WordCompleteScreen({ route, navigation }) {
  const {
    student,
    wordKey,
    wordId,
    wordLabel     = wordKey?.replace(/_/g, ' ') ?? '',
    category      = 'magic_words',
    mastered      = false,
    sessionPassed = false,
    status        = 'in_progress',
  } = route.params ?? {};

  const theme = getAvatarTheme(student?.avatar_key);

  const [loadingNext, setLoadingNext] = useState(false);
  const [showGate,    setShowGate]    = useState(false);

  const isCongrats = mastered;
  const heading    = isCongrats ? 'Congratulations!' : 'Good Job!';
  const subtext    = isCongrats
    ? "You've mastered"
    : "You're doing great with";

  function tryAgain() {
    clearRestartCount(student?.sid, wordId);
    navigation.navigate(getCategoryStartScreen(category), { student, wordKey, wordId });
  }

  async function goNextWord() {
    setLoadingNext(true);
    clearRestartCount(student?.sid, wordId);
    try {
      const nextWord = await dialogueApi.getNextWord(student?.sid, {
        category,
        excludeWordId: wordId,
        sessionPassed,
        status,
      });
      if (!nextWord || nextWord.done) {
        navigation.navigate('DialogueCategory', { student });
        return;
      }
      navigation.navigate(getCategoryStartScreen(category), {
        student,
        wordKey: nextWord.asset_key,
        wordId:  nextWord.id,
      });
    } catch {
      navigation.navigate('DialogueCategory', { student });
    } finally {
      setLoadingNext(false);
    }
  }

  return (
    <>
      <Phase1CompleteCelebration
        theme={theme}
        avatarKey={student?.avatar_key}
        wordLabel={wordLabel}
        heading={heading}
        subtext={subtext}
        burst={isCongrats ? '🏆' : '🌟'}
        note={isCongrats ? 'This word is now mastered!' : null}
        topRight={
          // Exit icon — opens parent gate
          <TouchableOpacity onPress={() => setShowGate(true)} activeOpacity={0.7} style={styles.exitBtn}>
            <Ionicons name="exit-outline" size={22} color={theme.headingText} />
          </TouchableOpacity>
        }
        actions={
          <View style={styles.buttonsRow}>
            <TouchableOpacity
              style={[styles.secondaryBtn, { borderColor: theme.cardOutline }]}
              onPress={tryAgain}
              activeOpacity={0.8}
            >
              <Ionicons name="refresh" size={20} color={theme.button} />
              <Text style={[styles.secondaryBtnText, { color: theme.button }]}>
                Try again
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.primaryBtn, { backgroundColor: theme.button }]}
              onPress={goNextWord}
              activeOpacity={0.85}
              disabled={loadingNext}
            >
              {loadingNext ? (
                <ActivityIndicator color={theme.buttonText} />
              ) : (
                <>
                  <Text style={[styles.primaryBtnText, { color: theme.buttonText }]}>
                    Next word
                  </Text>
                  <Ionicons name="arrow-forward" size={20} color={theme.buttonText} />
                </>
              )}
            </TouchableOpacity>
          </View>
        }
      />

      {/* Parent gate — exit to category menu */}
      <ParentGateModal
        visible={showGate}
        onSuccess={() => {
          setShowGate(false);
          navigation.navigate('DialogueCategory', { student });
        }}
        onDismiss={() => setShowGate(false)}
      />
    </>
  );
}

const styles = StyleSheet.create({
  // Concept's round translucent header button.
  exitBtn: {
    width: rs(44),
    height: rs(44),
    borderRadius: rs(22),
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.7)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 2,
  },

  buttonsRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: rs(16),
  },
  // Raised 3D buttons, like the ones used in the other modules.
  primaryBtn: {
    minWidth: rs(180),
    gap: rs(8),
    paddingHorizontal: rs(32),
    paddingVertical: rs(15),
    borderRadius: rs(16),
    borderBottomWidth: 5,
    borderBottomColor: 'rgba(0,0,0,0.22)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: rs(4) },
    shadowOpacity: 0.18,
    shadowRadius: 10,
    elevation: 6,
    flexDirection:  'row',
    alignItems:     'center',
    justifyContent: 'center',
  },
  primaryBtnText: {
    fontSize: rf(18),
    fontFamily: 'DMSans_800ExtraBold',
  },
  secondaryBtn: {
    minWidth: rs(180),
    flexDirection:  'row',
    alignItems:     'center',
    justifyContent: 'center',
    gap:            rs(8),
    backgroundColor: '#FFFFFF',
    paddingHorizontal: rs(28),
    paddingVertical: rs(13),
    borderRadius:   rs(16),
    borderWidth:    2,
    borderBottomWidth: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: rs(3) },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  secondaryBtnText: {
    fontSize:   rf(18),
    fontFamily: 'DMSans_800ExtraBold',
  },
});
