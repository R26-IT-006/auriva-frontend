import React from 'react';
import { View, Text, Image, StyleSheet } from 'react-native';
import WORD_IMAGES from '../../data/wordImages';

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
  // Transparent, and no shadow. This used to be a white, shadowed card — and
  // every activity already draws its own surface around it, so an emoji
  // fallback rendered a second frame inside the first. The picture path was
  // always transparent; now both are.
  emojiBg: {
    backgroundColor: 'transparent',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
