import { View, Text, StyleSheet } from 'react-native';
import { ROLE_LABELS, ROLE_COLORS } from '../utils/rbac';

export default function RoleBadge({ role }) {
  if (!role) return null;
  const color = ROLE_COLORS[role];
  return (
    <View style={[styles.pill, { borderColor: color, backgroundColor: color + '25' }]}>
      <View style={[styles.orb, { backgroundColor: color }]} />
      <Text style={[styles.text, { color }]}>{ROLE_LABELS[role]}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderWidth: 1,
    borderRadius: 20,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  orb:  { width: 7, height: 7, borderRadius: 4 },
  text: { fontSize: 9, fontWeight: '800', letterSpacing: 1.2 },
});
