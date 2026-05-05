import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../constants/colors';
import { Layout } from '../constants/layout';

import TeacherDashboardScreen    from '../screens/teacher/DashboardScreen';
import TeacherStudentListScreen  from '../screens/teacher/students/StudentListScreen';
import TeacherStudentDetailScreen from '../screens/teacher/students/StudentDetailScreen';
import WorkspaceSelectScreen      from '../screens/teacher/WorkspaceSelectScreen';
import StudentPickerScreen        from '../screens/teacher/students/StudentPickerScreen';
import StudentDashboardScreen     from '../screens/teacher/students/StudentDashboardScreen';
import AvatarSelectionScreen      from '../screens/teacher/students/AvatarSelectionScreen';
import DialogueLandingScreen      from '../screens/teacher/students/DialogueLandingScreen';
import DialogueCategoryScreen     from '../screens/teacher/dialogue/DialogueCategoryScreen';
import Level1OverviewScreen       from '../screens/teacher/dialogue/Level1OverviewScreen';
import MagicWordLandingScreen     from '../screens/teacher/dialogue/magic-words/MagicWordLandingScreen';
import Phase1VideoScreen          from '../screens/teacher/dialogue/magic-words/Phase1VideoScreen';
import DragToLineScreen           from '../screens/teacher/dialogue/magic-words/DragToLineScreen';
import Phase1CompleteScreen       from '../screens/teacher/dialogue/magic-words/Phase1CompleteScreen';
import Phase2ProductionScreen    from '../screens/teacher/dialogue/magic-words/Phase2ProductionScreen';
import Phase2NonVerbalScreen     from '../screens/teacher/dialogue/magic-words/Phase2NonVerbalScreen';
import Phase3ContextualScreen    from '../screens/teacher/dialogue/magic-words/Phase3ContextualScreen';
import WordCompleteScreen         from '../screens/teacher/dialogue/WordCompleteScreen';
import VerbActivityScreen         from '../screens/teacher/dialogue/abilities/VerbActivityScreen';
import ClapActivityScreen         from '../screens/teacher/dialogue/abilities/ClapActivityScreen';
import RunActivityScreen          from '../screens/teacher/dialogue/abilities/RunActivityScreen';
import DaysLandingScreen          from '../screens/teacher/dialogue/days-of-week/DaysLandingScreen';
import DaysPhase1CalendarScreen   from '../screens/teacher/dialogue/days-of-week/DaysPhase1CalendarScreen';
import DaysDragToLineScreen       from '../screens/teacher/dialogue/days-of-week/DaysDragToLineScreen';
import DaysPhase2ProductionScreen from '../screens/teacher/dialogue/days-of-week/DaysPhase2ProductionScreen';
import DaysPhase2NonVerbalScreen  from '../screens/teacher/dialogue/days-of-week/DaysPhase2NonVerbalScreen';
import DaysPhase3SequenceScreen   from '../screens/teacher/dialogue/days-of-week/DaysPhase3SequenceScreen';
import DaysSpinningWheelScreen    from '../screens/teacher/dialogue/days-of-week/DaysSpinningWheelScreen';
import DaysMenuScreen             from '../screens/teacher/dialogue/days-of-week/DaysMenuScreen';
import GreetingLandingScreen      from '../screens/teacher/dialogue/greetings/GreetingLandingScreen';
import GreetingPhase1VideoScreen  from '../screens/teacher/dialogue/greetings/GreetingPhase1VideoScreen';
import GreetingDragToLineScreen   from '../screens/teacher/dialogue/greetings/GreetingDragToLineScreen';
import GreetingPhase1CompleteScreen from '../screens/teacher/dialogue/greetings/GreetingPhase1CompleteScreen';
import GreetingPhase2ProductionScreen from '../screens/teacher/dialogue/greetings/GreetingPhase2ProductionScreen';
import GreetingPhase2NonVerbalScreen  from '../screens/teacher/dialogue/greetings/GreetingPhase2NonVerbalScreen';
import GreetingPhase3ContextualScreen from '../screens/teacher/dialogue/greetings/GreetingPhase3ContextualScreen';

const Tab   = createBottomTabNavigator();
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
  headerBackTitle: '',
};

function DashboardStack() {
  return (
    <Stack.Navigator screenOptions={stackOptions}>
      <Stack.Screen name="TeacherHome" component={TeacherDashboardScreen} options={{ headerShown: false }} />
    </Stack.Navigator>
  );
}

function StudentsStack() {
  return (
    <Stack.Navigator screenOptions={stackOptions}>
      <Stack.Screen name="TeacherStudentList"   component={TeacherStudentListScreen}  options={{ title: 'My Students' }} />
      <Stack.Screen name="TeacherStudentDetail" component={TeacherStudentDetailScreen} options={{ title: 'Student Profile' }} />
    </Stack.Navigator>
  );
}

