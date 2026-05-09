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
import DialogueLandingScreen from "../screens/teacher/students/DialogueLandingScreen";
import HandwritingNavigator from "./HandwritingNavigator";
import PronunciationSessionSetupScreen from "../screens/teacher/students/modules/pronunciationSupport/PronunciationSessionSetupScreen";
import PronunciationWordSelectionScreen from "../screens/teacher/students/modules/pronunciationSupport/PronunciationWordSelectionScreen";
import PronunciationLearnWordScreen from "../screens/teacher/students/modules/pronunciationSupport/PronunciationLearnWordScreen";
import PronunciationListenChooseScreen from "../screens/teacher/students/modules/pronunciationSupport/PronunciationListenChooseScreen";
import PronunciationMouthShapeScreen from "../screens/teacher/students/modules/pronunciationSupport/PronunciationMouthShapeScreen";
import PronunciationSpeakWordScreen from "../screens/teacher/students/modules/pronunciationSupport/PronunciationSpeakWordScreen";
import PronunciationResultScreen from "../screens/teacher/students/modules/pronunciationSupport/PronunciationResultScreen";
import PronunciationResultsHistoryScreen from "../screens/teacher/students/modules/pronunciationSupport/PronunciationResultsHistoryScreen";

const Tab = createBottomTabNavigator();
const Stack = createNativeStackNavigator();

const stackOptions = {
  headerStyle: { backgroundColor: Colors.surface },
  headerTitleStyle: {
    fontWeight: Layout.fontWeight.bold,
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
          fontSize: Layout.fontSize.xs,
          fontWeight: Layout.fontWeight.semibold,
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
        name="StudentDashboard"
        component={StudentDashboardScreen}
      />
      <Stack.Screen name="AvatarSelection" component={AvatarSelectionScreen} />
      <Stack.Screen
        name="StudentSession"
        component={TeacherStudentDetailScreen}
      />
      <Stack.Screen name="HandwritingModule" component={HandwritingNavigator} />
      <Stack.Screen name="DialogueLanding" component={DialogueLandingScreen} />
      <Stack.Screen
        name="PronunciationSessionSetup"
        component={PronunciationSessionSetupScreen}
      />
      <Stack.Screen
        name="PronunciationWordSelection"
        component={PronunciationWordSelectionScreen}
      />
      <Stack.Screen
        name="PronunciationLearnWord"
        component={PronunciationLearnWordScreen}
      />
      <Stack.Screen
        name="PronunciationListenChoose"
        component={PronunciationListenChooseScreen}
      />
      <Stack.Screen
        name="PronunciationMouthShape"
        component={PronunciationMouthShapeScreen}
      />
      <Stack.Screen
        name="PronunciationSpeakWord"
        component={PronunciationSpeakWordScreen}
      />
      <Stack.Screen
        name="PronunciationResult"
        component={PronunciationResultScreen}
      />
      <Stack.Screen
        name="PronunciationResultsHistory"
        component={PronunciationResultsHistoryScreen}
      />
    </Stack.Navigator>
  );
}
