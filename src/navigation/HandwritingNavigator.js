import React from 'react';
import { View, Text } from 'react-native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import InstructionScreen from '../screens/handwriting/InstructionScreen';
import WelcomeScreen from '../screens/handwriting/WelcomeScreen';
import ChildWelcomeScreen from '../screens/handwriting/ChildWelcomeScreen';
import ShapeAssessmentScreen from '../screens/handwriting/ShapeAssessmentScreen';
import AssessmentCompleteScreen from '../screens/handwriting/AssessmentCompleteScreen';
import { getAvatarTheme } from '../constants/avatarThemes';

// TODO: create this screen
const LetterHomeScreen = () => (
  <View><Text>LetterHome</Text></View>
);

// TODO: create this screen
const LetterPracticeScreen = () => (
  <View><Text>LetterPractice</Text></View>
);

// TODO: create this screen
const WordLearningScreen = () => (
  <View><Text>WordLearning</Text></View>
);

// TODO: create this screen
const HandwritingReportScreen = () => (
  <View><Text>HandwritingReport</Text></View>
);

const Stack = createNativeStackNavigator();

const screenOptions = { headerShown: false };

export default function HandwritingNavigator({ route }) {
  const student = route.params?.student;
  const theme = getAvatarTheme(student?.avatar_key);

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
        name="ChildWelcome"
        component={ChildWelcomeScreen}
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
        name="WordLearning"
        component={WordLearningScreen}
        initialParams={{ student, theme }}
      />
      <Stack.Screen
        name="HandwritingReport"
        component={HandwritingReportScreen}
        initialParams={{ student, theme }}
      />
    </Stack.Navigator>
  );
}
