import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Colors } from '../../constants/colors';
import { Layout } from '../../constants/layout';

export function Badge({ label, variant = 'info', style }) {
  const variants = {
    info: { bg: Colors.status.infoLight, text: Colors.primary },
    success: { bg: Colors.status.successLight, text: Colors.status.success },
    warning: { bg: Colors.status.warningLight, text: Colors.status.warning },
    error: { bg: Colors.status.errorLight, text: Colors.status.error },
    muted: { bg: Colors.borderLight, text: Colors.text.muted },
  };
  const v = variants[variant] || variants.info;

  return (
    <View style={[styles.badge, { backgroundColor: v.bg }, style]}>
      <Text style={[styles.text, { color: v.text }]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: Layout.radius.full,
    alignSelf: 'flex-start',
  },
  text: {
    fontSize: Layout.fontSize.xs,
    fontFamily: 'Nunito_600SemiBold',
    letterSpacing: 0.3,
  },
});
