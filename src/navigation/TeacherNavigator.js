import React from "react"; // required for JSX
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { Ionicons } from "@expo/vector-icons";
import { Colors } from "../constants/colors";
import { Layout } from "../constants/layout";

import TeacherDashboardScreen from "../screens/teacher/DashboardScreen";
import TeacherStudentListScreen from "../screens/teacher/students/StudentListScreen";
import TeacherStudentDetailScreen from "../screens/teacher/students/StudentDetailScreen";
import WorkspaceSelectScreen from "../screens/teacher/WorkspaceSelectScreen";
import StudentPickerScreen from "../screens/teacher/students/StudentPickerScreen";
import StudentDashboardScreen from "../screens/teacher/students/StudentDashboardScreen";
import AvatarSelectionScreen from "../screens/teacher/students/AvatarSelectionScreen";
import HandwritingNavigator from "./HandwritingNavigator";
import TeacherReportScreen from "../screens/handwriting/reports/TeacherReportScreen";
import DialogueLandingScreen      from '../screens/teacher/students/DialogueLandingScreen';
import DialogueCategoryScreen     from '../screens/teacher/dialogue/DialogueCategoryScreen';
import Level1OverviewScreen       from '../screens/teacher/dialogue/Level1OverviewScreen';
import AnimatedWordScreen         from '../screens/teacher/dialogue/AnimatedWordScreen';
import BoldWordScreen             from '../screens/teacher/dialogue/BoldWordScreen';
import ProbeProductionScreen      from '../screens/teacher/dialogue/ProbeProductionScreen';
import ProbeRetentionCheckScreen  from '../screens/teacher/dialogue/ProbeRetentionCheckScreen';
import MagicWordLandingScreen     from '../screens/teacher/dialogue/magic-words/MagicWordLandingScreen';
import Phase1VideoScreen          from '../screens/teacher/dialogue/magic-words/Phase1VideoScreen';
import DragToLineScreen           from '../screens/teacher/dialogue/magic-words/DragToLineScreen';
import Phase1CompleteScreen       from '../screens/teacher/dialogue/magic-words/Phase1CompleteScreen';
import Phase2ProductionScreen    from '../screens/teacher/dialogue/magic-words/Phase2ProductionScreen';
import Phase2NonVerbalScreen     from '../screens/teacher/dialogue/magic-words/Phase2NonVerbalScreen';
import Phase3ContextualScreen    from '../screens/teacher/dialogue/magic-words/Phase3ContextualScreen';
import WordCompleteScreen         from '../screens/teacher/dialogue/WordCompleteScreen';
import VerbActivityScreen              from '../screens/teacher/dialogue/abilities/VerbActivityScreen';
import ClapActivityScreen             from '../screens/teacher/dialogue/abilities/ClapActivityScreen';
import RunActivityScreen              from '../screens/teacher/dialogue/abilities/RunActivityScreen';
import Cat3LandingScreen              from '../screens/teacher/dialogue/abilities/Cat3LandingScreen';
import Cat3Phase1Screen               from '../screens/teacher/dialogue/abilities/Cat3Phase1Screen';
import Cat3DragToLineScreen           from '../screens/teacher/dialogue/abilities/Cat3DragToLineScreen';
import Cat3Phase2Screen               from '../screens/teacher/dialogue/abilities/Cat3Phase2Screen';
import Cat3Phase2NonVerbalScreen      from '../screens/teacher/dialogue/abilities/Cat3Phase2NonVerbalScreen';
import Cat3Phase3Screen               from '../screens/teacher/dialogue/abilities/Cat3Phase3Screen';
import Cat3WordCompleteScreen         from '../screens/teacher/dialogue/abilities/Cat3WordCompleteScreen';
import GreetingLandingScreen      from '../screens/teacher/dialogue/greetings/GreetingLandingScreen';
import GreetingPhase1VideoScreen  from '../screens/teacher/dialogue/greetings/GreetingPhase1VideoScreen';
import GreetingDragToLineScreen   from '../screens/teacher/dialogue/greetings/GreetingDragToLineScreen';
import GreetingPhase1CompleteScreen from '../screens/teacher/dialogue/greetings/GreetingPhase1CompleteScreen';
import GreetingPhase2ProductionScreen from '../screens/teacher/dialogue/greetings/GreetingPhase2ProductionScreen';
import GreetingPhase2NonVerbalScreen  from '../screens/teacher/dialogue/greetings/GreetingPhase2NonVerbalScreen';
import GreetingPhase3ContextualScreen from '../screens/teacher/dialogue/greetings/GreetingPhase3ContextualScreen';

