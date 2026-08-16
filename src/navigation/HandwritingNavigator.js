import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';

import { getAvatarTheme } from '../constants/avatarThemes';
import WelcomeScreen            from '../screens/teacher/handwriting/WelcomeScreen';
import InstructionScreen        from '../screens/teacher/handwriting/InstructionScreen';
import StudentWelcomeScreen     from '../screens/teacher/handwriting/StudentWelcomeScreen';
import ShapeAssessmentScreen    from '../screens/teacher/handwriting/ShapeAssessmentScreen';
import PreWritingActivityScreen from '../screens/teacher/handwriting/PreWritingActivityScreen';
import AssessmentCompleteScreen from '../screens/teacher/handwriting/AssessmentCompleteScreen';
import LetterHomeScreen         from '../screens/teacher/handwriting/LetterHomeScreen';
import LetterPracticeScreen     from '../screens/teacher/handwriting/LetterPracticeScreen';
import ProgressReportScreen     from '../screens/teacher/handwriting/ProgressReportScreen';
import LetterWritingScreen      from '../screens/teacher/handwriting/LetterWritingScreen';
import UppercaseWritingScreen   from '../screens/teacher/handwriting/uppercase/UppercaseWritingScreen';
import WordVideoScreen          from '../screens/teacher/handwriting/words/WordVideoScreen';
import WordActivityScreen       from '../screens/teacher/handwriting/words/WordActivityScreen';
import WordWritingScreen        from '../screens/teacher/handwriting/words/WordWritingScreen';
import WordProgressScreen       from '../screens/teacher/handwriting/words/WordProgressScreen';
import WordLetterSelectScreen   from '../screens/teacher/handwriting/words/WordLetterSelectScreen';
import TeacherReportScreen        from '../screens/teacher/handwriting/reports/TeacherReportScreen';
import DataCollectionDoneScreen  from '../screens/teacher/handwriting/DataCollectionDoneScreen';

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
        name="PreWritingActivity"
        component={PreWritingActivityScreen}
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
        name="WordLetterSelect"
        component={WordLetterSelectScreen}
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
      <Stack.Screen
        name="DataCollectionDone"
        component={DataCollectionDoneScreen}
        initialParams={{ student, theme }}
      />
    </Stack.Navigator>
  );
}
