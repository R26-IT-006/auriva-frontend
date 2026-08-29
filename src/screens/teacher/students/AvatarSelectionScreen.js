import { useState, useRef, useCallback } from 'react';
import {
  View,
  Text,
  Image,
  TouchableOpacity,
  StyleSheet,
  Animated,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Video, ResizeMode } from 'expo-av';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { teacherApi } from '../../../api/teacher';
import { Layout } from '../../../constants/layout';

const AVATARS = [
  {
    key:   'boba',
    name:  'Boba',
    image: require('../../../../assets/avatar-images/Boba.png'),
    video: require('../../../../assets/avatar-videos/BobaIntro.mp4'),
  },
  {
    key:   'glitter',
    name:  'Glitter',
    image: require('../../../../assets/avatar-images/Glitter.png'),
    video: require('../../../../assets/avatar-videos/GlitterIntro.mp4'),
  },
  {
    key:   'lily',
    name:  'Lily',
    image: require('../../../../assets/avatar-images/Lily.png'),
    video: require('../../../../assets/avatar-videos/LilyIntro.mp4'),
  },
  {
    key:   'megatron',
    name:  'Megatron',
    image: require('../../../../assets/avatar-images/Megatron.png'),
    video: require('../../../../assets/avatar-videos/MegatronIntro.mp4'),
  },
];

function AvatarIcon({ avatar, selected, onPress }) {
  const scale = useRef(new Animated.Value(1)).current;

  function onPressIn() {
    Animated.spring(scale, { toValue: 1.08, useNativeDriver: true, speed: 40, bounciness: 8 }).start();
  }
  function onPressOut() {
    Animated.spring(scale, { toValue: 1, useNativeDriver: true, speed: 30, bounciness: 4 }).start();
  }

  return (
    <Animated.View style={{ transform: [{ scale }] }}>
      <TouchableOpacity
        onPress={onPress}
        onPressIn={onPressIn}
        onPressOut={onPressOut}
        activeOpacity={1}
        accessibilityRole="button"
        accessibilityLabel={avatar.name}
        accessibilityState={{ selected }}
        style={[styles.avatarCard, selected && styles.avatarCardSelected]}
      >
        <Image
          source={avatar.image}
          style={[styles.avatarCardImage, !selected && styles.avatarCardImageIdle]}
          resizeMode="contain"
        />
        {selected && (
          <View style={styles.checkBadge}>
            <Ionicons name="checkmark" size={13} color="#FFF" />
          </View>
        )}
      </TouchableOpacity>
    </Animated.View>
  );
}

export default function AvatarSelectionScreen({ navigation, route }) {
  const { student } = route.params;
  const [selected, setSelected] = useState(null);
  const [saving,   setSaving]   = useState(false);

  // Show the first avatar's video on entry so the screen never opens on a blank panel
  const preview = selected ?? AVATARS[0];

  const handleSelect = useCallback((avatar) => setSelected(avatar), []);

  async function handleConfirm() {
    if (!selected) return;
    setSaving(true);

    const nextStudent = { ...student, avatar_key: selected.key };

    try {
      await AsyncStorage.setItem(`student_avatar_${student.sid}`, selected.key);
      navigation.replace('StudentDashboard', { student: nextStudent });

      // Backend support for avatar persistence may be unavailable in local dev.
      teacherApi.setAvatar(student.sid, selected.key).catch(() => {});
    } catch (error) {
      setSaving(false);
    }
  }

  return (
    <View style={styles.root}>

      {/* ── Full-screen video (defaults to Boba until a tap) ──── */}
      <Video
        source={preview.video}
        style={StyleSheet.absoluteFill}
        resizeMode={ResizeMode.COVER}
        shouldPlay
        isLooping
      />

      {/* ── Overlay ──────────────────────────────────────────── */}
      <SafeAreaView style={styles.overlay} edges={['top', 'bottom', 'left', 'right']}>

        {/* ── Top bar: back + student label ────────────────────── */}
        <View style={styles.topBar}>
          <TouchableOpacity
            style={styles.backBtn}
            onPress={() => navigation.goBack()}
            activeOpacity={0.7}
          >
            <Ionicons name="arrow-back" size={20} color="#FFF" />
          </TouchableOpacity>

          <View style={styles.studentLabelPill}>
            <Text style={styles.studentLabel}>
              Avatar for{' '}
              <Text style={styles.studentName}>{student.full_name}</Text>
            </Text>
          </View>
        </View>

        {/* ── Main content: left preview + right rail ───────────── */}
        <View style={styles.content}>

          {/* Left pane: hint only, so the video stays unobstructed */}
          <View style={styles.leftPane}>
            {!selected && (
              <View style={styles.hintPill}>
                <Text style={styles.hintText}>Tap an avatar to preview</Text>
              </View>
            )}
          </View>

          {/* Right rail: avatar dock + confirm button */}
          <View style={styles.rightRail}>
            <View style={styles.dock}>
              {AVATARS.map((av) => (
                <AvatarCard
                  key={av.key}
                  avatar={av}
                  selected={selected?.key === av.key}
                  onPress={() => handleSelect(av)}
                />
              ))}
            </View>

            <TouchableOpacity
              style={styles.confirmWrap}
              onPress={handleConfirm}
              disabled={!selected || saving}
              activeOpacity={0.85}
            >
              {selected ? (
                <LinearGradient
                  colors={TEAL_GRAD}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={styles.confirmBtn}
                >
                  {saving
                    ? <ActivityIndicator color="#FFF" size="small" />
                    : <Text style={styles.confirmText}>Choose</Text>
                  }
                </LinearGradient>
              ) : (
                <View style={[styles.confirmBtn, styles.confirmBtnDisabled]}>
                  <Text style={styles.confirmTextDisabled}>Pick one</Text>
                </View>
              )}
            </TouchableOpacity>
          </View>

        </View>
      </SafeAreaView>
    </View>
  );
}

