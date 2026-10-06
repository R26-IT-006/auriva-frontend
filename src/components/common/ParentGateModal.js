import { useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Modal,
  StyleSheet,
  Animated,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Layout } from '../../constants/layout';
import { rs, rf } from '../../utils/responsive';

// TEMPORARY: the gate is switched off app-wide. While false, opening the gate
// immediately counts as a correct code — every caller's onSuccess runs as if
// the adult had passed, and no modal is shown. All gate code below is kept
// as-is; set this back to true to re-enable it everywhere.
const PARENT_GATE_ENABLED = false;

const WORDS = ['ZERO','ONE','TWO','THREE','FOUR','FIVE','SIX','SEVEN','EIGHT','NINE'];
const CODE_LENGTH = 4;
const ACCENT = '#4AABB8';

function generateCode() {
  return Array.from({ length: CODE_LENGTH }, () => Math.floor(Math.random() * 10));
}

export function ParentGateModal({ visible, onSuccess, onCancel }) {
  const [code,    setCode]    = useState([]);
  const [entered, setEntered] = useState([]);
  const [shake,   setShake]   = useState(false);
  const shakeAnim             = useRef(new Animated.Value(0)).current;
  const scaleAnim             = useRef(new Animated.Value(0.92)).current;
  const opacityAnim           = useRef(new Animated.Value(0)).current;

  // Latest onSuccess, so the bypass below never runs a stale callback.
  const onSuccessRef = useRef(onSuccess);
  useEffect(() => { onSuccessRef.current = onSuccess; });

  // Gate disabled: pass straight through the moment a caller opens it.
  useEffect(() => {
    if (!PARENT_GATE_ENABLED && visible) onSuccessRef.current?.();
  }, [visible]);

  useEffect(() => {
    if (!PARENT_GATE_ENABLED) return;
    if (visible) {
      setCode(generateCode());
      setEntered([]);
      Animated.parallel([
        Animated.spring(scaleAnim,   { toValue: 1, useNativeDriver: true, bounciness: 8, speed: 12 }),
        Animated.timing(opacityAnim, { toValue: 1, duration: 180, useNativeDriver: true }),
      ]).start();
    } else {
      scaleAnim.setValue(0.92);
      opacityAnim.setValue(0);
    }
  }, [visible]);

  const doShake = useCallback(() => {
    setShake(true);
    Animated.sequence([
      Animated.timing(shakeAnim, { toValue: 10,  duration: 50, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: -10, duration: 50, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: 8,   duration: 50, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: -8,  duration: 50, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: 0,   duration: 50, useNativeDriver: true }),
    ]).start(() => {
      setShake(false);
      setEntered([]);
    });
  }, [shakeAnim]);

  function handleDigit(d) {
    if (entered.length >= CODE_LENGTH) return;
    const next = [...entered, d];
    setEntered(next);
    if (next.length === CODE_LENGTH) {
      const correct = next.every((v, i) => v === code[i]);
      if (correct) onSuccess();
      else setTimeout(doShake, 100);
    }
  }

  function handleDelete() {
    setEntered((prev) => prev.slice(0, -1));
  }

  // Optional-call so a caller that omits onCancel can't crash the gate.
  function handleClose() {
    setEntered([]);
    onCancel?.();
  }

  const KEYS = [1, 2, 3, 4, 5, 6, 7, 8, 9, null, 0, 'del'];

  if (!PARENT_GATE_ENABLED) return null;

  return (
    <Modal visible={visible} animationType="none" transparent onRequestClose={handleClose}>
      <View style={styles.overlay}>
        <Animated.View style={[styles.sheet, { transform: [{ scale: scaleAnim }], opacity: opacityAnim }]}>

          {/* Close. Until now the only way out was entering the code correctly:
              onRequestClose fires solely for Android's hardware back button, which
              a tablet in gesture or kiosk mode may never deliver. */}
          <TouchableOpacity
            style={styles.closeBtn}
            onPress={handleClose}
            activeOpacity={0.7}
            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
            accessibilityRole="button"
            accessibilityLabel="Close"
          >
            <Ionicons name="close" size={22} color="#8A959C" />
          </TouchableOpacity>

          {/* Prompt */}
          <Text style={styles.prompt}>To continue, please enter the numbers</Text>
          <Text style={styles.codeWords}>
            {code.map((n) => WORDS[n]).join(',  ')}
          </Text>

          {/* Input boxes */}
          <Animated.View style={[styles.boxes, { transform: [{ translateX: shakeAnim }] }]}>
            {Array.from({ length: CODE_LENGTH }).map((_, i) => (
              <View
                key={i}
                style={[
                  styles.box,
                  entered[i] !== undefined && styles.boxFilled,
                  shake && styles.boxError,
                ]}
              >
                <Text style={[styles.boxText, shake && { color: '#FF4D6D' }]}>
                  {entered[i] !== undefined ? entered[i] : ''}
                </Text>
              </View>
            ))}
          </Animated.View>

          {/* Number pad */}
          <View style={styles.pad}>
            {KEYS.map((k, idx) => {
              if (k === null) return <View key={idx} style={styles.padCell} />;
              if (k === 'del') return (
                <TouchableOpacity key={idx} style={styles.padCell} onPress={handleDelete} activeOpacity={0.6}>
                  <View style={styles.delBtn}>
                    <Ionicons name="backspace-outline" size={22} color={ACCENT} />
                  </View>
                </TouchableOpacity>
              );
              return (
                <TouchableOpacity key={idx} style={styles.padCell} onPress={() => handleDigit(k)} activeOpacity={0.7}>
                  <View style={styles.digitBtn}>
                    <Text style={styles.padDigit}>{k}</Text>
                  </View>
                </TouchableOpacity>
              );
            })}
          </View>

        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: Layout.spacing.xl,
  },
  sheet: {
    backgroundColor: '#FFFFFF',
    borderRadius: rs(32),
    paddingBottom: rs(24),
    paddingHorizontal: rs(28),
    // Clears the close button so it never crowds the centred prompt.
    paddingTop: rs(52),
    width: '100%',
    maxWidth: rs(400),
    shadowColor: '#000',
    shadowOffset: { width: 0, height: rs(12) },
    shadowOpacity: 0.18,
    shadowRadius: 28,
    elevation: 16,
  },

  closeBtn: {
    position: 'absolute',
    top: rs(14),
    right: rs(14),
    width: rs(36),
    height: rs(36),
    borderRadius: rs(18),
    backgroundColor: '#F2F5F6',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 2,
  },

  prompt: {
    fontFamily: 'DMSans_700Bold',
    textAlign: 'center',
    fontSize: rf(13),
    color: '#999',
    marginBottom: rs(6),
  },
  codeWords: {
    fontFamily: 'DMSans_800ExtraBold',
    textAlign: 'center',
    fontSize: rf(18),
    color: ACCENT,
    letterSpacing: 0.3,
    marginBottom: rs(24),
  },

  boxes: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: rs(12),
    marginBottom: rs(28),
  },
  box: {
    width: rs(56),
    height: rs(56),
    borderRadius: rs(14),
    borderWidth: 2,
    borderColor: '#E0E0E0',
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FAFAFA',
  },
  boxFilled: {
    borderStyle: 'solid',
    borderColor: ACCENT,
    backgroundColor: '#EBF7F9',
  },
  boxError: {
    borderStyle: 'solid',
    borderColor: '#FF4D6D',
    backgroundColor: '#FFF0F3',
  },
  boxText: {
    fontFamily: 'DMSans_800ExtraBold',
    fontSize: rf(22),
    color: '#222',
  },

  pad: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
  },
  padCell: {
    width: '33.33%',
    paddingVertical: rs(8),
    alignItems: 'center',
    justifyContent: 'center',
  },
  digitBtn: {
    width: rs(64),
    height: rs(64),
    borderRadius: rs(32),
    backgroundColor: '#F4F4F4',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 2,
  },
  padDigit: {
    fontFamily: 'DMSans_700Bold',
    fontSize: rf(26),
    color: '#222',
  },
  delBtn: {
    width: rs(64),
    height: rs(64),
    borderRadius: rs(32),
    backgroundColor: '#FFF0F3',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
