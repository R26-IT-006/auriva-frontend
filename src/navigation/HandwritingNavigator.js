import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';

import { getAvatarTheme } from '../constants/avatarThemes';
import WelcomeScreen            from '../screens/handwriting/WelcomeScreen';
import InstructionScreen        from '../screens/handwriting/InstructionScreen';
import StudentWelcomeScreen     from '../screens/handwriting/StudentWelcomeScreen';
import ShapeAssessmentScreen    from '../screens/handwriting/ShapeAssessmentScreen';
import AssessmentCompleteScreen from '../screens/handwriting/AssessmentCompleteScreen';
import LetterHomeScreen         from '../screens/handwriting/LetterHomeScreen';
import LetterPracticeScreen     from '../screens/handwriting/LetterPracticeScreen';
import ProgressReportScreen     from '../screens/handwriting/ProgressReportScreen';
import LetterWritingScreen      from '../screens/handwriting/LetterWritingScreen';
import UppercaseWritingScreen   from '../screens/handwriting/uppercase/UppercaseWritingScreen';
import WordVideoScreen          from '../screens/handwriting/words/WordVideoScreen';
import WordActivityScreen       from '../screens/handwriting/words/WordActivityScreen';
import WordWritingScreen        from '../screens/handwriting/words/WordWritingScreen';
import WordProgressScreen       from '../screens/handwriting/words/WordProgressScreen';
import TeacherReportScreen      from '../screens/handwriting/reports/TeacherReportScreen';

const Stack = createNativeStackNavigator();

const screenOptions = { headerShown: false };

export default function HandwritingNavigator({ route }) {
  const student = route.params?.student;
  const theme   = getAvatarTheme(student?.avatar_key);

  return (
    <Stack.Navigator screenOptions={screenOptions}>
      <Stack.Screen
        name="Welcome"
        component={WelcomeScreen}
        initialParams={{ student, theme }}
      />
      <Stack.Screen
        name="Instructions"
        component={InstructionScreen}
        initialParams={{ student, theme }}
      />
      <Stack.Screen
        name="StudentWelcome"
        component={StudentWelcomeScreen}
        initialParams={{ student, theme }}
      />
      <Stack.Screen
        name="ShapeAssessment"
        component={ShapeAssessmentScreen}
        initialParams={{ student, theme }}
      />
      <Stack.Screen
        name="AssessmentComplete"
        component={AssessmentCompleteScreen}
        initialParams={{ student, theme }}
      />
      <Stack.Screen
        name="LetterHome"
        component={LetterHomeScreen}
        initialParams={{ student, theme }}
      />
      <Stack.Screen
        name="LetterPractice"
        component={LetterPracticeScreen}
        initialParams={{ student, theme }}
      />
      <Stack.Screen
        name="ProgressReport"
        component={ProgressReportScreen}
        initialParams={{ student, theme }}
      />
      <Stack.Screen
        name="LetterWriting"
        component={LetterWritingScreen}
        initialParams={{ student, theme }}
      />
      <Stack.Screen
        name="UppercaseWriting"
        component={UppercaseWritingScreen}
        initialParams={{ student, theme }}
      />
      <Stack.Screen
        name="WordVideo"
        component={WordVideoScreen}
        initialParams={{ student, theme }}
      />
      <Stack.Screen
        name="WordWriting"
        component={WordWritingScreen}
        initialParams={{ student, theme }}
      />
      <Stack.Screen
        name="WordPractice"
        component={WordActivityScreen}
        initialParams={{ student, theme }}
      />
      <Stack.Screen
        name="WordProgress"
        component={WordProgressScreen}
        initialParams={{ student, theme }}
      />
      <Stack.Screen
        name="TeacherReport"
        component={TeacherReportScreen}
        initialParams={{ student, theme }}
      />
    </Stack.Navigator>
  );
}
