import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { Colors } from '../constants/colors';
import { Layout } from '../constants/layout';

import TeacherDashboardScreen    from '../screens/teacher/DashboardScreen';
import TeacherStudentListScreen  from '../screens/teacher/students/StudentListScreen';
import TeacherStudentDetailScreen from '../screens/teacher/students/StudentDetailScreen';
import WorkspaceSelectScreen      from '../screens/teacher/WorkspaceSelectScreen';
import StudentPickerScreen        from '../screens/teacher/students/StudentPickerScreen';
import StudentDashboardScreen     from '../screens/teacher/students/StudentDashboardScreen';
import AvatarSelectionScreen      from '../screens/teacher/students/AvatarSelectionScreen';
import DialogueLandingScreen from '../screens/teacher/students/DialogueLandingScreen';
import HandwritingNavigator from './HandwritingNavigator';
import PronunciationSessionSetupScreen from '../screens/teacher/students/modules/pronunciationSupport/PronunciationSessionSetupScreen';
import PronunciationWordSelectionScreen from '../screens/teacher/students/modules/pronunciationSupport/PronunciationWordSelectionScreen';
import PronunciationLearnWordScreen from '../screens/teacher/students/modules/pronunciationSupport/PronunciationLearnWordScreen';
import PronunciationListenChooseScreen from '../screens/teacher/students/modules/pronunciationSupport/PronunciationListenChooseScreen';
import PronunciationMouthShapeScreen from '../screens/teacher/students/modules/pronunciationSupport/PronunciationMouthShapeScreen';
import PronunciationSpeakWordScreen from '../screens/teacher/students/modules/pronunciationSupport/PronunciationSpeakWordScreen';
import PronunciationResultScreen from '../screens/teacher/students/modules/pronunciationSupport/PronunciationResultScreen';
import PronunciationResultsHistoryScreen from '../screens/teacher/students/modules/pronunciationSupport/PronunciationResultsHistoryScreen';
import PronunciationReviewQueueScreen from '../screens/teacher/students/modules/pronunciationSupport/PronunciationReviewQueueScreen';

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

// The teacher workspace — reached via "Teacher Workspace". A single stack: the
// dashboard is the entry point and navigates onward to the student screens.
function TeacherWorkspace() {
  return (
    <Stack.Navigator screenOptions={stackOptions}>
      <Stack.Screen name="TeacherHome"          component={TeacherDashboardScreen}   options={{ headerShown: false }} />
      <Stack.Screen name="TeacherStudentList"   component={TeacherStudentListScreen}  options={{ title: 'My Students' }} />
      <Stack.Screen name="TeacherStudentDetail" component={TeacherStudentDetailScreen} options={{ title: 'Student Profile' }} />
      <Stack.Screen name="PronunciationReviewQueue" component={PronunciationReviewQueueScreen} options={{ title: 'Review Queue' }} />
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
