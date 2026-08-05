import { useEffect, useState } from 'react';
import { View, Text, Pressable, StyleSheet, Platform } from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { supabase } from '../lib/supabase';
import { getCheckinsForRange } from '../lib/checkins';
import { getHoraRecordatorio, setHoraRecordatorio, sincronizarRecordatorios } from '../lib/recordatorio';
import { colors } from '../theme/colors';

export default function PerfilScreen() {
  const [hora, setHora] = useState('20:00');

  useEffect(() => {
    getHoraRecordatorio().then(setHora);
  }, []);

  async function alCambiarHora(event, fecha) {
    if (!fecha) return;
    const horaStr = `${String(fecha.getHours()).padStart(2, '0')}:${String(fecha.getMinutes()).padStart(2, '0')}`;
    setHora(horaStr);
    await setHoraRecordatorio(horaStr);

    const { data: { user } } = await supabase.auth.getUser();
    const hoy = new Date();
    const checkins = await getCheckinsForRange(
      user.id,
      new Date(hoy.getFullYear(), 0, 1),
      new Date(hoy.getFullYear(), 11, 31)
    );
    await sincronizarRecordatorios(checkins);
  }

  const [horas, minutos] = hora.split(':').map(Number);
  const valorPicker = new Date();
  valorPicker.setHours(horas, minutos, 0, 0);

  return (
    <View style={styles.container}>
      <Text style={styles.text}>Perfil</Text>
      <View style={styles.fila}>
        <Text style={styles.filaTexto}>Recordatorio</Text>
        <DateTimePicker
          value={valorPicker}
          mode="time"
          display={Platform.OS === 'ios' ? 'compact' : 'default'}
          themeVariant="dark"
          onChange={alCambiarHora}
        />
      </View>
      <Pressable style={styles.signOutButton} onPress={() => supabase.auth.signOut()}>
        <Text style={styles.signOutText}>Cerrar sesión</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.background },
  text: { fontSize: 24, fontFamily: 'SpaceGrotesk_700Bold', color: colors.textPrimary, marginBottom: 24 },
  fila: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: 220,
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderRadius: 14,
    backgroundColor: colors.surface,
    marginBottom: 32,
  },
  filaTexto: { fontFamily: 'Inter_500Medium', color: colors.textPrimary, fontSize: 15 },
  signOutButton: {
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 20,
    backgroundColor: colors.racha.rojo,
  },
  signOutText: { fontFamily: 'Inter_600SemiBold', color: '#fff', fontSize: 15 },
});