// The full teacher tab UI — reached via "Teacher Workspace"
function TeacherTabs() {
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarActiveTintColor:   Colors.primary,
        tabBarInactiveTintColor: Colors.icon.default,
        tabBarStyle: {
          backgroundColor: Colors.surface,
          borderTopColor:  Colors.borderLight,
          borderTopWidth:  1,
          height:          Layout.tabBarHeight,
          paddingBottom:   8,
          paddingTop:      6,
        },
        tabBarLabelStyle: {
          fontSize:   Layout.fontSize.xs,
          fontWeight: Layout.fontWeight.semibold,
        },
        tabBarIcon: ({ color, size, focused }) => {
          const icons = {
            Dashboard: focused ? 'home'   : 'home-outline',
            Students:  focused ? 'people' : 'people-outline',
          };
          return <Ionicons name={icons[route.name]} size={size} color={color} />;
        },
      })}
    >
      <Tab.Screen name="Dashboard" component={DashboardStack} options={{ title: 'Home' }} />
      <Tab.Screen name="Students"  component={StudentsStack}  options={{ title: 'My Students' }} />
    </Tab.Navigator>
  );
}

// Root stack: WorkspaceSelect → TeacherMain (tabs) or StudentPicker → StudentSession
export default function TeacherNavigator() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="WorkspaceSelect" component={WorkspaceSelectScreen} />
      <Stack.Screen name="TeacherMain"     component={TeacherTabs} />
      <Stack.Screen name="StudentPicker"    component={StudentPickerScreen} />
      <Stack.Screen name="StudentDashboard"   component={StudentDashboardScreen} />
      <Stack.Screen name="AvatarSelection"   component={AvatarSelectionScreen} />
      <Stack.Screen name="StudentSession"    component={TeacherStudentDetailScreen} />
      <Stack.Screen name="DialogueLanding"   component={DialogueLandingScreen} />
      <Stack.Screen name="DialogueCategory"  component={DialogueCategoryScreen} />
      <Stack.Screen name="Level1Overview"    component={Level1OverviewScreen} />
      <Stack.Screen name="MagicWordLanding"  component={MagicWordLandingScreen} />
      <Stack.Screen name="Phase1Video"       component={Phase1VideoScreen} />
      <Stack.Screen name="DragToLine"        component={DragToLineScreen} />
      <Stack.Screen name="Phase1Complete"    component={Phase1CompleteScreen} />
      <Stack.Screen name="Phase2Production"  component={Phase2ProductionScreen} />
      <Stack.Screen name="Phase2NonVerbal"   component={Phase2NonVerbalScreen} />
      <Stack.Screen name="Phase3Contextual"  component={Phase3ContextualScreen} />
      <Stack.Screen name="WordComplete"      component={WordCompleteScreen} />
      <Stack.Screen name="VerbActivity"      component={VerbActivityScreen} />
      <Stack.Screen name="ClapActivity"      component={ClapActivityScreen} />
      <Stack.Screen name="RunActivity"       component={RunActivityScreen} />

      {/* Greetings */}
      <Stack.Screen name="GreetingLanding"           component={GreetingLandingScreen} />
      <Stack.Screen name="GreetingPhase1Video"        component={GreetingPhase1VideoScreen} />
      <Stack.Screen name="GreetingDragToLine"         component={GreetingDragToLineScreen} />
      <Stack.Screen name="GreetingPhase1Complete"     component={GreetingPhase1CompleteScreen} />
      <Stack.Screen name="GreetingPhase2Production"   component={GreetingPhase2ProductionScreen} />
      <Stack.Screen name="GreetingPhase2NonVerbal"    component={GreetingPhase2NonVerbalScreen} />
      <Stack.Screen name="GreetingPhase3Contextual"   component={GreetingPhase3ContextualScreen} />

      {/* Days of the Week */}
      <Stack.Screen name="DaysMenuScreen"        component={DaysMenuScreen} />
      <Stack.Screen name="DaysLanding"          component={DaysLandingScreen} />
      <Stack.Screen name="DaysPhase1Calendar"   component={DaysPhase1CalendarScreen} />
      <Stack.Screen name="DaysDragToLine"       component={DaysDragToLineScreen} />
      <Stack.Screen name="DaysPhase2Production" component={DaysPhase2ProductionScreen} />
      <Stack.Screen name="DaysPhase2NonVerbal"  component={DaysPhase2NonVerbalScreen} />
      <Stack.Screen name="DaysPhase3Sequence"   component={DaysPhase3SequenceScreen} />
      <Stack.Screen name="DaysSpinningWheel"    component={DaysSpinningWheelScreen} />

    </Stack.Navigator>
  );
}
