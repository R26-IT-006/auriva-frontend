import AvatarSelectScreen from '../screens/handwriting/AvatarSelectScreen';
import InstructionScreen from '../screens/handwriting/InstructionScreen';
import WelcomeScreen from '../screens/handwriting/WelcomeScreen';
import React from 'react';
import { View, Text } from 'react-native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';

// TODO: create this screen
const ShapeAssessmentScreen = () => (
  <View><Text>ShapeAssessment</Text></View>
);

// TODO: create this screen
const AssessmentCompleteScreen = () => (
  <View><Text>AssessmentComplete</Text></View>
);

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
  const { student } = route.params;

  return (
    <Stack.Navigator screenOptions={screenOptions}>
      <Stack.Screen
        name="AvatarSelect"
        component={AvatarSelectScreen}
        initialParams={{ student }}
      />
      <Stack.Screen
        name="Instructions"
        component={InstructionScreen}
        initialParams={{ student }}
      />
      <Stack.Screen
        name="Welcome"
        component={WelcomeScreen}
        initialParams={{ student }}
      />
      <Stack.Screen
        name="ShapeAssessment"
        component={ShapeAssessmentScreen}
        initialParams={{ student }}
      />
      <Stack.Screen
        name="AssessmentComplete"
        component={AssessmentCompleteScreen}
        initialParams={{ student }}
      />
      <Stack.Screen
        name="LetterHome"
        component={LetterHomeScreen}
        initialParams={{ student }}
      />
      <Stack.Screen
        name="LetterPractice"
        component={LetterPracticeScreen}
        initialParams={{ student }}
      />
      <Stack.Screen
        name="WordLearning"
        component={WordLearningScreen}
        initialParams={{ student }}
      />
      <Stack.Screen
        name="HandwritingReport"
        component={HandwritingReportScreen}
        initialParams={{ student }}
      />
    </Stack.Navigator>
  );
}
