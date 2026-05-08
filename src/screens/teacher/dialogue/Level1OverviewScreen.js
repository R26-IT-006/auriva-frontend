import { useEffect, useState } from 'react';
import { View, ActivityIndicator, Text } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { getAvatarTheme } from '../../../constants/avatarThemes';
import { dialogueApi } from '../../../api/dialogue';
import { cat3Api } from '../../../api/cat3';

export default function Level1OverviewScreen({ route, navigation }) {
  const { student, categoryKey } = route.params ?? {};
  const theme = getAvatarTheme(student?.avatar_key);
  const [error, setError] = useState(null);

  useEffect(() => {
    async function loadNextWord() {
      try {
        const nextWord = await dialogueApi.getNextWord(student.sid, { category: categoryKey });

        if (categoryKey === 'magic_words') {
          if (nextWord) {
            navigation.replace('MagicWordLanding', {
              student,
              wordKey: nextWord.asset_key,
              wordId:  nextWord.id,
            });
          } else {
            navigation.replace('DialogueCategory', { student });
          }

        } else if (categoryKey === 'days_of_week') {
          navigation.replace('DaysMenuScreen', { student });

        } else if (categoryKey === 'greetings') {
          if (nextWord) {
            navigation.replace('GreetingLanding', {
              student,
              wordKey: nextWord.asset_key,
              wordId:  nextWord.id,
            });
          } else {
            navigation.replace('DialogueCategory', { student });
          }

        } else if (categoryKey === 'abilities') {
          const word = await cat3Api.getNextWord(student.sid);
          if (word && word.id) {
            navigation.replace('Cat3Phase1', {
              student,
              wordId:    word.id,
              wordKey:   word.asset_key,
              wordLabel: word.word,
              sessionId: null,
            });
          } else {
            navigation.replace('DialogueCategory', { student });
          }
        }
      } catch (err) {
        setError('Could not load next word. Please try again.');
      }
    }
    loadNextWord();
  }, []);

  return (
    <View style={{ flex: 1, backgroundColor: theme.background }}>
      <SafeAreaView style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: 16 }}>
        <ActivityIndicator size="large" color={theme.button} />
        {error && (
          <Text style={{ color: '#FF4D6D', fontWeight: '600', textAlign: 'center', paddingHorizontal: 32 }}>
            {error}
          </Text>
        )}
      </SafeAreaView>
    </View>
  );
}
