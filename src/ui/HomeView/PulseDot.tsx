import React, { useEffect, useRef } from 'react';
import { Animated, StyleSheet, View } from 'react-native';
import type { DeptKey } from '../../game/DepartmentQueue';
import type { HomeTintsConfig } from './tintConfig';

interface Props {
  config: HomeTintsConfig;
  badges: Record<DeptKey, number>;
}

const DEPT_KEYS: DeptKey[] = ['sales', 'service', 'bdc', 'office', 'lot'];

function Dot({
  top,
  left,
  size,
  color,
  minOpacity,
  maxOpacity,
  durationMs,
  phaseOffsetMs,
}: {
  top: number;
  left: number;
  size: number;
  color: string;
  minOpacity: number;
  maxOpacity: number;
  durationMs: number;
  phaseOffsetMs: number;
}) {
  const anim = useRef(new Animated.Value(minOpacity)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(anim, {
          toValue: maxOpacity,
          duration: durationMs / 2,
          useNativeDriver: true,
          delay: phaseOffsetMs,
        }),
        Animated.timing(anim, {
          toValue: minOpacity,
          duration: durationMs / 2,
          useNativeDriver: true,
        }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [anim, minOpacity, maxOpacity, durationMs, phaseOffsetMs]);

  return (
    <Animated.View
      style={[
        styles.dot,
        {
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor: color,
          top: `${top * 100}%`,
          left: `${left * 100}%`,
          opacity: anim,
        },
      ]}
      pointerEvents="none"
    />
  );
}

export function PulseDots({ config, badges }: Props) {
  const { pulseZones, pulseDot } = config;

  const activeDepts = DEPT_KEYS.filter((k) => badges[k] > 0);
  if (activeDepts.length === 0) return null;

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      {activeDepts.map((dept, i) => {
        const zone = pulseZones[dept];
        return (
          <Dot
            key={dept}
            top={zone.top}
            left={zone.left}
            size={pulseDot.size}
            color={pulseDot.color}
            minOpacity={pulseDot.minOpacity}
            maxOpacity={pulseDot.maxOpacity}
            durationMs={pulseDot.durationMs}
            phaseOffsetMs={i * (pulseDot.durationMs / activeDepts.length)}
          />
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  dot: {
    position: 'absolute',
  },
});
