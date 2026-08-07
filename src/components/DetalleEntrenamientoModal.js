import { Modal, View, Text, Pressable, ScrollView, Alert, StyleSheet } from 'react-native';
import { cancelWorkout } from '../lib/workouts';
import { calcularDuracionMinutos, calcularVolumenTotal } from '../lib/workoutsCalculo';
import { colors } from '../theme/colors';

function formatFechaLarga(fechaStr) {
  const d = new Date(fechaStr);
  return d.toLocaleDateString('es-AR', { day: 'numeric', month: 'long', year: 'numeric' });
}

export default function DetalleEntrenamientoModal({ visible, workout, onClose, onBorrado }) {
  if (!workout) return null;

  const logs = workout.exercise_logs ?? [];
  const duracion = calcularDuracionMinutos(new Date(workout.started_at), new Date(workout.ended_at));
  const volumen = calcularVolumenTotal(logs.map((log) => ({ type: log.exercises.type, sets: log.sets })));

  function handleBorrar() {
    Alert.alert('Borrar entrenamiento', '¿Seguro que querés borrar este entrenamiento? No se puede deshacer.', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Borrar',
        style: 'destructive',
        onPress: async () => {
          try {
            await cancelWorkout(workout.id);
            onBorrado();
            onClose();
          } catch (e) {
            console.error('Error al borrar entrenamiento:', e.message, e);
            Alert.alert('Error', 'No se pudo borrar, intentá de nuevo.');
          }
        },
      },
    ]);
  }

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <View style={styles.contenedor}>
        <View style={styles.encabezado}>
          <Text style={styles.titulo}>Entrenamiento</Text>
          <Pressable onPress={onClose} hitSlop={12}>
            <Text style={styles.cerrar}>✕</Text>
          </Pressable>
        </View>
        <ScrollView contentContainerStyle={{ padding: 22 }}>
          <Text style={styles.fecha}>{formatFechaLarga(workout.started_at)}</Text>
          <Text style={styles.resumen}>
            {duracion} min · {logs.length} ejercicio{logs.length === 1 ? '' : 's'}
            {volumen > 0 ? ` · ${volumen}kg` : ''}
          </Text>
          <Text style={styles.subtitulo}>Ejercicios</Text>
          {logs.length === 0 && <Text style={styles.sinDatos}>No se registró ningún ejercicio.</Text>}
          {logs.map((log, i) => (
            <View key={i} style={styles.fila}>
              <Text style={styles.filaTitulo}>{log.exercises.name}</Text>
              <Text style={styles.filaDetalle}>
                {log.sets
                  .map((s) => (log.exercises.type === 'tiempo' ? `${s.duration_seg}s` : `${s.weight}kg×${s.reps}`))
                  .join(', ')}
              </Text>
            </View>
          ))}
          <Pressable style={styles.botonBorrar} onPress={handleBorrar}>
            <Text style={styles.botonBorrarTexto}>Borrar entrenamiento</Text>
          </Pressable>
        </ScrollView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  contenedor: { flex: 1, backgroundColor: colors.background },
  encabezado: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 60,
    paddingHorizontal: 22,
    paddingBottom: 16,
  },
  titulo: { fontFamily: 'SpaceGrotesk_700Bold', fontSize: 20, color: colors.textPrimary },
  cerrar: { fontFamily: 'Inter_600SemiBold', fontSize: 20, color: colors.textPrimary },
  fecha: { fontFamily: 'Inter_600SemiBold', fontSize: 16, color: colors.textPrimary, marginBottom: 4 },
  resumen: { fontFamily: 'Inter_400Regular', fontSize: 13, color: colors.textSecondary, marginBottom: 20 },
  subtitulo: { fontFamily: 'SpaceGrotesk_600SemiBold', fontSize: 16, color: colors.textPrimary, marginBottom: 8 },
  sinDatos: { fontFamily: 'Inter_400Regular', color: colors.textTertiary },
  fila: { backgroundColor: colors.surface, borderRadius: 14, padding: 14, marginBottom: 8 },
  filaTitulo: { fontFamily: 'Inter_600SemiBold', fontSize: 14, color: colors.textPrimary },
  filaDetalle: { fontFamily: 'Inter_400Regular', fontSize: 13, color: colors.textSecondary, marginTop: 2 },
  botonBorrar: {
    marginTop: 16,
    borderRadius: 20,
    paddingVertical: 14,
    alignItems: 'center',
    backgroundColor: colors.surface,
  },
  botonBorrarTexto: { fontFamily: 'Inter_500Medium', color: colors.racha.rojo, fontSize: 14 },
});
