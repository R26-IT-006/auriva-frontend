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

  useEffect(() => {
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

  const KEYS = [1, 2, 3, 4, 5, 6, 7, 8, 9, null, 0, 'del'];

  return (
    <Modal visible={visible} animationType="none" transparent onRequestClose={onCancel}>
      <View style={styles.overlay}>
        <Animated.View style={[styles.sheet, { transform: [{ scale: scaleAnim }], opacity: opacityAnim }]}>

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
    borderRadius: 32,
    paddingBottom: 24,
    paddingHorizontal: 28,
    paddingTop: 20,
    width: '100%',
    maxWidth: 400,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.18,
    shadowRadius: 28,
    elevation: 16,
  },

  prompt: {
    fontFamily: 'Nunito_700Bold',
    textAlign: 'center',
    fontSize: 13,
    color: '#999',
    marginBottom: 6,
  },
  codeWords: {
    fontFamily: 'Nunito_800ExtraBold',
    textAlign: 'center',
    fontSize: 18,
    color: ACCENT,
    letterSpacing: 0.3,
    marginBottom: 24,
  },

  boxes: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 12,
    marginBottom: 28,
  },
  box: {
    width: 56,
    height: 56,
    borderRadius: 14,
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
    fontFamily: 'Nunito_800ExtraBold',
    fontSize: 22,
    color: '#222',
  },

  pad: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
  },
  padCell: {
    width: '33.33%',
    paddingVertical: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  digitBtn: {
    width: 64,
    height: 64,
    borderRadius: 32,
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
    fontFamily: 'Nunito_700Bold',
    fontSize: 26,
    color: '#222',
  },
  delBtn: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#FFF0F3',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
