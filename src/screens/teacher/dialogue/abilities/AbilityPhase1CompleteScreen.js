import { getAvatarTheme } from '../../../../constants/avatarThemes';
import Phase1CompleteCelebration from '../../../../components/feedback/Phase1CompleteCelebration';
import { abilityLabel } from '../../../../data/abilitiesWords';

// "Can you…?" Phase 1 celebration — the same screen Magic Words and Greetings
// show between the drag activities and the speaking step.
export default function AbilityPhase1CompleteScreen({ route, navigation }) {
  const { student, wordKey = 'clap' } = route.params ?? {};
  const theme     = getAvatarTheme(student?.avatar_key);
  const wordLabel = abilityLabel(wordKey);

  return (
    <Phase1CompleteCelebration
      theme={theme}
      avatarKey={student?.avatar_key}
      wordLabel={wordLabel}
      onContinue={() =>
        navigation.navigate('AbilityPhase2Production', {
          student,
          wordKey,
          wordId: route.params?.wordId,
          cueGrapheme: route.params?.cueGrapheme ?? null,
        })
      }
    />
  );
}
