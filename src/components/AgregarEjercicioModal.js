import { useEffect, useState } from 'react';
import { Modal, View, Text, TextInput, Pressable, ScrollView, ActivityIndicator, StyleSheet, Alert } from 'react-native';
import { getExercises, createExercise } from '../lib/exercises';
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

export default function AgregarEjercicioModal({ visible, userId, onAgregar, onClose }) {
  const [fuente, setFuente] = useState('mios');
  const [misEjercicios, setMisEjercicios] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [itemCatalogo, setItemCatalogo] = useState(null);
  const [nombre, setNombre] = useState('');
  const [muscleGroup, setMuscleGroup] = useState(null);
  const [tipo, setTipo] = useState('peso_reps');
  const [guardando, setGuardando] = useState(false);

  useEffect(() => {
    if (!visible) return;
    setFuente('mios');
    setItemCatalogo(null);
    setCargando(true);
    getExercises(userId, null).then((data) => {
      setMisEjercicios(data);
      setCargando(false);
    });
  }, [visible, userId]);

  function elegirDeCatalogo(item) {
    setItemCatalogo(item);
    setNombre(item.name);
    setMuscleGroup(item.muscleGroup);
    setTipo(item.type);
  }

  function agregarYCerrar(ejercicio) {
    onAgregar(ejercicio);
    onClose();
  }

  async function handleCrearYAgregar() {
    setGuardando(true);
    try {
      const nuevo = await createExercise(userId, {
        name: nombre.trim(),
        muscleGroup,
        type: tipo,
        restSeconds: null,
        photoUri: null,
        folderIds: [],
      });
      agregarYCerrar(nuevo);
    } catch (e) {
      console.error('Error al crear ejercicio:', e.message, e);
      Alert.alert('Error', 'No se pudo crear el ejercicio, intentá de nuevo.');
    } finally {
      setGuardando(false);
    }
  }

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <View style={styles.contenedor}>
        <View style={styles.encabezado}>
          {itemCatalogo ? (
            <Pressable onPress={() => setItemCatalogo(null)} hitSlop={12}>
              <Text style={styles.volver}>‹ Catálogo</Text>
            </Pressable>
          ) : (
            <Text style={styles.titulo}>Agregar ejercicio</Text>
          )}
          <Pressable onPress={onClose} hitSlop={12}>
            <Text style={styles.cerrar}>✕</Text>
          </Pressable>
        </View>

        {itemCatalogo ? (
          <ScrollView contentContainerStyle={{ padding: 22 }}>
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
            <Pressable
              style={[
                styles.guardarButton,
                (!nombre.trim() || !muscleGroup || guardando) && styles.guardarButtonDeshabilitado,
              ]}
              disabled={!nombre.trim() || !muscleGroup || guardando}
              onPress={handleCrearYAgregar}
            >
              <Text style={styles.guardarButtonTexto}>{guardando ? 'Agregando...' : 'Crear y agregar'}</Text>
            </Pressable>
          </ScrollView>
        ) : (
          <>
            <View style={styles.fuenteFila}>
              <Pressable
                style={[styles.fuenteBoton, fuente === 'mios' && styles.fuenteBotonActivo]}
                onPress={() => setFuente('mios')}
              >
                <Text style={styles.fuenteBotonTexto}>Mis ejercicios</Text>
              </Pressable>
              <Pressable
                style={[styles.fuenteBoton, fuente === 'catalogo' && styles.fuenteBotonActivo]}
                onPress={() => setFuente('catalogo')}
              >
                <Text style={styles.fuenteBotonTexto}>Catálogo</Text>
              </Pressable>
            </View>
            {fuente === 'mios' ? (
              cargando ? (
                <ActivityIndicator size="large" color={colors.cobalto} style={{ marginTop: 40 }} />
              ) : (
                <ScrollView contentContainerStyle={{ padding: 22 }}>
                  {misEjercicios.length === 0 && (
                    <Text style={styles.sinEjercicios}>Todavía no creaste ningún ejercicio propio.</Text>
                  )}
                  {misEjercicios.map((ejercicio) => (
                    <Pressable key={ejercicio.id} style={styles.filaCatalogo} onPress={() => agregarYCerrar(ejercicio)}>
                      <Text style={styles.filaCatalogoTexto}>{ejercicio.name}</Text>
                      <Text style={styles.flecha}>›</Text>
                    </Pressable>
                  ))}
                </ScrollView>
              )
            ) : (
              <ScrollView contentContainerStyle={{ padding: 22 }}>
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
          </>
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
  titulo: { fontFamily: 'SpaceGrotesk_700Bold', fontSize: 20, color: colors.textPrimary },
  volver: { fontFamily: 'Inter_600SemiBold', fontSize: 16, color: colors.cobalto },
  cerrar: { fontFamily: 'Inter_600SemiBold', fontSize: 20, color: colors.textPrimary },
  fuenteFila: {
    flexDirection: 'row',
    marginHorizontal: 22,
    marginBottom: 12,
    backgroundColor: colors.surface,
    borderRadius: 12,
    padding: 4,
  },
  fuenteBoton: { flex: 1, paddingVertical: 10, borderRadius: 8, alignItems: 'center' },
  fuenteBotonActivo: { backgroundColor: colors.cobalto },
  fuenteBotonTexto: { fontFamily: 'Inter_500Medium', color: colors.textPrimary, fontSize: 13 },
  sinEjercicios: { fontFamily: 'Inter_400Regular', color: colors.textTertiary },
  subtituloCatalogo: { fontFamily: 'SpaceGrotesk_600SemiBold', fontSize: 15, color: colors.cobalto, marginBottom: 8 },
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
  guardarButton: { borderRadius: 20, paddingVertical: 14, alignItems: 'center', backgroundColor: colors.cobalto },
  guardarButtonDeshabilitado: { opacity: 0.5 },
  guardarButtonTexto: { fontFamily: 'Inter_600SemiBold', color: '#fff', fontSize: 16 },
});
