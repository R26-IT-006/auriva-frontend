import React from 'react';
import { View, StyleSheet } from 'react-native';
import { Colors } from '../../constants/colors';
import { Layout } from '../../constants/layout';

export function Card({ children, style, padding = 'md' }) {
  const paddingMap = {
    none: 0,
    sm: Layout.spacing.sm,
    md: Layout.spacing.md,
    lg: Layout.spacing.lg,
  };
  return (
    <View style={[styles.card, { padding: paddingMap[padding] }, style]}>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: Colors.surface,
    borderRadius: Layout.radius.lg,
    borderWidth: 1,
    borderColor: Colors.borderLight,
    ...Layout.shadow.sm,
  },
});
