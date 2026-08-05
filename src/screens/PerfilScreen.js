import { View, Text, Pressable, StyleSheet } from 'react-native';
import { supabase } from '../lib/supabase';
import { colors } from '../theme/colors';

export default function PerfilScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.text}>Perfil</Text>
      <Pressable style={styles.signOutButton} onPress={() => supabase.auth.signOut()}>
        <Text style={styles.signOutText}>Cerrar sesión</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.background },
  text: { fontSize: 24, fontFamily: 'SpaceGrotesk_700Bold', color: colors.textPrimary, marginBottom: 32 },
  signOutButton: {
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 20,
    backgroundColor: colors.racha.rojo,
  },
  signOutText: { fontFamily: 'Inter_600SemiBold', color: '#fff', fontSize: 15 },
});
