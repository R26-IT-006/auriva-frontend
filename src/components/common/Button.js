import React from 'react';
import {
  TouchableOpacity,
  Text,
  StyleSheet,
  ActivityIndicator,
  View,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Colors } from '../../constants/colors';
import { Layout } from '../../constants/layout';

export function Button({
  title,
  onPress,
  variant = 'primary', // 'primary' | 'outline' | 'ghost' | 'danger'
  size = 'md',         // 'sm' | 'md' | 'lg'
  loading = false,
  disabled = false,
  icon = null,
  style,
  textStyle,
}) {
  const isDisabled = disabled || loading;

  const sizeStyles = {
    sm: { height: 40, paddingHorizontal: 16 },
    md: { height: 52, paddingHorizontal: 24 },
    lg: { height: 58, paddingHorizontal: 32 },
  };

  const textSizes = {
    sm: Layout.fontSize.sm,
    md: Layout.fontSize.md,
    lg: Layout.fontSize.lg,
  };

  if (variant === 'primary') {
    return (
      <TouchableOpacity
        onPress={onPress}
        disabled={isDisabled}
        activeOpacity={0.85}
        style={[styles.wrapper, sizeStyles[size], style]}
      >
        <LinearGradient
          colors={isDisabled ? ['#B0BED8', '#9AAEC8'] : Colors.primaryGradient}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={styles.gradient}
        >
          {loading ? (
            <ActivityIndicator color="#fff" size="small" />
          ) : (
            <View style={styles.row}>
              {icon && <View style={styles.iconLeft}>{icon}</View>}
              <Text style={[styles.primaryText, { fontSize: textSizes[size] }, textStyle]}>
                {title}
              </Text>
            </View>
          )}
        </LinearGradient>
      </TouchableOpacity>
    );
  }

  const outlineStyle = variant === 'outline' ? styles.outline : {};
  const ghostStyle = variant === 'ghost' ? styles.ghost : {};
  const dangerStyle = variant === 'danger' ? styles.danger : {};

  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={isDisabled}
      activeOpacity={0.75}
      style={[
        styles.base,
        sizeStyles[size],
        outlineStyle,
        ghostStyle,
        dangerStyle,
        isDisabled && styles.disabledBase,
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator
          color={variant === 'danger' ? Colors.status.error : Colors.primary}
          size="small"
        />
      ) : (
        <View style={styles.row}>
          {icon && <View style={styles.iconLeft}>{icon}</View>}
          <Text
            style={[
              styles.baseText,
              { fontSize: textSizes[size] },
              variant === 'danger' && { color: Colors.status.error },
              textStyle,
            ]}
          >
            {title}
          </Text>
        </View>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    borderRadius: Layout.radius.full,
    overflow: 'hidden',
  },
  gradient: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryText: {
    color: '#FFFFFF',
    fontWeight: Layout.fontWeight.bold,
    letterSpacing: 0.3,
  },
  base: {
    borderRadius: Layout.radius.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  outline: {
    borderWidth: 1.5,
    borderColor: Colors.primary,
    backgroundColor: 'transparent',
  },
  ghost: {
    backgroundColor: 'transparent',
  },
  danger: {
    borderWidth: 1.5,
    borderColor: Colors.status.error,
    backgroundColor: 'transparent',
  },
  disabledBase: {
    opacity: 0.5,
  },
  baseText: {
    color: Colors.primary,
    fontWeight: Layout.fontWeight.semibold,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  iconLeft: {
    marginRight: 8,
  },
});
