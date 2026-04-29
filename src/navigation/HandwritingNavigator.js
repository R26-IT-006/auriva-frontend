import React from 'react';
import { View, Text } from 'react-native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';

import { getAvatarTheme } from '../constants/avatarThemes';
import WelcomeScreen from '../screens/handwriting/WelcomeScreen';
import InstructionScreen from '../screens/handwriting/InstructionScreen';
import LetterHomeScreen from '../screens/handwriting/LetterHomeScreen';

const ChildWelcomeScreen = ({ route }) => (
  <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
    <Text>ChildWelcome placeholder</Text>
  </View>
);

const ShapeAssessmentScreen = ({ route }) => (
  <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
    <Text>ShapeAssessment placeholder</Text>
  </View>
);

const AssessmentCompleteScreen = ({ route }) => (
  <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
    <Text>AssessmentComplete placeholder</Text>
  </View>
);

const LetterPracticeScreen = ({ route }) => (
  <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
    <Text>LetterPractice placeholder</Text>
  </View>
);

const WordLearningScreen = ({ route }) => (
  <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
    <Text>WordLearning placeholder</Text>
  </View>
);

const HandwritingReportScreen = ({ route }) => (
  <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
    <Text>HandwritingReport placeholder</Text>
  </View>
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
