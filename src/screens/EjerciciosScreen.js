import { useCallback, useState } from 'react';
import { View, Text, Pressable, ScrollView, ActivityIndicator, RefreshControl, StyleSheet, Alert, Dimensions } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { supabase } from '../lib/supabase';
import { getFolders, createFolder, deleteFolder } from '../lib/exercises';
import CrearCarpetaModal from '../components/CrearCarpetaModal';
import ListaEjerciciosModal from '../components/ListaEjerciciosModal';
import { colors } from '../theme/colors';

const ANCHO_GRAFICO = Dimensions.get('window').width - 44 - 32;

export default function EjerciciosScreen() {
  const [userId, setUserId] = useState(null);
  const [folders, setFolders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refrescando, setRefrescando] = useState(false);
  const [crearCarpetaVisible, setCrearCarpetaVisible] = useState(false);
  const [listaVisible, setListaVisible] = useState(false);
  const [carpetaAbierta, setCarpetaAbierta] = useState(null);

  const cargarDatos = useCallback(async (uid) => {
    const data = await getFolders(uid);
    setFolders(data);
  }, []);

  useFocusEffect(
    useCallback(() => {
      let cancelado = false;
      supabase.auth.getUser().then(async ({ data: { user } }) => {
        if (cancelado) return;
        setUserId(user.id);
        await cargarDatos(user.id);
        if (!cancelado) setLoading(false);
      });
      return () => {
        cancelado = true;
      };
    }, [cargarDatos])
  );

  async function handleRefrescar() {
    setRefrescando(true);
    try {
      await cargarDatos(userId);
    } finally {
      setRefrescando(false);
    }
  }

  async function handleCrearCarpeta(nombre) {
    await createFolder(userId, nombre);
    await cargarDatos(userId);
    setCrearCarpetaVisible(false);
  }

  function handleBorrarCarpeta(folder) {
    Alert.alert('Borrar carpeta', `¿Borrar la carpeta "${folder.name}"? Los ejercicios no se borran.`, [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Borrar',
        style: 'destructive',
        onPress: async () => {
          await deleteFolder(folder.id);
          await cargarDatos(userId);
        },
      },
    ]);
  }

  function abrirTodos() {
    setCarpetaAbierta({ id: null, name: 'Todos los ejercicios' });
    setListaVisible(true);
  }

  function abrirCarpeta(folder) {
    setCarpetaAbierta(folder);
    setListaVisible(true);
  }

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={colors.cobalto} />
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={{ padding: 22 }}
      refreshControl={<RefreshControl refreshing={refrescando} onRefresh={handleRefrescar} tintColor={colors.cobalto} />}
    >
      <View style={styles.encabezadoFila}>
        <Text style={styles.titulo}>Ejercicios</Text>
        <Pressable style={styles.nuevaCarpetaBoton} onPress={() => setCrearCarpetaVisible(true)}>
          <Text style={styles.nuevaCarpetaIcono}>➕</Text>
        </Pressable>
      </View>
      <Pressable style={styles.fila} onPress={abrirTodos}>
        <Text style={styles.filaTitulo}>📋 Todos los ejercicios</Text>
        <Text style={styles.flecha}>›</Text>
      </Pressable>
      {folders.map((folder) => (
        <Pressable key={folder.id} style={styles.fila} onPress={() => abrirCarpeta(folder)}>
          <View>
            <Text style={styles.filaTitulo}>📁 {folder.name}</Text>
            <Text style={styles.filaSubtitulo}>
              {folder.cantidadEjercicios} ejercicio{folder.cantidadEjercicios === 1 ? '' : 's'}
            </Text>
          </View>
          <Pressable onPress={() => handleBorrarCarpeta(folder)} hitSlop={12}>
            <Text style={styles.borrarTexto}>Borrar</Text>
          </Pressable>
        </Pressable>
      ))}
      <CrearCarpetaModal
        visible={crearCarpetaVisible}
        onGuardar={handleCrearCarpeta}
        onClose={() => setCrearCarpetaVisible(false)}
      />
      <ListaEjerciciosModal
        visible={listaVisible}
        userId={userId}
        folderId={carpetaAbierta?.id ?? null}
        folderName={carpetaAbierta?.name ?? ''}
        folders={folders}
        ancho={ANCHO_GRAFICO}
        onClose={() => setListaVisible(false)}
        onCambio={() => cargarDatos(userId)}
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  center: { flex: 1, backgroundColor: colors.background, alignItems: 'center', justifyContent: 'center' },
  titulo: { fontSize: 28, fontFamily: 'SpaceGrotesk_700Bold', color: colors.textPrimary },
  encabezadoFila: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  nuevaCarpetaBoton: { backgroundColor: colors.surface, borderRadius: 12, paddingVertical: 8, paddingHorizontal: 10 },
  nuevaCarpetaIcono: { fontSize: 22 },
  fila: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.surface,
    borderRadius: 14,
    padding: 16,
    marginBottom: 8,
  },
  filaTitulo: { fontFamily: 'Inter_600SemiBold', fontSize: 15, color: colors.textPrimary },
  filaSubtitulo: { fontFamily: 'Inter_400Regular', fontSize: 12, color: colors.textTertiary, marginTop: 2 },
  borrarTexto: { fontFamily: 'Inter_500Medium', color: colors.racha.rojo, fontSize: 14 },
  flecha: { fontSize: 22, color: colors.textTertiary },
});
