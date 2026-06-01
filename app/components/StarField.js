import { useMemo } from 'react';
import { View, StyleSheet } from 'react-native';

const generateStars = (count) =>
  Array.from({ length: count }, (_, i) => ({
    id: i,
    size: Math.random() * 3 + 1,
    opacity: (((i * 17) % 7) + 2) * 0.06,
    left: ((i * 37 + 13) % 95) + 2,
    top: ((i * 53 + 7) % 90) + 2,
  }));

export default function StarField({ count = 150 }) {
  const stars = useMemo(() => generateStars(count), [count]);
  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      {stars.map(s => (
        <View
          key={s.id}
          style={{
            position: 'absolute',
            width: s.size,
            height: s.size,
            borderRadius: s.size,
            backgroundColor: '#FFFFFF',
            opacity: s.opacity,
            left: `${s.left}%`,
            top: `${s.top}%`,
          }}
        />
      ))}
    </View>
  );
}
