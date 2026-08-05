import { View, Text, StyleSheet } from 'react-native';
import { colors } from '../theme/colors';

export default function EjerciciosScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.text}>Ejercicios</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.background },
  text: { fontSize: 24, fontFamily: 'SpaceGrotesk_700Bold', color: colors.textPrimary },
});
