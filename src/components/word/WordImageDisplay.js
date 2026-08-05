import React from 'react';
import { View, Text, Image, StyleSheet } from 'react-native';
import WORD_IMAGES from '../../constants/wordImages';

export default function WordImageDisplay({ imageKey, emoji, size = 120 }) {
  const source = WORD_IMAGES[imageKey];
  const radius = Math.round(size * 0.18);

  if (source) {
    return (
      <Image
        source={source}
        style={[styles.img, { width: size, height: size, borderRadius: radius }]}
        resizeMode="contain"
      />
    );
  }

  return (
    <View style={[styles.emojiBg, { width: size, height: size, borderRadius: radius }]}>
      <Text style={{ fontSize: size * 0.52, lineHeight: size * 0.72 }}>{emoji}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  img: {
    backgroundColor: 'transparent',
  },
  emojiBg: {
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 6,
    elevation: 2,
  },
});
