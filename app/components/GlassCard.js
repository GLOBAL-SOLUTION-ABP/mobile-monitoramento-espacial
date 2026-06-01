import { View, StyleSheet } from 'react-native';

export default function GlassCard({ children, style }) {
  return (
    <View style={[styles.card, style]}>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#120028',
    borderRadius: 20,
    padding: 18,
    borderWidth: 1,
    borderColor: '#3A1A6A',
    elevation: 8,
    shadowColor: '#B478F0',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
  },
});