// Evaluations (TASK-15)
import EvaluationMenuScreen  from '../screens/teacher/dialogue/evaluations/EvaluationMenuScreen';
import EvaluationMatchScreen from '../screens/teacher/dialogue/evaluations/EvaluationMatchScreen';

// Level 2 – Sentence Construction
import L2TopicSelectionScreen  from '../screens/teacher/dialogue/level2/L2TopicSelectionScreen';
import L2QuestionnaireScreen   from '../screens/teacher/dialogue/level2/L2QuestionnaireScreen';
import L2LoadingScreen         from '../screens/teacher/dialogue/level2/L2LoadingScreen';
import L2ContrastiveScreen     from '../screens/teacher/dialogue/level2/L2ContrastiveScreen';
import L2SentencePathScreen    from '../screens/teacher/dialogue/level2/L2SentencePathScreen';
import L2SentenceTeachScreen   from '../screens/teacher/dialogue/level2/L2SentenceTeachScreen';
import L2ListenTogetherScreen  from '../screens/teacher/dialogue/level2/L2ListenTogetherScreen';
import L2ProductionScreen      from '../screens/teacher/dialogue/level2/L2ProductionScreen';
import L2SessionCompleteScreen from '../screens/teacher/dialogue/level2/L2SessionCompleteScreen';
import ConceptCategoriesScreen        from '../screens/teacher/concept/ConceptCategoriesScreen';
import ConceptItemsScreen            from '../screens/teacher/concept/ConceptItemsScreen';
import ConceptImageScreen            from '../screens/teacher/concept/ConceptImageScreen';
import ConceptDemoScreen             from '../screens/teacher/concept/ConceptDemoScreen';
import ConceptMatchScreen            from '../screens/teacher/concept/ConceptMatchScreen';
import ConceptCongratulationsScreen  from '../screens/teacher/concept/ConceptCongratulationsScreen';
import ConceptAdaptiveQuizScreen     from '../screens/teacher/concept/ConceptAdaptiveQuizScreen';
import Tier2ImageScreen              from '../screens/teacher/concept/Tier2ImageScreen';
import Tier2ActivityScreen           from '../screens/teacher/concept/Tier2ActivityScreen';
import Tier2DragDropScreen           from '../screens/teacher/concept/Tier2DragDropScreen';
import Tier3VideoScreen              from '../screens/teacher/concept/Tier3VideoScreen';
import ConceptColoringScreen              from '../screens/teacher/concept/ConceptColoringScreen';
import ConceptActivityScreen              from '../screens/teacher/concept/ConceptActivityScreen';
import StudentConceptProgressScreen      from '../screens/teacher/concept/StudentConceptProgressScreen';
import L2PortraitScreen        from '../screens/teacher/dialogue/level2/L2PortraitScreen';

const Tab = createBottomTabNavigator();
const Stack = createNativeStackNavigator();

const stackOptions = {
  headerStyle: { backgroundColor: Colors.surface },
  headerTitleStyle: {
    fontFamily: 'Nunito_700Bold',
    color: Colors.text.primary,
    fontSize: Layout.fontSize.lg,
  },
  headerTintColor: Colors.primary,
  headerShadowVisible: true,
  contentStyle: { backgroundColor: Colors.background },
  headerBackTitle: "",
};

function DashboardStack() {
  return (
    <Stack.Navigator screenOptions={stackOptions}>
      <Stack.Screen
        name="TeacherHome"
        component={TeacherDashboardScreen}
        options={{ headerShown: false }}
      />
    </Stack.Navigator>
  );
}