const CARD_SIZE = 88;
const TEAL_GRAD = ['#4AABB8', '#52C07C'];

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#ECECEC',
  },
  overlay: {
    flex: 1,
  },

  // ── Top bar ────────────────────────────────────────────────
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Layout.spacing.sm,
    paddingHorizontal: Layout.spacing.lg,
    paddingTop: Layout.spacing.md,
    paddingBottom: Layout.spacing.sm,
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(18,34,30,0.32)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.30)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  studentLabelPill: {
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(18,34,30,0.32)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.30)',
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 6,
  },
  studentLabel: {
    fontSize: Layout.fontSize.sm,
    color: 'rgba(255,255,255,0.80)',
  },
  studentName: {
    fontFamily: 'DMSans_700Bold',
    color: '#FFFFFF',
  },

  // ── Content row ────────────────────────────────────────────
  content: {
    flex: 1,
    flexDirection: 'row',
    paddingHorizontal: Layout.spacing.lg,
    paddingBottom: Layout.spacing.lg,
    gap: Layout.spacing.lg,
  },

  // ── Left pane ──────────────────────────────────────────────
  leftPane: {
    flex: 1,
    justifyContent: 'flex-end',
    paddingBottom: Layout.spacing.md,
  },
  hintPill: {
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(18,34,30,0.32)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.30)',
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 6,
  },
  hintText: {
    fontSize: Layout.fontSize.sm,
    fontFamily: 'DMSans_600SemiBold',
    color: 'rgba(255,255,255,0.88)',
  },

  // ── Right rail ─────────────────────────────────────────────
  rightRail: {
    width: CARD_SIZE + 32,
    justifyContent: 'center',
    alignItems: 'center',
    gap: Layout.spacing.lg,
    paddingVertical: Layout.spacing.sm,
  },
  dock: {
    alignItems: 'center',
    gap: 10,
    padding: 10,
    borderRadius: 34,
    backgroundColor: 'rgba(18,34,30,0.32)',
  },

  // ── Avatar card ────────────────────────────────────────────
  avatarCard: {
    width: CARD_SIZE,
    height: CARD_SIZE,
    borderRadius: 24,
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.86)',
    backgroundColor: 'rgba(255,255,255,0.86)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarCardSelected: {
    borderWidth: 2.5,
    borderColor: '#4AABB8',
    backgroundColor: '#FFFFFF',
  },
  avatarCardImage: {
    width: CARD_SIZE * 0.82,
    height: CARD_SIZE * 0.82,
  },
  avatarCardImageIdle: {
    opacity: 0.82,
  },
  checkBadge: {
    position: 'absolute',
    top: -5,
    right: -5,
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: '#4AABB8',
    borderWidth: 2,
    borderColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },

  // ── Confirm button ─────────────────────────────────────────
  confirmWrap: {
    alignSelf: 'stretch',
    borderRadius: 22,
    overflow: 'hidden',
  },
  confirmBtn: {
    paddingVertical: 17,
    alignItems: 'center',
    justifyContent: 'center',
  },
  confirmBtnDisabled: {
    backgroundColor: 'rgba(18,34,30,0.32)',
  },
  confirmText: {
    color: '#FFF',
    fontSize: 19,
    fontFamily: 'DMSans_800ExtraBold',
    textAlign: 'center',
    letterSpacing: 0.2,
  },
  confirmTextDisabled: {
    color: 'rgba(255,255,255,0.85)',
    fontSize: Layout.fontSize.md,
    fontFamily: 'DMSans_700Bold',
    textAlign: 'center',
  },
});
