import { useCallback, useEffect, useState } from 'react';
import {
  Modal,
  View,
  Text,
  TextInput,
  Pressable,
  ScrollView,
  ActivityIndicator,
  StyleSheet,
  Alert,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { getExercises, createExercise, deleteExercise, updateFolderItem, getExerciseLogs } from '../lib/exercises';
import DiagramaMusculo from './DiagramaMusculo';
import EjercicioChart from './EjercicioChart';
import { CATALOGO_EJERCICIOS } from '../lib/catalogoEjercicios';
import { colors } from '../theme/colors';

const GRUPOS_MUSCULARES = [
  { key: 'pecho', label: 'Pecho' },
  { key: 'espalda', label: 'Espalda' },
  { key: 'cuadriceps', label: 'Cuádriceps' },
  { key: 'isquios_gluteos', label: 'Isquios/Glúteos' },
  { key: 'hombros', label: 'Hombros' },
  { key: 'biceps', label: 'Bíceps' },
  { key: 'triceps', label: 'Tríceps' },
  { key: 'core', label: 'Core' },
  { key: 'cardio', label: 'Cardio' },
  { key: 'otro', label: 'Otro' },
];

export default function BibliotecaEjerciciosModal({ visible, userId, folderId, folderName, folders, ancho, onClose, onCambio }) {
  const [vista, setVista] = useState('lista');
  const [cargando, setCargando] = useState(true);
  const [ejercicios, setEjercicios] = useState([]);
  const [seleccionado, setSeleccionado] = useState(null);
  const [logs, setLogs] = useState([]);

  const [nombre, setNombre] = useState('');
  const [muscleGroup, setMuscleGroup] = useState(null);
  const [tipo, setTipo] = useState('peso_reps');
  const [restSeconds, setRestSeconds] = useState('');
  const [photoUri, setPhotoUri] = useState(null);
  const [folderIdsSeleccionadas, setFolderIdsSeleccionadas] = useState([]);
  const [guardandoCrear, setGuardandoCrear] = useState(false);

  const [orden, setOrden] = useState('');
  const [targetSets, setTargetSets] = useState('');
  const [targetReps, setTargetReps] = useState('');
  const [targetDurationSeg, setTargetDurationSeg] = useState('');
  const [guardandoObjetivo, setGuardandoObjetivo] = useState(false);

  const cargarEjercicios = useCallback(async () => {
    setCargando(true);
    const data = await getExercises(userId, folderId);
    setEjercicios(data);
    setCargando(false);
  }, [userId, folderId]);

  useEffect(() => {
    if (!visible) return;
    setVista('lista');
    setSeleccionado(null);
    cargarEjercicios();
  }, [visible, cargarEjercicios]);

  async function abrirDetalle(ejercicio) {
    setSeleccionado(ejercicio);
    setVista('detalle');
    const data = await getExerciseLogs(ejercicio.id);
    setLogs(data);
  }

  function abrirEditarObjetivo(ejercicio) {
    setSeleccionado(ejercicio);
    setOrden(ejercicio.orden !== null && ejercicio.orden !== undefined ? String(ejercicio.orden) : '');
    setTargetSets(
      ejercicio.target_sets !== null && ejercicio.target_sets !== undefined ? String(ejercicio.target_sets) : ''
    );
    setTargetReps(
      ejercicio.target_reps !== null && ejercicio.target_reps !== undefined ? String(ejercicio.target_reps) : ''
    );
    setTargetDurationSeg(
      ejercicio.target_duration_seg !== null && ejercicio.target_duration_seg !== undefined
        ? String(ejercicio.target_duration_seg)
        : ''
    );
    setVista('editarObjetivo');
  }

  function abrirCrear() {
    setNombre('');
    setMuscleGroup(null);
    setTipo('peso_reps');
    setRestSeconds('');
    setPhotoUri(null);
    setFolderIdsSeleccionadas(folderId !== null ? [folderId] : []);
    setVista('crear');
  }

  function abrirCatalogo() {
    setVista('catalogo');
  }

  function elegirDeCatalogo(item) {
    setNombre(item.name);
    setMuscleGroup(item.muscleGroup);
    setTipo(item.type);
    setVista('crear');
  }

  function volver() {
    if (vista === 'catalogo') setVista('crear');
    else setVista('lista');
  }

  function toggleFolderSeleccionada(id) {
    setFolderIdsSeleccionadas((actual) => (actual.includes(id) ? actual.filter((f) => f !== id) : [...actual, id]));
  }

  async function elegirFoto(origen) {
    const permiso =
      origen === 'camara'
        ? await ImagePicker.requestCameraPermissionsAsync()
        : await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permiso.granted) {
      Alert.alert('Permiso necesario', 'Activá el permiso correspondiente en Ajustes.');
      return;
    }
    const resultado =
      origen === 'camara'
        ? await ImagePicker.launchCameraAsync({ quality: 0.6 })
        : await ImagePicker.launchImageLibraryAsync({ quality: 0.6 });
    if (!resultado.canceled) setPhotoUri(resultado.assets[0].uri);
  }

  function elegirOrigenFoto() {
    Alert.alert('Agregar foto', '¿Cómo querés agregarla?', [
      { text: 'Tomar foto', onPress: () => elegirFoto('camara') },
      { text: 'Elegir de galería', onPress: () => elegirFoto('galeria') },
      { text: 'Cancelar', style: 'cancel' },
    ]);
  }

  async function handleGuardarEjercicio() {
    setGuardandoCrear(true);
    try {
      await createExercise(userId, {
        name: nombre.trim(),
        muscleGroup,
        type: tipo,
        restSeconds: restSeconds.trim() !== '' ? Number(restSeconds) : null,
        photoUri,
        folderIds: folderIdsSeleccionadas,
      });
      await cargarEjercicios();
      onCambio?.();
      setVista('lista');
    } catch (e) {
      console.error('Error al crear ejercicio:', e.message, e);
      Alert.alert('Error', 'No se pudo crear el ejercicio, intentá de nuevo.');
    } finally {
      setGuardandoCrear(false);
    }
  }

  async function handleGuardarObjetivo() {
    setGuardandoObjetivo(true);
    try {
      await updateFolderItem(seleccionado.id, folderId, {
        orden: orden.trim() !== '' ? Number(orden) : null,
        targetSets: targetSets.trim() !== '' ? Number(targetSets) : null,
        targetReps: targetReps.trim() !== '' ? Number(targetReps) : null,
        targetDurationSeg: targetDurationSeg.trim() !== '' ? Number(targetDurationSeg) : null,
      });
      await cargarEjercicios();
      setVista('lista');
    } catch (e) {
      console.error('Error al guardar objetivo:', e.message, e);
      Alert.alert('Error', 'No se pudo guardar, intentá de nuevo.');
    } finally {
      setGuardandoObjetivo(false);
    }
  }

  function handleBorrarEjercicio() {
    const mensaje =
      logs.length > 0
        ? `"${seleccionado.name}" tiene ${logs.length} sesión(es) registradas que se van a perder. ¿Borrar de todas formas?`
        : `¿Borrar "${seleccionado.name}"?`;
    Alert.alert('Borrar ejercicio', mensaje, [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Borrar',
        style: 'destructive',
        onPress: async () => {
          await deleteExercise(seleccionado.id, seleccionado.photo_path);
          await cargarEjercicios();
          onCambio?.();
          setVista('lista');
        },
      },
    ]);
  }

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <View style={styles.contenedor}>
        <View style={styles.encabezado}>
          {vista === 'lista' ? (
            <Text style={styles.titulo}>{folderName}</Text>
          ) : (
            <Pressable onPress={volver} hitSlop={12}>
              <Text style={styles.volver}>‹ {vista === 'catalogo' ? 'Crear ejercicio' : folderName}</Text>
            </Pressable>
          )}
          <View style={styles.encabezadoBotones}>
            {vista === 'lista' && (
              <Pressable onPress={abrirCrear} hitSlop={12}>
                <Text style={styles.masBoton}>➕</Text>
              </Pressable>
            )}
            <Pressable onPress={onClose} hitSlop={12}>
              <Text style={styles.cerrar}>✕</Text>
            </Pressable>
          </View>
        </View>

        {vista === 'lista' &&
          (cargando ? (
            <ActivityIndicator size="large" color={colors.cobalto} style={{ marginTop: 40 }} />
          ) : (
            <ScrollView contentContainerStyle={{ padding: 22 }}>
              {ejercicios.length === 0 && (
                <View style={styles.vacioContenedor}>
                  <Text style={styles.vacioEmoji}>🏋️‍♂️</Text>
                  <Text style={styles.vacioTitulo}>Todavía no hay ejercicios acá</Text>
                  <Text style={styles.vacioSubtitulo}>Creá el primero o elegí uno de la lista</Text>
                </View>
              )}
              {ejercicios.map((ejercicio) => (
                <View key={ejercicio.id} style={styles.fila}>
                  <Pressable style={styles.filaContenido} onPress={() => abrirDetalle(ejercicio)}>
                    <DiagramaMusculo photoPath={ejercicio.photo_path} muscleGroup={ejercicio.muscle_group} tamano={44} />
                    <View style={styles.filaTextos}>
                      <Text style={styles.filaTitulo}>{ejercicio.name}</Text>
                      <Text style={styles.filaSubtitulo}>
                        {ejercicio.type === 'tiempo' ? 'Tiempo' : 'Peso/reps'}
                        {ejercicio.target_sets
                          ? ` · objetivo ${ejercicio.target_sets}x${
                              ejercicio.type === 'tiempo' ? `${ejercicio.target_duration_seg}s` : ejercicio.target_reps
                            }`
                          : ''}
                      </Text>
                    </View>
                  </Pressable>
                  {folderId !== null && (
                    <Pressable onPress={() => abrirEditarObjetivo(ejercicio)} hitSlop={8}>
                      <Text style={styles.editarTexto}>Editar</Text>
                    </Pressable>
                  )}
                </View>
              ))}
            </ScrollView>
          ))}

        {vista === 'detalle' && seleccionado && (
          <ScrollView contentContainerStyle={{ padding: 22 }}>
            <Text style={styles.tituloDetalle}>{seleccionado.name}</Text>
            <View style={styles.detalleCentro}>
              <DiagramaMusculo photoPath={seleccionado.photo_path} muscleGroup={seleccionado.muscle_group} tamano={120} />
            </View>
            {seleccionado.rest_seconds ? (
              <Text style={styles.descansoTexto}>⏱ Descanso de referencia: {seleccionado.rest_seconds}s</Text>
            ) : null}
            <EjercicioChart logs={logs} type={seleccionado.type} ancho={ancho} />
            <Text style={styles.subtitulo}>Historial</Text>
            {logs.length === 0 && <Text style={styles.sinEjercicios}>Todavía no registraste ninguna sesión.</Text>}
            {[...logs].reverse().map((log) => (
              <View key={log.id} style={styles.filaHistorial}>
                <Text style={styles.filaFecha}>{log.date}</Text>
                <Text style={styles.filaDetalle}>
                  {log.sets
                    .map((s) => (seleccionado.type === 'tiempo' ? `${s.duration_seg}s` : `${s.weight}kg×${s.reps}`))
                    .join(', ')}
                </Text>
              </View>
            ))}
            <Pressable style={styles.botonBorrar} onPress={handleBorrarEjercicio}>
              <Text style={styles.botonBorrarTexto}>Borrar ejercicio</Text>
            </Pressable>
          </ScrollView>
        )}

        {vista === 'crear' && (
          <ScrollView contentContainerStyle={{ padding: 22 }}>
            <Text style={styles.tituloDetalle}>Crear ejercicio</Text>
            <Pressable style={styles.fotoButton} onPress={abrirCatalogo}>
              <Text style={styles.fotoButtonTexto}>📋 Elegir de la lista</Text>
            </Pressable>
            <TextInput
              style={styles.input}
              placeholder="Nombre del ejercicio"
              placeholderTextColor={colors.textTertiary}
              value={nombre}
              onChangeText={setNombre}
            />
            <Text style={styles.etiqueta}>Grupo muscular</Text>
            <View style={styles.gridChips}>
              {GRUPOS_MUSCULARES.map((grupo) => (
                <Pressable
                  key={grupo.key}
                  style={[styles.chip, muscleGroup === grupo.key && styles.chipActivo]}
                  onPress={() => setMuscleGroup(grupo.key)}
                >
                  <Text style={styles.chipTexto}>{grupo.label}</Text>
                </Pressable>
              ))}
            </View>
            <Text style={styles.etiqueta}>Tipo</Text>
            <View style={styles.tipoFila}>
              <Pressable
                style={[styles.tipoBoton, tipo === 'peso_reps' && styles.tipoBotonActivo]}
                onPress={() => setTipo('peso_reps')}
              >
                <Text style={styles.tipoBotonTexto}>Peso/reps</Text>
              </Pressable>
              <Pressable
                style={[styles.tipoBoton, tipo === 'tiempo' && styles.tipoBotonActivo]}
                onPress={() => setTipo('tiempo')}
              >
                <Text style={styles.tipoBotonTexto}>Tiempo</Text>
              </Pressable>
            </View>
            <TextInput
              style={styles.input}
              placeholder="Descanso en segundos (opcional)"
              placeholderTextColor={colors.textTertiary}
              keyboardType="number-pad"
              value={restSeconds}
              onChangeText={setRestSeconds}
            />
            <Pressable style={styles.fotoButton} onPress={elegirOrigenFoto}>
              <Text style={styles.fotoButtonTexto}>{photoUri ? 'Foto lista ✓' : 'Agregar foto (opcional)'}</Text>
            </Pressable>
            {folders.length > 0 && (
              <>
                <Text style={styles.etiqueta}>Rutinas</Text>
                <View style={styles.gridChips}>
                  {folders.map((folder) => (
                    <Pressable
                      key={folder.id}
                      style={[styles.chip, folderIdsSeleccionadas.includes(folder.id) && styles.chipActivo]}
                      onPress={() => toggleFolderSeleccionada(folder.id)}
                    >
                      <Text style={styles.chipTexto}>{folder.name}</Text>
                    </Pressable>
                  ))}
                </View>
              </>
            )}
            <Pressable
              style={[
                styles.guardarButton,
                (!nombre.trim() || !muscleGroup || guardandoCrear) && styles.guardarButtonDeshabilitado,
              ]}
              disabled={!nombre.trim() || !muscleGroup || guardandoCrear}
              onPress={handleGuardarEjercicio}
            >
              <Text style={styles.guardarButtonTexto}>{guardandoCrear ? 'Guardando...' : 'Guardar'}</Text>
            </Pressable>
          </ScrollView>
        )}

        {vista === 'catalogo' && (
          <ScrollView contentContainerStyle={{ padding: 22 }}>
            <Text style={styles.tituloDetalle}>Elegir de la lista</Text>
            {GRUPOS_MUSCULARES.map((grupo) => {
              const items = CATALOGO_EJERCICIOS.filter((item) => item.muscleGroup === grupo.key);
              if (items.length === 0) return null;
              return (
                <View key={grupo.key} style={{ marginBottom: 16 }}>
                  <Text style={styles.subtituloCatalogo}>{grupo.label}</Text>
                  {items.map((item) => (
                    <Pressable key={item.name} style={styles.filaCatalogo} onPress={() => elegirDeCatalogo(item)}>
                      <Text style={styles.filaCatalogoTexto}>{item.name}</Text>
                      <Text style={styles.flecha}>›</Text>
                    </Pressable>
                  ))}
                </View>
              );
            })}
          </ScrollView>
        )}

        {vista === 'editarObjetivo' && seleccionado && (
          <ScrollView contentContainerStyle={{ padding: 22 }}>
            <Text style={styles.tituloDetalle}>Editar en esta rutina</Text>
            <TextInput
              style={styles.input}
              placeholder="Orden (ej: 1)"
              placeholderTextColor={colors.textTertiary}
              keyboardType="number-pad"
              value={orden}
              onChangeText={setOrden}
            />
            <TextInput
              style={styles.input}
              placeholder="Series objetivo (ej: 4)"
              placeholderTextColor={colors.textTertiary}
              keyboardType="number-pad"
              value={targetSets}
              onChangeText={setTargetSets}
            />
            {seleccionado.type === 'tiempo' ? (
              <TextInput
                style={styles.input}
                placeholder="Duración objetivo en segundos (ej: 60)"
                placeholderTextColor={colors.textTertiary}
                keyboardType="number-pad"
                value={targetDurationSeg}
                onChangeText={setTargetDurationSeg}
              />
            ) : (
              <TextInput
                style={styles.input}
                placeholder="Reps objetivo (ej: 8)"
                placeholderTextColor={colors.textTertiary}
                keyboardType="number-pad"
                value={targetReps}
                onChangeText={setTargetReps}
              />
            )}
            <Pressable
              style={[styles.guardarButton, guardandoObjetivo && styles.guardarButtonDeshabilitado]}
              disabled={guardandoObjetivo}
              onPress={handleGuardarObjetivo}
            >
              <Text style={styles.guardarButtonTexto}>{guardandoObjetivo ? 'Guardando...' : 'Guardar'}</Text>
            </Pressable>
          </ScrollView>
        )}
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
  encabezadoBotones: { flexDirection: 'row', alignItems: 'center', gap: 16 },
  titulo: { fontFamily: 'SpaceGrotesk_700Bold', fontSize: 20, color: colors.textPrimary },
  tituloDetalle: {
    fontFamily: 'SpaceGrotesk_700Bold',
    fontSize: 20,
    color: colors.textPrimary,
    marginBottom: 16,
  },
  volver: { fontFamily: 'Inter_600SemiBold', fontSize: 16, color: colors.cobalto },
  masBoton: { fontSize: 20 },
  cerrar: { fontFamily: 'Inter_600SemiBold', fontSize: 20, color: colors.textPrimary },
  sinEjercicios: { fontFamily: 'Inter_400Regular', color: colors.textTertiary },
  vacioContenedor: { alignItems: 'center', paddingVertical: 40 },
  vacioEmoji: { fontSize: 48, marginBottom: 12 },
  vacioTitulo: { fontFamily: 'Inter_600SemiBold', fontSize: 15, color: colors.textPrimary, marginBottom: 4 },
  vacioSubtitulo: { fontFamily: 'Inter_400Regular', fontSize: 13, color: colors.textTertiary },
  subtituloCatalogo: {
    fontFamily: 'SpaceGrotesk_600SemiBold',
    fontSize: 15,
    color: colors.cobalto,
    marginBottom: 8,
  },
  filaCatalogo: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.surface,
    borderRadius: 12,
    padding: 12,
    marginBottom: 6,
  },
  filaCatalogoTexto: { fontFamily: 'Inter_400Regular', fontSize: 14, color: colors.textPrimary },
  flecha: { fontSize: 20, color: colors.textTertiary },
  fila: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.surface,
    borderRadius: 14,
    padding: 12,
    marginBottom: 8,
  },
  filaContenido: { flexDirection: 'row', alignItems: 'center', flex: 1 },
  filaTextos: { marginLeft: 12, flex: 1 },
  filaTitulo: { fontFamily: 'Inter_600SemiBold', fontSize: 14, color: colors.textPrimary },
  filaSubtitulo: { fontFamily: 'Inter_400Regular', fontSize: 12, color: colors.textTertiary, marginTop: 2 },
  editarTexto: { fontFamily: 'Inter_500Medium', fontSize: 12, color: colors.cobalto },
  detalleCentro: { alignItems: 'center', marginBottom: 16 },
  descansoTexto: {
    fontFamily: 'Inter_400Regular',
    fontSize: 13,
    color: colors.textSecondary,
    textAlign: 'center',
    marginBottom: 8,
  },
  subtitulo: {
    fontFamily: 'SpaceGrotesk_600SemiBold',
    fontSize: 18,
    color: colors.textPrimary,
    marginTop: 24,
    marginBottom: 12,
  },
  filaHistorial: { backgroundColor: colors.surface, borderRadius: 14, padding: 14, marginBottom: 8 },
  filaFecha: { fontFamily: 'Inter_600SemiBold', color: colors.textPrimary, fontSize: 14 },
  filaDetalle: { fontFamily: 'Inter_400Regular', color: colors.textSecondary, fontSize: 13, marginTop: 2 },
  botonBorrar: {
    marginTop: 16,
    borderRadius: 20,
    paddingVertical: 14,
    alignItems: 'center',
    backgroundColor: colors.surface,
  },
  botonBorrarTexto: { fontFamily: 'Inter_500Medium', color: colors.racha.rojo, fontSize: 14 },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 14,
    padding: 14,
    marginBottom: 12,
    backgroundColor: colors.surface,
    color: colors.textPrimary,
    fontFamily: 'Inter_400Regular',
  },
  etiqueta: { fontFamily: 'Inter_500Medium', fontSize: 13, color: colors.textSecondary, marginBottom: 8 },
  gridChips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 16 },
  chip: {
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 12,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  chipActivo: { backgroundColor: colors.cobalto, borderColor: colors.cobalto },
  chipTexto: { fontFamily: 'Inter_500Medium', color: colors.textPrimary, fontSize: 13 },
  tipoFila: { flexDirection: 'row', marginBottom: 16, backgroundColor: colors.surface, borderRadius: 12, padding: 4 },
  tipoBoton: { flex: 1, paddingVertical: 10, borderRadius: 8, alignItems: 'center' },
  tipoBotonActivo: { backgroundColor: colors.cobalto },
  tipoBotonTexto: { fontFamily: 'Inter_500Medium', color: colors.textPrimary, fontSize: 13 },
  fotoButton: { borderRadius: 14, padding: 14, marginBottom: 16, backgroundColor: colors.surface, alignItems: 'center' },
  fotoButtonTexto: { fontFamily: 'Inter_500Medium', color: colors.textPrimary },
  guardarButton: { borderRadius: 20, paddingVertical: 14, alignItems: 'center', backgroundColor: colors.cobalto },
  guardarButtonDeshabilitado: { opacity: 0.5 },
  guardarButtonTexto: { fontFamily: 'Inter_600SemiBold', color: '#fff', fontSize: 16 },
});
