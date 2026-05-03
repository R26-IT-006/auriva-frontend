import React, { useRef } from 'react';
import {
  TouchableOpacity,
  Text,
  StyleSheet,
  ActivityIndicator,
  View,
  Animated,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Colors } from '../../constants/colors';
import { Layout } from '../../constants/layout';

const VARIANTS = {
  primary: {
    gradient:      ['#4AABB8', '#52C07C'],
    gradientPress: ['#3A8E9A', '#3DA060'],
    gradientDis:   ['#B0D4D8', '#A8CEB8'],
    textColor:     '#FFFFFF',
    radius:        14,
  },
  outline: {
    bg:            'transparent',
    bgPress:       '#EFEDF8',
    border:        Colors.primary,
    textColor:     Colors.primary,
    textPress:     '#5A4FB0',
    radius:        14,
  },
  ghost: {
    bg:            'transparent',
    bgPress:       '#F0F2FA',
    textColor:     Colors.primary,
    textPress:     '#5A4FB0',
    radius:        14,
  },
  danger: {
    bg:            'transparent',
    bgPress:       '#FFF0F3',
    border:        Colors.status.error,
    textColor:     Colors.status.error,
    textPress:     '#CC1A3A',
    radius:        14,
  },
};

const SIZE = {
  sm: { height: 38,  px: 14, fontSize: Layout.fontSize.sm, iconSize: 15 },
  md: { height: 50,  px: 22, fontSize: Layout.fontSize.md, iconSize: 18 },
  lg: { height: 56,  px: 30, fontSize: Layout.fontSize.lg, iconSize: 20 },
};

export function Button({
  title,
  onPress,
  variant = 'primary',
  size    = 'md',
  loading = false,
  disabled = false,
  icon    = null,
  style,
  textStyle,
}) {
  const isDisabled = disabled || loading;
  const pressed    = useRef(new Animated.Value(0)).current;
  const cfg = VARIANTS[variant] || VARIANTS.primary;
  const s   = SIZE[size] || SIZE.md;

  function handlePressIn() {
    Animated.spring(pressed, { toValue: 1, useNativeDriver: true, speed: 40, bounciness: 4 }).start();
  }
  function handlePressOut() {
    Animated.spring(pressed, { toValue: 0, useNativeDriver: true, speed: 30, bounciness: 4 }).start();
  }

  const scale = pressed.interpolate({ inputRange: [0, 1], outputRange: [1, 0.96] });

  const content = loading ? (
    <ActivityIndicator color={variant === 'primary' ? '#FFF' : Colors.primary} size="small" />
  ) : (
    <View style={styles.row}>
      {icon && <View style={styles.iconLeft}>{icon}</View>}
      <Text style={[
        styles.text,
        { fontSize: s.fontSize, color: cfg.textColor },
        textStyle,
      ]}>
        {title}
      </Text>
    </View>
  );

  // ── Primary: gradient button ────────────────────────────────────────────
  if (variant === 'primary') {
    const gradColors = isDisabled ? cfg.gradientDis : cfg.gradient;
    const gradPress  = isDisabled ? cfg.gradientDis : cfg.gradientPress;

    return (
      <Animated.View style={[{ transform: [{ scale }] }, style]}>
        <TouchableOpacity
          onPress={onPress}
          onPressIn={handlePressIn}
          onPressOut={handlePressOut}
          disabled={isDisabled}
          activeOpacity={1}
          style={[styles.wrapper, { height: s.height, borderRadius: cfg.radius, opacity: isDisabled ? 0.6 : 1 }]}
        >
          <LinearGradient
            colors={gradColors}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={[styles.gradient, { borderRadius: cfg.radius }]}
          >
            {content}
          </LinearGradient>
        </TouchableOpacity>
      </Animated.View>
    );
  }

  // ── Outline / Ghost / Danger ─────────────────────────────────────────────
  const bgColor   = pressed.interpolate({ inputRange: [0, 1], outputRange: [cfg.bg || 'transparent', cfg.bgPress || 'transparent'] });
  const txtColor  = pressed.interpolate({ inputRange: [0, 1], outputRange: [cfg.textColor, cfg.textPress || cfg.textColor] });

  return (
    <Animated.View style={[{ transform: [{ scale }] }, style]}>
      <TouchableOpacity
        onPress={onPress}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        disabled={isDisabled}
        activeOpacity={1}
        style={{ borderRadius: cfg.radius, overflow: 'hidden', opacity: isDisabled ? 0.5 : 1 }}
      >
        <Animated.View style={[
          styles.base,
          {
            height: s.height,
            paddingHorizontal: s.px,
            borderRadius: cfg.radius,
            backgroundColor: bgColor,
            borderWidth:  cfg.border ? 1.5 : 0,
            borderColor:  cfg.border || 'transparent',
          },
        ]}>
          {loading ? (
            <ActivityIndicator
              color={variant === 'danger' ? Colors.status.error : Colors.primary}
              size="small"
            />
          ) : (
            <View style={styles.row}>
              {icon && <View style={styles.iconLeft}>{icon}</View>}
              <Animated.Text style={[
                styles.text,
                { fontSize: s.fontSize, color: txtColor },
                textStyle,
              ]}>
                {title}
              </Animated.Text>
            </View>
          )}
        </Animated.View>
      </TouchableOpacity>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    overflow: 'hidden',
  },
  gradient: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  base: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  text: {
    fontFamily: 'Nunito_700Bold',
    letterSpacing: 0.2,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  iconLeft: {
    marginRight: 7,
  },
});
