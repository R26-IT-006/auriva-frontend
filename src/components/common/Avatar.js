import React from 'react';
import { View, Text, Image, StyleSheet } from 'react-native';
import { Colors } from '../../constants/colors';
import { Layout } from '../../constants/layout';
import { getInitials } from '../../utils/formatters';

const AVATAR_COLORS = [
  ['#6B8EE8', '#8BAAF0'],
  ['#F4845F', '#F9A58A'],
  ['#52C41A', '#7ED955'],
  ['#722ED1', '#9254DE'],
  ['#13C2C2', '#36CFC9'],
];

function pickColor(name) {
  if (!name) return AVATAR_COLORS[0];
  const idx = name.charCodeAt(0) % AVATAR_COLORS.length;
  return AVATAR_COLORS[idx];
}

export function Avatar({ name, uri, size = 44, style }) {
  const colors = pickColor(name);
  const initials = getInitials(name);

  const containerStyle = {
    width: size,
    height: size,
    borderRadius: size / 2,
    backgroundColor: colors[0],
  };

  if (uri) {
    return (
      <Image
        source={{ uri }}
        style={[containerStyle, styles.image, style]}
        resizeMode="cover"
      />
    );
  }

  return (
    <View style={[containerStyle, styles.placeholder, style]}>
      <Text style={[styles.initials, { fontSize: size * 0.36 }]}>{initials}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  image: {
    overflow: 'hidden',
  },
  placeholder: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  initials: {
    color: '#FFFFFF',
    fontWeight: Layout.fontWeight.bold,
  },
});
