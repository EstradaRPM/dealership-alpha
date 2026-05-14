import React from 'react';
import { View, StyleSheet } from 'react-native';

interface Props {
  color: string;
  opacity: number;
}

export function TintOverlay({ color, opacity }: Props) {
  return (
    <View
      style={[styles.overlay, { backgroundColor: color, opacity }]}
      pointerEvents="none"
    />
  );
}

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
  },
});
