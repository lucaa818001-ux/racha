import { useEffect, useState } from 'react';
import { View, Text, TextInput, Pressable, ScrollView, StyleSheet, Alert } from 'react-native';
import { upsertWorkoutExerciseLog, finishWorkout, cancelWorkout } from '../lib/workouts';
import { getExerciseLogs } from '../lib/exercises';
import { mejorMarcaSesion } from '../lib/exerciciosCalculo';
import {
  calcularDuracionMinutos,
  calcularVolumenTotal,
  calcularTiempoTotalSegundos,
  esRecordPersonal,
} from '../lib/workoutsCalculo';
import DiagramaMusculo from './DiagramaMusculo';
import DescansoTimer from './DescansoTimer';
import AgregarEjercicioModal from './AgregarEjercicioModal';
import { colors } from '../theme/colors';

export default function EntrenamientoActivo({ userId, workout, entradasIniciales, onFinalizado, onCancelado }) {
  const [entradas, setEntradas] = useState(entradasIniciales);
  const [inputsPendientes, setInputsPendientes] = useState({});
  const [descansoSegundos, setDescansoSegundos] = useState(null);
  const [agregarVisible, setAgregarVisible] = useState(false);
  const [ahora, setAhora] = useState(new Date());

  useEffect(() => {
    const intervalo = setInterval(() => setAhora(new Date()), 1000);
    return () => clearInterval(intervalo);
  }, []);

  const segundosTranscurridos = Math.max(0, Math.floor((ahora - new Date(workout.started_at)) / 1000));
  const minutosTexto = String(Math.floor(segundosTranscurridos / 60)).padStart(2, '0');
  const segsTexto = String(segundosTranscurridos % 60).padStart(2, '0');

  function actualizarInputPendiente(exerciseId, cambios) {
    setInputsPendientes((actual) => ({ ...actual, [exerciseId]: { ...actual[exerciseId], ...cambios } }));
  }

  function agregarEjercicioAlWorkout(ejercicio) {
    setEntradas((actual) => [...actual, { exercise: ejercicio, sets: [], logId: null }]);
  }

  async function agregarSerie(entrada) {
    const pendiente = inputsPendientes[entrada.exercise.id] || {};
    const nuevoSet =
      entrada.exercise.type === 'tiempo'
        ? { duration_seg: Number(pendiente.duration_seg) || 0 }
        : { weight: Number(pendiente.weight) || 0, reps: Number(pendiente.reps) || 0 };
    const nuevosSets = [...entrada.sets, nuevoSet];
    try {
      const guardado = await upsertWorkoutExerciseLog(workout.id, entrada.exercise.id, userId, {
        date: new Date(),
        sets: nuevosSets,
      });
      setEntradas((actual) =>
        actual.map((e) => (e.exercise.id === entrada.exercise.id ? { ...e, sets: nuevosSets, logId: guardado.id } : e))
      );
      setInputsPendientes((actual) => ({ ...actual, [entrada.exercise.id]: {} }));
      if (entrada.exercise.rest_seconds) {
        setDescansoSegundos(entrada.exercise.rest_seconds);
      }
    } catch (e) {
      console.error('Error al guardar serie:', e.message, e);
      Alert.alert('Error', 'No se pudo guardar la serie, intentá de nuevo.');
    }
  }

  function handleFinalizar() {
    Alert.alert('Finalizar entrenamiento', '¿Terminaste tu entrenamiento?', [
      { text: 'Todavía no', style: 'cancel' },
      {
        text: 'Finalizar',
        onPress: async () => {
          try {
            await finishWorkout(workout.id);
            const finAhora = new Date();
            const duracion = calcularDuracionMinutos(new Date(workout.started_at), finAhora);
            const entradasConSets = entradas.filter((e) => e.sets.length > 0);
            const entradasConTipo = entradasConSets.map((e) => ({ type: e.exercise.type, sets: e.sets }));
            const volumen = calcularVolumenTotal(entradasConTipo);
            const tiempoTotal = calcularTiempoTotalSegundos(entradasConTipo);
            const totalSeries = entradasConSets.reduce((total, e) => total + e.sets.length, 0);

            const records = [];
            for (const entrada of entradasConSets) {
              const marcaNueva = mejorMarcaSesion(entrada.sets, entrada.exercise.type);
              const historial = await getExerciseLogs(entrada.exercise.id);
              const historialPrevio = historial.filter((log) => log.id !== entrada.logId);
              const marcasPrevias = historialPrevio.map((log) => mejorMarcaSesion(log.sets, entrada.exercise.type));
              const mejorPrevia = marcasPrevias.length > 0 ? Math.max(...marcasPrevias) : null;
              if (esRecordPersonal(marcaNueva, mejorPrevia)) records.push(entrada.exercise.name);
            }

            const resumen =
              `Duración: ${duracion} min\n` +
              `Ejercicios: ${entradasConSets.length}\n` +
              `Series totales: ${totalSeries}\n` +
              (volumen > 0 ? `Volumen total: ${volumen}kg\n` : '') +
              (tiempoTotal > 0 ? `Tiempo total: ${tiempoTotal}s\n` : '') +
              (records.length > 0 ? `🏆 Récord nuevo en: ${records.join(', ')}` : '');

            Alert.alert('¡Entrenamiento completado! 💪', resumen, [{ text: 'Listo', onPress: onFinalizado }]);
          } catch (e) {
            console.error('Error al finalizar entrenamiento:', e.message, e);
            Alert.alert('Error', 'No se pudo finalizar el entrenamiento, intentá de nuevo.');
          }
        },
      },
    ]);
  }

  function handleCancelar() {
    Alert.alert(
      'Cancelar entrenamiento',
      '¿Seguro que querés cancelar? Se pierde todo lo registrado en este entrenamiento.',
      [
        { text: 'No', style: 'cancel' },
        {
          text: 'Sí, cancelar',
          style: 'destructive',
          onPress: async () => {
            try {
              await cancelWorkout(workout.id);
              onCancelado();
            } catch (e) {
              console.error('Error al cancelar entrenamiento:', e.message, e);
              Alert.alert('Error', 'No se pudo cancelar, intentá de nuevo.');
            }
          },
        },
      ]
    );
  }

  return (
    <View style={styles.contenedor}>
      <View style={styles.encabezado}>
        <Text style={styles.cronometro}>
          ⏱ {minutosTexto}:{segsTexto}
        </Text>
        <Pressable onPress={handleFinalizar}>
          <Text style={styles.finalizarTexto}>Finalizar</Text>
        </Pressable>
      </View>
      <ScrollView contentContainerStyle={{ padding: 22 }}>
        {descansoSegundos !== null && (
          <DescansoTimer segundos={descansoSegundos} onFinalizar={() => setDescansoSegundos(null)} />
        )}
        {entradas.length === 0 && <Text style={styles.sinEjercicios}>Agregá tu primer ejercicio para arrancar.</Text>}
        {entradas.map((entrada) => {
          const pendiente = inputsPendientes[entrada.exercise.id] || {};
          return (
            <View key={entrada.exercise.id} style={styles.tarjeta}>
              <View style={styles.tarjetaEncabezado}>
                <DiagramaMusculo
                  photoPath={entrada.exercise.photo_path}
                  muscleGroup={entrada.exercise.muscle_group}
                  tamano={40}
                />
                <Text style={styles.tarjetaTitulo}>{entrada.exercise.name}</Text>
              </View>
              {entrada.sets.map((set, i) => (
                <Text key={i} style={styles.serieHecha}>
                  Serie {i + 1}: {entrada.exercise.type === 'tiempo' ? `${set.duration_seg}s` : `${set.weight}kg × ${set.reps}`}
                </Text>
              ))}
              <View style={styles.serieFila}>
                {entrada.exercise.type === 'tiempo' ? (
                  <TextInput
                    style={styles.serieInput}
                    placeholder="Segundos"
                    placeholderTextColor={colors.textTertiary}
                    keyboardType="number-pad"
                    value={pendiente.duration_seg || ''}
                    onChangeText={(valor) => actualizarInputPendiente(entrada.exercise.id, { duration_seg: valor })}
                  />
                ) : (
                  <>
                    <TextInput
                      style={styles.serieInput}
                      placeholder="Kg"
                      placeholderTextColor={colors.textTertiary}
                      keyboardType="decimal-pad"
                      value={pendiente.weight || ''}
                      onChangeText={(valor) => actualizarInputPendiente(entrada.exercise.id, { weight: valor })}
                    />
                    <TextInput
                      style={styles.serieInput}
                      placeholder="Reps"
                      placeholderTextColor={colors.textTertiary}
                      keyboardType="number-pad"
                      value={pendiente.reps || ''}
                      onChangeText={(valor) => actualizarInputPendiente(entrada.exercise.id, { reps: valor })}
                    />
                  </>
                )}
                <Pressable style={styles.agregarSerieBoton} onPress={() => agregarSerie(entrada)}>
                  <Text style={styles.agregarSerieTexto}>+ Serie</Text>
                </Pressable>
              </View>
            </View>
          );
        })}
        <Pressable style={styles.agregarEjercicioBoton} onPress={() => setAgregarVisible(true)}>
          <Text style={styles.agregarEjercicioTexto}>+ Agregar ejercicio</Text>
        </Pressable>
        <Pressable style={styles.cancelarBoton} onPress={handleCancelar}>
          <Text style={styles.cancelarTexto}>Cancelar entrenamiento</Text>
        </Pressable>
      </ScrollView>
      <AgregarEjercicioModal
        visible={agregarVisible}
        userId={userId}
        onAgregar={agregarEjercicioAlWorkout}
        onClose={() => setAgregarVisible(false)}
      />
    </View>
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
    backgroundColor: colors.surface,
  },
  cronometro: { fontFamily: 'SpaceGrotesk_700Bold', fontSize: 22, color: colors.textPrimary },
  finalizarTexto: { fontFamily: 'Inter_600SemiBold', fontSize: 16, color: colors.cobalto },
  sinEjercicios: { fontFamily: 'Inter_400Regular', color: colors.textTertiary, marginBottom: 16 },
  tarjeta: { backgroundColor: colors.surface, borderRadius: 16, padding: 14, marginBottom: 12 },
  tarjetaEncabezado: { flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
  tarjetaTitulo: { fontFamily: 'Inter_600SemiBold', fontSize: 15, color: colors.textPrimary, marginLeft: 10 },
  serieHecha: { fontFamily: 'Inter_400Regular', fontSize: 13, color: colors.textSecondary, marginBottom: 4 },
  serieFila: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 8 },
  serieInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    padding: 10,
    backgroundColor: colors.background,
    color: colors.textPrimary,
    fontFamily: 'Inter_400Regular',
  },
  agregarSerieBoton: { backgroundColor: colors.cobalto, borderRadius: 12, paddingVertical: 10, paddingHorizontal: 14 },
  agregarSerieTexto: { fontFamily: 'Inter_600SemiBold', color: '#fff', fontSize: 13 },
  agregarEjercicioBoton: {
    borderRadius: 20,
    paddingVertical: 16,
    alignItems: 'center',
    backgroundColor: colors.surface,
    marginBottom: 12,
  },
  agregarEjercicioTexto: { fontFamily: 'Inter_600SemiBold', color: colors.cobalto, fontSize: 15 },
  cancelarBoton: { borderRadius: 20, paddingVertical: 14, alignItems: 'center' },
  cancelarTexto: { fontFamily: 'Inter_500Medium', color: colors.racha.rojo, fontSize: 14 },
});
