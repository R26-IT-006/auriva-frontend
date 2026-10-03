import { getAvatarTheme } from '../../../../constants/avatarThemes';
import Phase1CompleteCelebration from '../../../../components/feedback/Phase1CompleteCelebration';

const WORD_LABELS = {
  hello:          'Hello',
  goodbye:        'Goodbye',
  good_morning:   'Good Morning',
  good_afternoon: 'Good Afternoon',
  good_night:     'Good Night',
  happy_birthday: 'Happy Birthday',
  how_are_you:    'How Are You?',
  im_fine:        "I'm Fine",
  happy_new_year: 'Happy New Year',
};

export default function GreetingPhase1CompleteScreen({ route, navigation }) {
  const { student, wordKey = 'hello' } = route.params ?? {};
  const theme     = getAvatarTheme(student?.avatar_key);
  const wordLabel = WORD_LABELS[wordKey] ?? wordKey.replace(/_/g, ' ');

  return (
    <Phase1CompleteCelebration
      theme={theme}
      avatarKey={student?.avatar_key}
      wordLabel={wordLabel}
      onContinue={() =>
        navigation.navigate('GreetingPhase2Production', {
          student,
          wordKey,
          wordId: route.params?.wordId,
          cueGrapheme: route.params?.cueGrapheme ?? null,
        })
      }
    />
  );
}
