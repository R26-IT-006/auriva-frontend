import React, { createContext, useContext, useRef, useState, useCallback } from 'react';
import {
  Animated,
  View,
  Text,
  StyleSheet,
  Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';

const ToastContext = createContext(null);

const CONFIG = {
  success: { bg: '#3D3F5C', icon: 'checkmark-circle',    iconColor: '#7DD9A8', title: 'Done'    },
  error:   { bg: '#4A2D35', icon: 'close-circle',         iconColor: '#F08080', title: 'Error'   },
  info:    { bg: '#2D3A4A', icon: 'information-circle',   iconColor: '#7AB3E8', title: 'Info'    },
  warning: { bg: '#4A3D2A', icon: 'warning',              iconColor: '#F0C060', title: 'Notice'  },
};

const DURATION  = 3000;  // ms visible
const ANIM_MS   = 320;   // slide duration

export function ToastProvider({ children }) {
  const insets   = useSafeAreaInsets();
  const [toast, setToast]   = useState(null);
  const translateY = useRef(new Animated.Value(-120)).current;
  const opacity    = useRef(new Animated.Value(0)).current;
  const timerRef   = useRef(null);

  const show = useCallback((message, type = 'success', customTitle = null) => {
    // Cancel any pending hide
    if (timerRef.current) clearTimeout(timerRef.current);

    const cfg = CONFIG[type] || CONFIG.success;
    setToast({ message, type, cfg, title: customTitle || cfg.title });

    // Reset position then animate in
    translateY.setValue(-120);
    opacity.setValue(0);
    Animated.parallel([
      Animated.spring(translateY, { toValue: 0, useNativeDriver: true, bounciness: 6, speed: 14 }),
      Animated.timing(opacity,    { toValue: 1, duration: ANIM_MS, useNativeDriver: true }),
    ]).start();

    timerRef.current = setTimeout(() => hide(), DURATION);
  }, []);

  const hide = useCallback(() => {
    Animated.parallel([
      Animated.timing(translateY, { toValue: -120, duration: ANIM_MS, useNativeDriver: true }),
      Animated.timing(opacity,    { toValue: 0,    duration: ANIM_MS, useNativeDriver: true }),
    ]).start(() => setToast(null));
  }, []);

  return (
    <ToastContext.Provider value={{ show }}>
      {children}
      {toast && (
        <Animated.View
          style={[
            styles.container,
            {
              top: insets.top + (Platform.OS === 'android' ? 12 : 8),
              backgroundColor: toast.cfg.bg,
              transform: [{ translateY }],
              opacity,
            },
          ]}
          pointerEvents="none"
        >
          <View style={styles.textBlock}>
            <Text style={styles.title}>{toast.title}</Text>
            <Text style={styles.message} numberOfLines={2}>{toast.message}</Text>
          </View>
          <View style={[styles.iconWrap, { backgroundColor: toast.cfg.iconColor + '22' }]}>
            <Ionicons name={toast.cfg.icon} size={20} color={toast.cfg.iconColor} />
          </View>
        </Animated.View>
      )}
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used within ToastProvider');
  return ctx;
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    right: 16,
    zIndex: 9999,
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 14,
    paddingVertical: 10,
    paddingHorizontal: 14,
    gap: 10,
    maxWidth: 300,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.28,
    shadowRadius: 14,
    elevation: 12,
  },
  textBlock: {
    flexShrink: 1,
    gap: 1,
  },
  title: {
    fontSize: 13,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: 0.1,
  },
  message: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.78)',
    fontWeight: '500',
    lineHeight: 16,
  },
  iconWrap: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
});
