import { useState, useEffect, useCallback } from 'react';
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

function generateCode() {
  return Array.from({ length: CODE_LENGTH }, () => Math.floor(Math.random() * 10));
}

export function ParentGateModal({ visible, onSuccess, onCancel }) {
  const [code,    setCode]   = useState([]);
  const [entered, setEntered] = useState([]);
  const [shake,   setShake]  = useState(false);
  const shakeAnim            = new Animated.Value(0);

  // Fresh code every time modal opens
  useEffect(() => {
    if (visible) {
      setCode(generateCode());
      setEntered([]);
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
      if (correct) {
        onSuccess();
      } else {
        setTimeout(doShake, 100);
      }
    }
  }

  function handleDelete() {
    setEntered((prev) => prev.slice(0, -1));
  }

  const KEYS = [1, 2, 3, 4, 5, 6, 7, 8, 9, null, 0, 'del'];

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onCancel}>
      <View style={styles.overlay}>
        <View style={styles.sheet}>

          {/* ── Header ───────────────────────────────────────── */}
          <View style={styles.header}>
            <TouchableOpacity style={styles.closeBtn} onPress={onCancel} activeOpacity={0.7}>
              <Ionicons name="close-circle" size={28} color="#FF4D6D" />
            </TouchableOpacity>
            <View style={styles.headerText}>
              <Text style={styles.headerTitle}>Teachers Only</Text>
            </View>
          </View>

          <View style={styles.divider} />

          {/* ── Prompt ───────────────────────────────────────── */}
          <Text style={styles.prompt}>To continue, please enter the numbers</Text>
          <Text style={styles.codeWords}>
            {code.map((n) => WORDS[n]).join(', ')}
          </Text> 

          {/* ── Input boxes ──────────────────────────────────── */}
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
                <Text style={styles.boxText}>
                  {entered[i] !== undefined ? entered[i] : ''}
                </Text>
              </View>
            ))}
          </Animated.View>

          {/* ── Number pad ───────────────────────────────────── */}
          <View style={styles.pad}>
            {KEYS.map((k, idx) => {
              if (k === null) return <View key={idx} style={styles.padCell} />;
              if (k === 'del') return (
                <TouchableOpacity key={idx} style={styles.padCell} onPress={handleDelete} activeOpacity={0.6}>
                  <Ionicons name="backspace-outline" size={24} color="#555" />
                </TouchableOpacity>
              );
              return (
                <TouchableOpacity key={idx} style={styles.padCell} onPress={() => handleDigit(k)} activeOpacity={0.6}>
                  <Text style={styles.padDigit}>{k}</Text>
                </TouchableOpacity>
              );
            })}
          </View>

        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: Layout.spacing.xl,
  },
  sheet: {
    backgroundColor: '#FFF',
    borderRadius: 28,
    paddingBottom: Layout.spacing.xl,
    paddingHorizontal: Layout.spacing.xl,
    paddingTop: Layout.spacing.lg,
    width: '100%',
    maxWidth: 420,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.2,
    shadowRadius: 24,
    elevation: 12,
  },

  // ── Header ───────────────────────────────────────────────────
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Layout.spacing.sm,
    marginBottom: Layout.spacing.md,
  },
  closeBtn: {
    marginTop: 2,
  },
  headerText: {
    flex: 1,
  },
  headerTitle: {
    fontSize: Layout.fontSize.md,
    fontWeight: '700',
    color: '#4AABB8',
  },
  headerSub: {
    fontSize: Layout.fontSize.sm,
    color: '#888',
    marginTop: 2,
    lineHeight: 18,
  },

  divider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: '#E5E5E5',
    marginBottom: Layout.spacing.lg,
  },

  // ── Prompt ───────────────────────────────────────────────────
  prompt: {
    textAlign: 'center',
    fontSize: Layout.fontSize.sm,
    color: '#888',
    marginBottom: Layout.spacing.sm,
  },
  codeWords: {
    textAlign: 'center',
    fontSize: Layout.fontSize.lg,
    fontWeight: '800',
    color: '#4AABB8',
    letterSpacing: 0.5,
    marginBottom: Layout.spacing.lg,
  },

  // ── Input boxes ──────────────────────────────────────────────
  boxes: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: Layout.spacing.sm,
    marginBottom: Layout.spacing.xl,
  },
  box: {
    width: 52,
    height: 52,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: '#DDD',
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FAFAFA',
  },
  boxFilled: {
    borderStyle: 'solid',
    borderColor: '#4AABB8',
    backgroundColor: '#EBF7F9',
  },
  boxError: {
    borderColor: '#FF4D6D',
    backgroundColor: '#FFF0F3',
  },
  boxText: {
    fontSize: Layout.fontSize.xl,
    fontWeight: '700',
    color: '#333',
  },

  // ── Number pad ───────────────────────────────────────────────
  pad: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
  },
  padCell: {
    width: '33.33%',
    paddingVertical: Layout.spacing.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  padDigit: {
    fontSize: 28,
    fontWeight: '400',
    color: '#222',
  },
});