import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../constants/colors';
import { Layout } from '../constants/layout';

// Screens
import PrincipalDashboardScreen from '../screens/principal/DashboardScreen';
import TeacherListScreen from '../screens/principal/teachers/TeacherListScreen';
import TeacherDetailScreen from '../screens/principal/teachers/TeacherDetailScreen';
import CreateTeacherScreen from '../screens/principal/teachers/CreateTeacherScreen';
import EditTeacherScreen from '../screens/principal/teachers/EditTeacherScreen';
import StudentListScreen from '../screens/principal/students/StudentListScreen';
import StudentDetailScreen from '../screens/principal/students/StudentDetailScreen';
import CreateStudentScreen from '../screens/principal/students/CreateStudentScreen';
import EditStudentScreen from '../screens/principal/students/EditStudentScreen';

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
  headerBackTitle: '',
};

function TeachersStack() {
  return (
    <Stack.Navigator screenOptions={stackOptions}>
      <Stack.Screen name="TeacherList" component={TeacherListScreen} options={{ title: 'Teachers' }} />
      <Stack.Screen name="TeacherDetail" component={TeacherDetailScreen} options={{ title: 'Teacher Profile' }} />
      <Stack.Screen name="CreateTeacher" component={CreateTeacherScreen} options={{ title: 'Add Teacher' }} />
      <Stack.Screen name="EditTeacher" component={EditTeacherScreen} options={{ title: 'Edit Teacher' }} />
    </Stack.Navigator>
  );
}

function StudentsStack() {
  return (
    <Stack.Navigator screenOptions={stackOptions}>
      <Stack.Screen name="StudentList" component={StudentListScreen} options={{ title: 'Students' }} />
      <Stack.Screen name="StudentDetail" component={StudentDetailScreen} options={{ title: 'Student Profile' }} />
      <Stack.Screen name="CreateStudent" component={CreateStudentScreen} options={{ title: 'Add Student' }} />
      <Stack.Screen name="EditStudent" component={EditStudentScreen} options={{ title: 'Edit Student' }} />
    </Stack.Navigator>
  );
}

function DashboardStack() {
  return (
    <Stack.Navigator screenOptions={stackOptions}>
      <Stack.Screen name="PrincipalHome" component={PrincipalDashboardScreen} options={{ headerShown: false }} />
    </Stack.Navigator>
  );
}

export default function PrincipalNavigator() {
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarActiveTintColor: Colors.primary,
        tabBarInactiveTintColor: Colors.icon.default,
        tabBarHideOnKeyboard: true,
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
            Dashboard: focused ? 'home' : 'home-outline',
            Teachers: focused ? 'people' : 'people-outline',
            Students: focused ? 'school' : 'school-outline',
          };
          return <Ionicons name={icons[route.name]} size={size} color={color} />;
        },
      })}
    >
      <Tab.Screen name="Dashboard" component={DashboardStack} options={{ title: 'Home' }} />
      <Tab.Screen name="Teachers" component={TeachersStack} />
      <Tab.Screen name="Students" component={StudentsStack} />
    </Tab.Navigator>
  );
}