function StudentsStack() {
  return (
    <Stack.Navigator screenOptions={stackOptions}>
      <Stack.Screen
        name="TeacherStudentList"
        component={TeacherStudentListScreen}
        options={{ title: "My Students" }}
      />
      <Stack.Screen
        name="TeacherStudentDetail"
        component={TeacherStudentDetailScreen}
        options={{ title: "Student Profile" }}
      />
      <Stack.Screen
        name="StudentHandwritingReport"
        component={TeacherReportScreen}
        options={{ headerShown: false }}
      />
    </Stack.Navigator>
  );
}

// The full teacher tab UI — reached via "Teacher Workspace"
function TeacherTabs() {
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarActiveTintColor: Colors.primary,
        tabBarInactiveTintColor: Colors.icon.default,
        tabBarStyle: {
          backgroundColor: Colors.surface,
          borderTopColor: Colors.borderLight,
          borderTopWidth: 1,
          height: Layout.tabBarHeight,
          paddingBottom: 8,
          paddingTop: 6,
        },
        tabBarLabelStyle: {
          fontSize:   Layout.fontSize.xs,
          fontFamily: 'Nunito_600SemiBold',
        },
        tabBarIcon: ({ color, size, focused }) => {
          const icons = {
            Dashboard: focused ? "home" : "home-outline",
            Students: focused ? "people" : "people-outline",
          };
          return (
            <Ionicons name={icons[route.name]} size={size} color={color} />
          );
        },
      })}
    >
      <Tab.Screen
        name="Dashboard"
        component={DashboardStack}
        options={{ title: "Home" }}
      />
      <Tab.Screen
        name="Students"
        component={StudentsStack}
        options={{ title: "My Students" }}
      />
    </Tab.Navigator>
  );
}

