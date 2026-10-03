import { getAvatarTheme } from '../../../../constants/avatarThemes';
import Phase1CompleteCelebration from '../../../../components/feedback/Phase1CompleteCelebration';

const WORD_LABELS = {
  thank_you:     'Thank You',
  im_sorry:      "I'm Sorry",
  youre_welcome: "You're Welcome",
  excuse_me:     'Excuse Me',
};

export default function Phase1CompleteScreen({ route, navigation }) {
  const { student, wordKey = 'thank_you' } = route.params ?? {};
  const theme     = getAvatarTheme(student?.avatar_key);
  const wordLabel = WORD_LABELS[wordKey] ?? wordKey.replace(/_/g, ' ');

  return (
    <Phase1CompleteCelebration
      theme={theme}
      avatarKey={student?.avatar_key}
      wordLabel={wordLabel}
      onContinue={() => navigation.navigate('Phase2Production', { student, wordKey, wordId: route.params?.wordId, cueGrapheme: route.params?.cueGrapheme ?? null })}
    />
  );
}
