import { useEffect, useState } from 'react';
import { View, Text, Pressable, ScrollView, StyleSheet, Alert } from 'react-native';
import { createFolder, deleteFolder } from '../lib/exercises';
import { getRecentWorkouts } from '../lib/workouts';
import { calcularDuracionMinutos, calcularVolumenTotal } from '../lib/workoutsCalculo';
import CrearCarpetaModal from './CrearCarpetaModal';
import BibliotecaEjerciciosModal from './BibliotecaEjerciciosModal';
import { colors } from '../theme/colors';

function formatFecha(fechaStr) {
  const d = new Date(fechaStr);
  return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}`;
}

export default function EjerciciosDashboard({ userId, folders, ancho, onEmpezar, onRecargarFolders }) {
  const [crearCarpetaVisible, setCrearCarpetaVisible] = useState(false);
  const [bibliotecaVisible, setBibliotecaVisible] = useState(false);
  const [carpetaAbierta, setCarpetaAbierta] = useState(null);
  const [recientes, setRecientes] = useState([]);

  useEffect(() => {
    getRecentWorkouts(userId, 5).then(setRecientes);
  }, [userId]);

  async function handleCrearCarpeta(nombre) {
    try {
      await createFolder(userId, nombre);
      await onRecargarFolders();
      setCrearCarpetaVisible(false);
    } catch (e) {
      console.error('Error al crear rutina:', e.message, e);
      Alert.alert('Error', 'No se pudo crear la rutina, intentá de nuevo.');
    }
  }

  function handleBorrarCarpeta(folder) {
    Alert.alert('Borrar rutina', `¿Borrar la rutina "${folder.name}"? Los ejercicios no se borran.`, [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Borrar',
        style: 'destructive',
        onPress: async () => {
          try {
            await deleteFolder(folder.id);
            await onRecargarFolders();
          } catch (e) {
            console.error('Error al borrar rutina:', e.message, e);
            Alert.alert('Error', 'No se pudo borrar la rutina, intentá de nuevo.');
          }
        },
      },
    ]);
  }

  function abrirTodos() {
    setCarpetaAbierta({ id: null, name: 'Todos mis ejercicios' });
    setBibliotecaVisible(true);
  }

  function abrirCarpeta(folder) {
    setCarpetaAbierta(folder);
    setBibliotecaVisible(true);
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ padding: 22 }}>
      <Text style={styles.titulo}>Ejercicios</Text>
      <Pressable style={styles.empezarBoton} onPress={() => onEmpezar(null)}>
        <Text style={styles.empezarTexto}>▶ Empezar entrenamiento</Text>
      </Pressable>

      <View style={styles.seccionFila}>
        <Text style={styles.subtitulo}>Rutinas</Text>
        <Pressable onPress={() => setCrearCarpetaVisible(true)} hitSlop={12}>
          <Text style={styles.nuevaTexto}>+ Nueva</Text>
        </Pressable>
      </View>
      {folders.length === 0 && <Text style={styles.sinDatos}>Todavía no armaste ninguna rutina.</Text>}
      {folders.map((folder) => (
        <View key={folder.id} style={styles.fila}>
          <Pressable style={styles.filaContenido} onPress={() => abrirCarpeta(folder)}>
            <Text style={styles.filaTitulo}>📁 {folder.name}</Text>
            <Text style={styles.filaSubtitulo}>
              {folder.cantidadEjercicios} ejercicio{folder.cantidadEjercicios === 1 ? '' : 's'}
            </Text>
          </Pressable>
          <View style={styles.filaBotones}>
            <Pressable style={styles.empezarChico} onPress={() => onEmpezar(folder.id)}>
              <Text style={styles.empezarChicoTexto}>▶</Text>
            </Pressable>
            <Pressable onPress={() => handleBorrarCarpeta(folder)} hitSlop={8}>
              <Text style={styles.borrarTexto}>Borrar</Text>
            </Pressable>
          </View>
        </View>
      ))}

      <Pressable style={styles.biblioteca} onPress={abrirTodos}>
        <Text style={styles.bibliotecaTexto}>📋 Todos mis ejercicios</Text>
        <Text style={styles.flecha}>›</Text>
      </Pressable>

      <Text style={styles.subtitulo}>Entrenamientos recientes</Text>
      {recientes.length === 0 && <Text style={styles.sinDatos}>Todavía no completaste ningún entrenamiento.</Text>}
      {recientes.map((workout) => {
        const duracion = calcularDuracionMinutos(new Date(workout.started_at), new Date(workout.ended_at));
        const entradasConTipo = workout.exercise_logs.map((log) => ({ type: log.exercises.type, sets: log.sets }));
        const volumen = calcularVolumenTotal(entradasConTipo);
        return (
          <View key={workout.id} style={styles.tarjetaReciente}>
            <Text style={styles.recienteFecha}>{formatFecha(workout.started_at)}</Text>
            <Text style={styles.recienteDetalle}>
              {duracion} min · {workout.exercise_logs.length} ejercicio{workout.exercise_logs.length === 1 ? '' : 's'}
              {volumen > 0 ? ` · ${volumen}kg` : ''}
            </Text>
          </View>
        );
      })}

      <CrearCarpetaModal
        visible={crearCarpetaVisible}
        onGuardar={handleCrearCarpeta}
        onClose={() => setCrearCarpetaVisible(false)}
      />
      <BibliotecaEjerciciosModal
        visible={bibliotecaVisible}
        userId={userId}
        folderId={carpetaAbierta?.id ?? null}
        folderName={carpetaAbierta?.name ?? ''}
        folders={folders}
        ancho={ancho}
        onClose={() => setBibliotecaVisible(false)}
        onCambio={onRecargarFolders}
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  titulo: { fontSize: 28, fontFamily: 'SpaceGrotesk_700Bold', color: colors.textPrimary, marginBottom: 16 },
  empezarBoton: {
    borderRadius: 20,
    paddingVertical: 18,
    alignItems: 'center',
    backgroundColor: colors.cobalto,
    marginBottom: 24,
  },
  empezarTexto: { fontFamily: 'Inter_700Bold', color: '#fff', fontSize: 17 },
  seccionFila: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  subtitulo: { fontFamily: 'SpaceGrotesk_600SemiBold', fontSize: 18, color: colors.textPrimary, marginTop: 20, marginBottom: 8 },
  nuevaTexto: { fontFamily: 'Inter_600SemiBold', fontSize: 14, color: colors.cobalto },
  sinDatos: { fontFamily: 'Inter_400Regular', color: colors.textTertiary, marginBottom: 8 },
  fila: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.surface,
    borderRadius: 14,
    padding: 14,
    marginBottom: 8,
  },
  filaContenido: { flex: 1 },
  filaTitulo: { fontFamily: 'Inter_600SemiBold', fontSize: 15, color: colors.textPrimary },
  filaSubtitulo: { fontFamily: 'Inter_400Regular', fontSize: 12, color: colors.textTertiary, marginTop: 2 },
  filaBotones: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  empezarChico: { backgroundColor: colors.cobalto, borderRadius: 10, paddingVertical: 6, paddingHorizontal: 10 },
  empezarChicoTexto: { color: '#fff', fontSize: 13, fontFamily: 'Inter_600SemiBold' },
  borrarTexto: { fontFamily: 'Inter_500Medium', color: colors.racha.rojo, fontSize: 13 },
  biblioteca: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.surface,
    borderRadius: 14,
    padding: 16,
    marginTop: 8,
  },
  bibliotecaTexto: { fontFamily: 'Inter_600SemiBold', fontSize: 15, color: colors.textPrimary },
  flecha: { fontSize: 22, color: colors.textTertiary },
  tarjetaReciente: { backgroundColor: colors.surface, borderRadius: 14, padding: 14, marginBottom: 8 },
  recienteFecha: { fontFamily: 'Inter_600SemiBold', color: colors.textPrimary, fontSize: 14 },
  recienteDetalle: { fontFamily: 'Inter_400Regular', color: colors.textSecondary, fontSize: 13, marginTop: 2 },
});
