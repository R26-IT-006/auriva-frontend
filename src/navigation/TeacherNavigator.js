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
import ConceptCategoriesScreen        from '../screens/teacher/concept/ConceptCategoriesScreen';
import ConceptItemsScreen            from '../screens/teacher/concept/ConceptItemsScreen';
import ConceptImageScreen            from '../screens/teacher/concept/ConceptImageScreen';
import ConceptDemoScreen             from '../screens/teacher/concept/ConceptDemoScreen';
import ConceptMatchScreen            from '../screens/teacher/concept/ConceptMatchScreen';
import ConceptCongratulationsScreen  from '../screens/teacher/concept/ConceptCongratulationsScreen';

const Tab   = createBottomTabNavigator();
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
          fontFamily: 'Nunito_600SemiBold',
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
      <Stack.Screen name="AvatarSelection"    component={AvatarSelectionScreen} />
      <Stack.Screen name="ConceptCategories" component={ConceptCategoriesScreen} />
      <Stack.Screen name="ConceptItems"      component={ConceptItemsScreen} />
      <Stack.Screen name="ConceptImage"      component={ConceptImageScreen} />
      <Stack.Screen name="ConceptDemo"       component={ConceptDemoScreen} />
      <Stack.Screen name="ConceptMatch"      component={ConceptMatchScreen} />
      <Stack.Screen name="ConceptCongrats"   component={ConceptCongratulationsScreen} />
      <Stack.Screen name="StudentSession"    component={TeacherStudentDetailScreen} />
    </Stack.Navigator>
  );
}
