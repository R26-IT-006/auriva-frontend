import React, { useState, useRef, useEffect } from "react";
import { Animated, View } from "react-native";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { Colors } from "../constants/colors";

// Screens
import PrincipalDashboardScreen from "../screens/principal/DashboardScreen";
import TeacherListScreen from "../screens/principal/teachers/TeacherListScreen";
import TeacherDetailScreen from "../screens/principal/teachers/TeacherDetailScreen";
import CreateTeacherScreen from "../screens/principal/teachers/CreateTeacherScreen";
import EditTeacherScreen from "../screens/principal/teachers/EditTeacherScreen";
import StudentListScreen from "../screens/principal/students/StudentListScreen";
import StudentDetailScreen from "../screens/principal/students/StudentDetailScreen";
import CreateStudentScreen from "../screens/principal/students/CreateStudentScreen";
import EditStudentScreen from "../screens/principal/students/EditStudentScreen";

import PrincipalSidebar from "../components/navigation/PrincipalSidebar";
import { SidebarContext } from "../context/SidebarContext";
import { SIDEBAR_WIDTH, MINI_WIDTH } from "../constants/principalNavigation";

const Tab = createBottomTabNavigator();
const Stack = createNativeStackNavigator();

function TeachersStack() {
  return (
    <Stack.Navigator
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: Colors.background },
      }}
    >
      <Stack.Screen name="TeacherList" component={TeacherListScreen} />
      <Stack.Screen name="TeacherDetail" component={TeacherDetailScreen} />
      <Stack.Screen name="CreateTeacher" component={CreateTeacherScreen} />
      <Stack.Screen name="EditTeacher" component={EditTeacherScreen} />
    </Stack.Navigator>
  );
}

function StudentsStack() {
  return (
    <Stack.Navigator
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: Colors.background },
      }}
    >
      <Stack.Screen name="StudentList" component={StudentListScreen} />
      <Stack.Screen name="StudentDetail" component={StudentDetailScreen} />
      <Stack.Screen name="CreateStudent" component={CreateStudentScreen} />
      <Stack.Screen name="EditStudent" component={EditStudentScreen} />
    </Stack.Navigator>
  );
}

function DashboardStack() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="PrincipalHome" component={PrincipalDashboardScreen} />
    </Stack.Navigator>
  );
}

/**
 * Renders nothing — exists only to capture the Tab navigator's `navigation`
 * object and current route name so the sidebar (rendered outside Tab.Navigator)
 * can navigate and highlight the active item.
 */
function SidebarBridge({ navigation, state, navRef, onRouteChange }) {
  const routeName = state.routes[state.index].name;

  // Always keep the ref in sync (no re-render cost)
  navRef.current = navigation;

  useEffect(() => {
    onRouteChange(routeName);
  }, [routeName, onRouteChange]);

  return null;
}

export default function PrincipalNavigator() {
  const [isOpen, setIsOpen] = useState(true);
  const [activeRoute, setActiveRoute] = useState("Dashboard");
  const sidebarAnim = useRef(new Animated.Value(SIDEBAR_WIDTH)).current;
  const navRef = useRef(null);

  function toggle() {
    const opening = !isOpen;
    setIsOpen(opening);
    Animated.timing(sidebarAnim, {
      toValue: opening ? SIDEBAR_WIDTH : MINI_WIDTH,
      duration: 220,
      useNativeDriver: false,
    }).start();
  }

  return (
    <SidebarContext.Provider value={{ isOpen, toggle, sidebarAnim }}>
      {/*
        Flex-row layout: sidebar and content are true siblings.
        When sidebarAnim transitions, the flex:1 content column resizes
        in perfect sync — no separate margin animation needed.
      */}
      <View style={{ flex: 1, flexDirection: "row" }}>
        {/* ── Sidebar column ──────────────────────────────────────── */}
        {/*
          Fixed inner width (SIDEBAR_WIDTH) + overflow:hidden means the
          sidebar always renders at full width internally and gets clipped
          at whatever the animated container width is.
        */}
        <Animated.View
          style={{
            width: sidebarAnim,
            overflow: "hidden",
          }}
        >
          <PrincipalSidebar navRef={navRef} activeRoute={activeRoute} />
        </Animated.View>

        {/* ── Content column ──────────────────────────────────────── */}
        <View style={{ flex: 1 }}>
          <Tab.Navigator
            tabBar={(props) => (
              <SidebarBridge
                {...props}
                navRef={navRef}
                onRouteChange={setActiveRoute}
              />
            )}
            screenOptions={{ headerShown: false }}
          >
            <Tab.Screen name="Dashboard" component={DashboardStack} />
            <Tab.Screen name="Teachers" component={TeachersStack} />
            <Tab.Screen name="Students" component={StudentsStack} />
          </Tab.Navigator>
        </View>
      </View>
    </SidebarContext.Provider>
  );
}
