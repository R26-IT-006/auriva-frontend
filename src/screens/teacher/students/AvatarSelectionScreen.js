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
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
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
    Animated.spring(scale, { toValue: 1.1, useNativeDriver: true, speed: 40, bounciness: 8 }).start();
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
        style={[styles.avatarIcon, selected && styles.avatarIconSelected]}
      >
        <Image source={avatar.image} style={styles.avatarIconImage} resizeMode="contain" />
        <Text style={[styles.avatarIconName, selected && styles.avatarIconNameSelected]}>
          {avatar.name}
        </Text>
      </TouchableOpacity>
    </Animated.View>
  );
}

export default function AvatarSelectionScreen({ navigation, route }) {
  const { student } = route.params;
  const [selected, setSelected] = useState(null);
  const [saving,   setSaving]   = useState(false);
  const nameOpacity             = useRef(new Animated.Value(0)).current;

  const handleSelect = useCallback((avatar) => {
    setSelected(avatar);
    nameOpacity.setValue(0);
    Animated.timing(nameOpacity, {
      toValue: 1,
      duration: 350,
      useNativeDriver: true,
    }).start();
  }, [nameOpacity]);

  async function handleConfirm() {
    if (!selected) return;
    setSaving(true);
    try {
      await AsyncStorage.setItem(`student_avatar_${student.sid}`, selected.key);
      navigation.replace('StudentDashboard', { student: { ...student, avatar: selected.key } });
    } catch {
      setSaving(false);
    }
  }

  return (
    <View style={styles.root}>

      {/* ── Full-screen video / plain background ─────────────── */}
      {selected ? (
        <Video
          source={selected.video}
          style={StyleSheet.absoluteFill}
          resizeMode={ResizeMode.COVER}
          shouldPlay
          isLooping
        />
      ) : (
        <View style={[StyleSheet.absoluteFill, styles.noSelectionBg]} />
      )}

      {/* ── Overlay ──────────────────────────────────────────── */}
      <SafeAreaView style={styles.overlay} edges={['top', 'bottom', 'left', 'right']}>

        {/* ── Top-left: back + student label + avatar name ───── */}
        <View style={styles.topLeft}>
          <TouchableOpacity
            style={styles.backBtn}
            onPress={() => navigation.goBack()}
            activeOpacity={0.7}
          >
            <Ionicons name="arrow-back" size={20} color="#333" />
          </TouchableOpacity>

          <View style={styles.studentLabelPill}>
            <Text style={styles.studentLabel}>
              Avatar for{' '}
              <Text style={styles.studentName}>{student.full_name}</Text>
            </Text>
          </View>

          {selected ? (
            <Animated.Text style={[styles.avatarName, { opacity: nameOpacity }]}>
              {selected.name}
            </Animated.Text>
          ) : (
            <Text style={styles.placeholderText}>Tap an avatar to preview</Text>
          )}
        </View>

        {/* ── Body: spacer (character) + right rail ────────────── */}
        <View style={styles.body}>
          <View style={{ flex: 1 }} />

          {/* Vertical rail: icons in white pill, button below */}
          <View style={styles.sideRail}>
            {/* White pill — icons only */}
            <View style={styles.iconsPill}>
              {AVATARS.map((av) => (
                <AvatarIcon
                  key={av.key}
                  avatar={av}
                  selected={selected?.key === av.key}
                  onPress={() => handleSelect(av)}
                />
              ))}
            </View>

            {/* Confirm button — no white bg, sits below the pill */}
            <TouchableOpacity
              style={[styles.confirmBtn, !selected && styles.confirmBtnDisabled]}
              onPress={handleConfirm}
              disabled={!selected || saving}
              activeOpacity={0.85}
            >
              {saving
                ? <ActivityIndicator color="#FFF" size="small" />
                : <Text style={styles.confirmText}>
                    {selected ? `Choose\n${selected.name}` : 'Pick one'}
                  </Text>
              }
            </TouchableOpacity>
          </View>
        </View>

      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#ECECEC',
  },
  noSelectionBg: {
    backgroundColor: '#ECECEC',
  },
  overlay: {
    flex: 1,
  },

  // ── Top-left block ─────────────────────────────────────────
  topLeft: {
    position: 'absolute',
    top: Layout.spacing.lg,
    left: Layout.spacing.lg,
    gap: Layout.spacing.sm,
    zIndex: 10,
    maxWidth: '55%',
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.78)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  studentLabelPill: {
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(255,255,255,0.72)',
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 5,
  },
  studentLabel: {
    fontSize: Layout.fontSize.sm,
    color: '#666',
  },
  studentName: {
    fontWeight: '700',
    color: '#333',
  },
  avatarName: {
    fontSize: 48,
    fontWeight: '800',
    color: '#1A2E26',
    letterSpacing: -1,
    fontFamily: 'sans-serif-rounded',
    textShadowColor: 'rgba(255,255,255,0.9)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 10,
  },
  placeholderText: {
    fontSize: Layout.fontSize.sm,
    color: 'rgba(0,0,0,0.28)',
  },

  // ── Body row ───────────────────────────────────────────────
  body: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'stretch',
    paddingRight: Layout.spacing.md,
    paddingBottom: Layout.spacing.md,
    paddingTop: Layout.spacing.md,
  },

  // ── Side rail ──────────────────────────────────────────────
  sideRail: {
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Layout.spacing.md,
  },
  iconsPill: {
    backgroundColor: 'rgba(255,255,255,0.82)',
    borderRadius: 28,
    paddingVertical: Layout.spacing.md,
    paddingHorizontal: Layout.spacing.sm,
    alignItems: 'center',
    gap: Layout.spacing.sm,
  },

  avatarIcon: {
    alignItems: 'center',
    gap: 4,
    padding: 8,
    borderRadius: 18,
    borderWidth: 2.5,
    borderColor: 'transparent',
    backgroundColor: 'rgba(0,0,0,0.04)',
  },
  avatarIconSelected: {
    borderColor: '#4AABB8',
    backgroundColor: '#EBF7F9',
  },
  avatarIconImage: {
    width: 58,
    height: 58,
  },
  avatarIconName: {
    fontSize: Layout.fontSize.xs,
    fontWeight: '600',
    color: '#888',
  },
  avatarIconNameSelected: {
    color: '#4AABB8',
  },

  // ── Confirm button (inside rail, at bottom) ────────────────
  confirmBtn: {
    marginTop: Layout.spacing.md,
    width: '100%',
    borderRadius: 16,
    backgroundColor: '#4AABB8',
    paddingVertical: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  confirmBtnDisabled: {
    backgroundColor: '#C8DCDF',
  },
  confirmText: {
    color: '#FFF',
    fontSize: Layout.fontSize.xs,
    fontWeight: '700',
    textAlign: 'center',
    lineHeight: 17,
  },
});