// Root stack: WorkspaceSelect → TeacherMain (tabs) or StudentPicker → StudentSession
export default function TeacherNavigator() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="WorkspaceSelect" component={WorkspaceSelectScreen} />
      <Stack.Screen name="TeacherMain" component={TeacherTabs} />
      <Stack.Screen name="StudentPicker" component={StudentPickerScreen} />
      <Stack.Screen
        name="StudentSession"
        component={TeacherStudentDetailScreen}
      />
      <Stack.Screen name="StudentDashboard"   component={StudentDashboardScreen} />
      <Stack.Screen name="AvatarSelection"   component={AvatarSelectionScreen} />
      <Stack.Screen name="HandwritingModule" component={HandwritingNavigator} />
      <Stack.Screen name="ConceptCategories" component={ConceptCategoriesScreen} />
      <Stack.Screen name="ConceptItems"      component={ConceptItemsScreen} />
      <Stack.Screen name="ConceptImage"      component={ConceptImageScreen} />
      <Stack.Screen name="ConceptDemo"       component={ConceptDemoScreen} />
      <Stack.Screen name="ConceptMatch"      component={ConceptMatchScreen} />
      <Stack.Screen name="ConceptCongrats"      component={ConceptCongratulationsScreen} />
      <Stack.Screen name="ConceptAdaptiveQuiz" component={ConceptAdaptiveQuizScreen} />
      <Stack.Screen name="Tier2Image"          component={Tier2ImageScreen} />
      <Stack.Screen name="Tier2Activity"       component={Tier2ActivityScreen} />
      <Stack.Screen name="Tier2DragDrop"       component={Tier2DragDropScreen} />
      <Stack.Screen name="Tier3Video"          component={Tier3VideoScreen} />
      <Stack.Screen name="ConceptColoring"          component={ConceptColoringScreen} />
      <Stack.Screen name="ConceptActivity"          component={ConceptActivityScreen} />
      <Stack.Screen name="StudentConceptProgress"   component={StudentConceptProgressScreen} />
      <Stack.Screen name="DialogueLanding"   component={DialogueLandingScreen} />
      <Stack.Screen name="DialogueCategory"  component={DialogueCategoryScreen} />
      <Stack.Screen name="Level1Overview"    component={Level1OverviewScreen} />
      <Stack.Screen name="AnimatedWord"      component={AnimatedWordScreen} />
      <Stack.Screen name="BoldWord"          component={BoldWordScreen} />

      {/* Rule 5 — periodic production probe (TASK-39), shared across all 3 categories */}
      <Stack.Screen name="ProbeProduction"     component={ProbeProductionScreen} />
      <Stack.Screen name="ProbeRetentionCheck" component={ProbeRetentionCheckScreen} />

      <Stack.Screen name="MagicWordLanding"  component={MagicWordLandingScreen} />
      <Stack.Screen name="Phase1Video"       component={Phase1VideoScreen} />
      <Stack.Screen name="DragToLine"        component={DragToLineScreen} />
      <Stack.Screen name="Phase1Complete"    component={Phase1CompleteScreen} />
      <Stack.Screen name="Phase2Production"  component={Phase2ProductionScreen} />
      <Stack.Screen name="Phase2NonVerbal"   component={Phase2NonVerbalScreen} />
      <Stack.Screen name="Phase3Contextual"  component={Phase3ContextualScreen} />
      <Stack.Screen name="WordComplete"      component={WordCompleteScreen} />
      <Stack.Screen name="VerbActivity"         component={VerbActivityScreen} />
      <Stack.Screen name="ClapActivity"         component={ClapActivityScreen} />
      <Stack.Screen name="RunActivity"          component={RunActivityScreen} />
      <Stack.Screen name="Cat3Landing"          component={Cat3LandingScreen} />
      <Stack.Screen name="Cat3Phase1"           component={Cat3Phase1Screen} />
      <Stack.Screen name="Cat3DragToLine"       component={Cat3DragToLineScreen} />
      <Stack.Screen name="Cat3Phase2"           component={Cat3Phase2Screen} />
      <Stack.Screen name="Cat3Phase2NonVerbal"  component={Cat3Phase2NonVerbalScreen} />
      <Stack.Screen name="Cat3Phase3"           component={Cat3Phase3Screen} />
      <Stack.Screen name="Cat3WordComplete"     component={Cat3WordCompleteScreen} />

      {/* Greetings */}
      <Stack.Screen name="GreetingLanding"           component={GreetingLandingScreen} />
      <Stack.Screen name="GreetingPhase1Video"        component={GreetingPhase1VideoScreen} />
      <Stack.Screen name="GreetingDragToLine"         component={GreetingDragToLineScreen} />
      <Stack.Screen name="GreetingPhase1Complete"     component={GreetingPhase1CompleteScreen} />
      <Stack.Screen name="GreetingPhase2Production"   component={GreetingPhase2ProductionScreen} />
      <Stack.Screen name="GreetingPhase2NonVerbal"    component={GreetingPhase2NonVerbalScreen} />
      <Stack.Screen name="GreetingPhase3Contextual"   component={GreetingPhase3ContextualScreen} />

      {/* Evaluations */}
      <Stack.Screen name="EvaluationMenu"   component={EvaluationMenuScreen} />
      <Stack.Screen name="EvaluationMatch"  component={EvaluationMatchScreen} />

      {/* Level 2 – Sentence Construction */}
      <Stack.Screen name="L2TopicSelection"  component={L2TopicSelectionScreen} />
      <Stack.Screen name="L2Questionnaire"   component={L2QuestionnaireScreen} />
      <Stack.Screen name="L2Loading"         component={L2LoadingScreen} />
      <Stack.Screen name="L2Contrastive"     component={L2ContrastiveScreen} />
      <Stack.Screen name="L2SentencePath"    component={L2SentencePathScreen} />
      <Stack.Screen name="L2SentenceTeach"   component={L2SentenceTeachScreen} />
      <Stack.Screen name="L2ListenTogether"  component={L2ListenTogetherScreen} />
      <Stack.Screen name="L2Production"      component={L2ProductionScreen} />
      <Stack.Screen name="L2SessionComplete" component={L2SessionCompleteScreen} />
      <Stack.Screen name="L2Portrait"        component={L2PortraitScreen} />

    </Stack.Navigator>
  );
}