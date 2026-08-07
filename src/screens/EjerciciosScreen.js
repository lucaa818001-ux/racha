import { useCallback, useState } from 'react';
import { View, ActivityIndicator, StyleSheet, Dimensions } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { supabase } from '../lib/supabase';
import { getFolders, getExercises } from '../lib/exercises';
import { getActiveWorkout, getWorkoutExerciseLogs, startWorkout } from '../lib/workouts';
import EjerciciosDashboard from '../components/EjerciciosDashboard';
import EntrenamientoActivo from '../components/EntrenamientoActivo';
import { colors } from '../theme/colors';

const ANCHO_GRAFICO = Dimensions.get('window').width - 44 - 32;

export default function EjerciciosScreen() {
  const [userId, setUserId] = useState(null);
  const [folders, setFolders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [workoutActivo, setWorkoutActivo] = useState(null);
  const [entradasWorkout, setEntradasWorkout] = useState([]);

  const cargarFolders = useCallback(async (uid) => {
    const data = await getFolders(uid);
    setFolders(data);
  }, []);

  useFocusEffect(
    useCallback(() => {
      let cancelado = false;
      supabase.auth.getUser().then(async ({ data: { user } }) => {
        if (cancelado) return;
        setUserId(user.id);
        await cargarFolders(user.id);
        const activo = await getActiveWorkout(user.id);
        if (cancelado) return;
        if (activo) {
          const logs = await getWorkoutExerciseLogs(activo.id);
          if (cancelado) return;
          setWorkoutActivo(activo);
          setEntradasWorkout(logs.map((log) => ({ exercise: log.exercises, sets: log.sets, logId: log.id })));
        }
        if (!cancelado) setLoading(false);
      });
      return () => {
        cancelado = true;
      };
    }, [cargarFolders])
  );

  async function empezarEntrenamiento(folderId) {
    const workout = await startWorkout(userId, folderId);
    let entradas = [];
    if (folderId !== null) {
      const ejerciciosRutina = await getExercises(userId, folderId);
      entradas = ejerciciosRutina.map((ejercicio) => ({ exercise: ejercicio, sets: [], logId: null }));
    }
    setWorkoutActivo(workout);
    setEntradasWorkout(entradas);
  }

  function volverAlDashboard() {
    setWorkoutActivo(null);
    setEntradasWorkout([]);
    cargarFolders(userId);
  }

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={colors.cobalto} />
      </View>
    );
  }

  if (workoutActivo) {
    return (
      <EntrenamientoActivo
        userId={userId}
        workout={workoutActivo}
        entradasIniciales={entradasWorkout}
        onFinalizado={volverAlDashboard}
        onCancelado={volverAlDashboard}
      />
    );
  }

  return (
    <EjerciciosDashboard
      userId={userId}
      folders={folders}
      ancho={ANCHO_GRAFICO}
      onEmpezar={empezarEntrenamiento}
      onRecargarFolders={() => cargarFolders(userId)}
    />
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, backgroundColor: colors.background, alignItems: 'center', justifyContent: 'center' },
});
