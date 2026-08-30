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
import WritingCheckScreen         from '../screens/teacher/handwriting/WritingCheckScreen';
import DataCollectionDoneScreen  from '../screens/teacher/handwriting/DataCollectionDoneScreen';
// One-time "watch first" demonstrations. A pure detour screen: it renders an
// animation of the SAME reference path the next activity uses, then replaces
// itself with that activity. See screens/teacher/handwriting/HandwritingDemoScreen.js.
import HandwritingDemoScreen     from '../screens/teacher/handwriting/HandwritingDemoScreen';
// Proposal FR-13, Phase 7A — one central session-duration mechanism for
// the whole handwriting flow (prewriting/lowercase/uppercase/word
// writing-practice only — never teacher report/setup/login). Mounted once
// here so its lifetime matches "one continuous visit to the handwriting
// flow for one student" — see LearningSessionContext.js's own header.
import { LearningSessionProvider } from '../context/LearningSessionContext';

const Stack = createNativeStackNavigator();

const screenOptions = { headerShown: false };

export default function HandwritingNavigator({ route }) {
  const student = route.params?.student;
  const theme   = getAvatarTheme(student?.avatar_key);

  return (
    <LearningSessionProvider>
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
      {/* Demonstration detour — child-facing, landscape, writes nothing. */}
      <Stack.Screen
        name="HandwritingDemo"
        component={HandwritingDemoScreen}
        initialParams={{ student, theme }}
      />
      {/* Writing Check — teacher-initiated, descriptive assessment only. */}
      <Stack.Screen
        name="WritingCheck"
        component={WritingCheckScreen}
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
    </LearningSessionProvider>
  );
}
