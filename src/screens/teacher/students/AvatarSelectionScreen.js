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
import { VideoView, useVideoPlayer } from 'expo-video';
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

function AvatarVideoBackground({ source }) {
  const player = useVideoPlayer(source, p => {
    p.loop = true;
    p.play();
  });
  return (
    <VideoView
      player={player}
      style={StyleSheet.absoluteFill}
      contentFit="cover"
      nativeControls={false}
    />
  );
}

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
        style={[styles.avatarCard, selected && styles.avatarCardSelected]}
      >
        <Image source={avatar.image} style={styles.avatarCardImage} resizeMode="contain" />
        <Text style={[styles.avatarCardName, selected && styles.avatarCardNameSelected]}>
          {avatar.name}
        </Text>
        {selected && (
          <View style={styles.checkBadge}>
            <Ionicons name="checkmark-circle" size={18} color="#4AABB8" />
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
      await teacherApi.setAvatar(student.sid, selected.key);
      // Cache locally so StudentPickerScreen can check without an extra request
      await AsyncStorage.setItem(`student_avatar_${student.sid}`, selected.key);
      navigation.replace('StudentDashboard', { student: { ...student, avatar_key: selected.key } });
    } catch {
      setSaving(false);
    }
  }

  return (
    <View style={styles.root}>

      {/* ── Full-screen video / plain background ─────────────── */}
      {selected ? (
        <AvatarVideoBackground key={selected.key} source={selected.video} />
      ) : (
        <View style={[StyleSheet.absoluteFill, styles.noSelectionBg]} />
      )}

      {/* ── Overlay ──────────────────────────────────────────── */}
      <SafeAreaView style={styles.overlay} edges={['top', 'bottom', 'left', 'right']}>

        {/* ── Top bar: back + student label ────────────────────── */}
        <View style={styles.topBar}>
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
        </View>

        {/* ── Main content: left preview + right rail ───────────── */}
        <View style={styles.content}>

          {/* Left pane: avatar name + SELECTED badge */}
          <View style={styles.leftPane}>
            {selected ? (
              <Animated.View style={[styles.nameRow, { opacity: nameOpacity }]}>
                <Text style={styles.avatarName}>{selected.name}</Text>
                <View style={styles.selectedBadge}>
                  <Text style={styles.selectedBadgeText}>SELECTED</Text>
                </View>
              </Animated.View>
            ) : (
              <Text style={styles.placeholderText}>Tap an avatar to preview</Text>
            )}
          </View>

          {/* Right rail: avatar cards + confirm button */}
          <View style={styles.rightRail}>
            <View style={styles.cardList}>
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

const CARD_SIZE = 100;

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
    backgroundColor: 'rgba(255,255,255,0.78)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  studentLabelPill: {
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(255,255,255,0.72)',
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 6,
  },
  studentLabel: {
    fontSize: Layout.fontSize.sm,
    color: '#666',
  },
  studentName: {
    fontFamily: 'Nunito_700Bold',
    color: '#333',
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
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Layout.spacing.sm,
  },
  avatarName: {
    fontSize: 52,
    fontFamily: 'Nunito_900Black',
    color: '#1A2E26',
    letterSpacing: -1,
    textShadowColor: 'rgba(255,255,255,0.9)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 12,
  },
  selectedBadge: {
    backgroundColor: 'rgba(74,171,184,0.18)',
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: '#4AABB8',
    paddingHorizontal: 10,
    paddingVertical: 4,
    alignSelf: 'center',
    marginTop: 6,
  },
  selectedBadgeText: {
    fontSize: 11,
    fontFamily: 'Nunito_700Bold',
    color: '#4AABB8',
    letterSpacing: 1,
  },
  placeholderText: {
    fontSize: Layout.fontSize.sm,
    color: 'rgba(0,0,0,0.28)',
  },

  // ── Right rail ─────────────────────────────────────────────
  rightRail: {
    width: CARD_SIZE + 20,
    justifyContent: 'space-between',
    paddingVertical: Layout.spacing.sm,
  },
  cardList: {
    gap: Layout.spacing.sm,
  },

  // ── Avatar card ────────────────────────────────────────────
  avatarCard: {
    width: CARD_SIZE + 16,
    borderRadius: 18,
    borderWidth: 2.5,
    borderColor: 'rgba(255,255,255,0.55)',
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    paddingTop: 8,
    paddingBottom: 6,
    paddingHorizontal: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 6,
    elevation: 3,
  },
  avatarCardSelected: {
    borderColor: '#4AABB8',
    backgroundColor: '#FFFFFF',
  },
  avatarCardImage: {
    width: CARD_SIZE * 0.72,
    height: CARD_SIZE * 0.72,
  },
  avatarCardName: {
    fontSize: Layout.fontSize.xs,
    fontFamily: 'Nunito_600SemiBold',
    color: '#888',
    marginTop: 3,
  },
  avatarCardNameSelected: {
    color: '#4AABB8',
    fontFamily: 'Nunito_700Bold',
  },
  checkBadge: {
    position: 'absolute',
    top: 6,
    right: 6,
  },

  // ── Confirm button ─────────────────────────────────────────
  confirmBtn: {
    borderRadius: 18,
    backgroundColor: '#4AABB8',
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#4AABB8',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 8,
    elevation: 5,
  },
  confirmBtnDisabled: {
    backgroundColor: '#C8DCDF',
    shadowOpacity: 0,
    elevation: 0,
  },
  confirmText: {
    color: '#FFF',
    fontSize: Layout.fontSize.sm,
    fontFamily: 'Nunito_800ExtraBold',
    textAlign: 'center',
    lineHeight: 20,
  },
});
