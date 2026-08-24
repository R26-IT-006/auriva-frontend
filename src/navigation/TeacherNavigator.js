import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { Colors } from '../constants/colors';
import { Layout } from '../constants/layout';

import TeacherDashboardScreen    from '../screens/teacher/DashboardScreen';
import TeacherStudentListScreen  from '../screens/teacher/students/StudentListScreen';
import TeacherStudentDetailScreen from '../screens/teacher/students/StudentDetailScreen';
import ConceptReportScreen        from '../screens/teacher/students/ConceptReportScreen';
import WorkspaceSelectScreen      from '../screens/teacher/WorkspaceSelectScreen';
import StudentPickerScreen        from '../screens/teacher/students/StudentPickerScreen';
import StudentDashboardScreen     from '../screens/teacher/students/StudentDashboardScreen';
import AvatarSelectionScreen      from '../screens/teacher/students/AvatarSelectionScreen';
import ConceptCategoriesScreen        from '../screens/teacher/concept/ConceptCategoriesScreen';
import ConceptItemsScreen            from '../screens/teacher/concept/ConceptItemsScreen';
import ConceptImageScreen            from '../screens/teacher/concept/tier1/ConceptImageScreen';
import ConceptDemoScreen             from '../screens/teacher/concept/tier1/ConceptDemoScreen';
import ConceptMatchScreen            from '../screens/teacher/concept/tier1/ConceptMatchScreen';
import ConceptCongratulationsScreen  from '../screens/teacher/concept/ConceptCongratulationsScreen';
import ConceptAdaptiveQuizScreen     from '../screens/teacher/concept/tier1/ConceptAdaptiveQuizScreen';
import Tier2ImageScreen              from '../screens/teacher/concept/tier2/Tier2ImageScreen';
import Tier2DemoScreen               from '../screens/teacher/concept/tier2/Tier2DemoScreen';
import Tier2ActivityScreen           from '../screens/teacher/concept/tier2/Tier2ActivityScreen';
import Tier2DragDropScreen           from '../screens/teacher/concept/tier2/Tier2DragDropScreen';
import Tier3VideoScreen              from '../screens/teacher/concept/tier3/Tier3VideoScreen';
import ConceptColoringScreen              from '../screens/teacher/concept/tier3/ConceptColoringScreen';
import ConceptActivityScreen              from '../screens/teacher/concept/tier1/ConceptActivityScreen';
import ConceptBasketSortScreen            from '../screens/teacher/concept/conclusion/ConceptBasketSortScreen';
import StudentConceptProgressScreen      from '../screens/teacher/concept/StudentConceptProgressScreen';

const Stack = createNativeStackNavigator();

const stackOptions = {
  headerStyle: { backgroundColor: Colors.surface },
  headerTitleStyle: {
    fontFamily: 'DMSans_700Bold',
    color: Colors.text.primary,
    fontSize: Layout.fontSize.lg,
  },
  headerTintColor: Colors.primary,
  headerShadowVisible: true,
  contentStyle: { backgroundColor: Colors.background },
  headerBackTitle: '',
};

// The teacher workspace — reached via "Teacher Workspace". A single stack: the
// dashboard is the entry point and navigates onward to the student screens.
function TeacherWorkspace() {
  return (
    <Stack.Navigator screenOptions={stackOptions}>
      <Stack.Screen name="TeacherHome"          component={TeacherDashboardScreen}   options={{ headerShown: false }} />
      <Stack.Screen name="TeacherStudentList"   component={TeacherStudentListScreen}  options={{ title: 'My Students' }} />
      <Stack.Screen name="TeacherStudentDetail" component={TeacherStudentDetailScreen} options={{ title: 'Student Profile' }} />
      {/* Kept in this stack, not the root one, so the report keeps Colors theming
          rather than the student-workspace chrome. */}
      <Stack.Screen name="ConceptReport"        component={ConceptReportScreen}        options={{ title: 'Concept Report' }} />
    </Stack.Navigator>
  );
}

// Root stack: WorkspaceSelect → TeacherMain (tabs) or StudentPicker → StudentSession
export default function TeacherNavigator() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="WorkspaceSelect" component={WorkspaceSelectScreen} />
      <Stack.Screen name="TeacherMain"     component={TeacherWorkspace} />
      <Stack.Screen name="StudentPicker"    component={StudentPickerScreen} />
      <Stack.Screen name="StudentDashboard"   component={StudentDashboardScreen} />
      <Stack.Screen name="AvatarSelection"    component={AvatarSelectionScreen} />
      <Stack.Screen name="ConceptCategories" component={ConceptCategoriesScreen} />
      <Stack.Screen name="ConceptItems"      component={ConceptItemsScreen} />
      <Stack.Screen name="ConceptImage"      component={ConceptImageScreen} />
      <Stack.Screen name="ConceptDemo"       component={ConceptDemoScreen} />
      <Stack.Screen name="ConceptMatch"      component={ConceptMatchScreen} />
      <Stack.Screen name="ConceptCongrats"      component={ConceptCongratulationsScreen} />
      <Stack.Screen name="ConceptAdaptiveQuiz" component={ConceptAdaptiveQuizScreen} />
      <Stack.Screen name="Tier2Image"          component={Tier2ImageScreen} />
      <Stack.Screen name="Tier2Demo"           component={Tier2DemoScreen} />
      <Stack.Screen name="Tier2Activity"       component={Tier2ActivityScreen} />
      <Stack.Screen name="Tier2DragDrop"       component={Tier2DragDropScreen} />
      <Stack.Screen name="Tier3Video"          component={Tier3VideoScreen} />
      <Stack.Screen name="ConceptColoring"          component={ConceptColoringScreen} />
      <Stack.Screen name="ConceptActivity"          component={ConceptActivityScreen} />
      <Stack.Screen name="ConceptBasketSort"        component={ConceptBasketSortScreen} />
      <Stack.Screen name="StudentConceptProgress"   component={StudentConceptProgressScreen} />
      <Stack.Screen name="StudentSession"    component={TeacherStudentDetailScreen} />
    </Stack.Navigator>
  );
}
