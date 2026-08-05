import { useCallback, useState } from 'react';
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  RefreshControl,
  Alert,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { supabase } from '../lib/supabase';
import { getBodyLogsForRange, createBodyLog, deleteBodyLog, getSignedBodyPhotoUrl } from '../lib/bodyLogs';
import WeightChart from '../components/WeightChart';
import RegistrarFisicoModal from '../components/RegistrarFisicoModal';
import PhotoViewerModal from '../components/PhotoViewerModal';
import { colors } from '../theme/colors';

export default function FisicoScreen() {
  const [userId, setUserId] = useState(null);
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refrescando, setRefrescando] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [fotoSeleccionada, setFotoSeleccionada] = useState(null);

  const cargarDatos = useCallback(async (uid) => {
    const hoy = new Date();
    const desde = new Date();
    desde.setDate(desde.getDate() - 84);
    const lista = await getBodyLogsForRange(uid, desde, hoy);
    setLogs(lista);
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

  async function handleGuardar({ date, weight, height, photoUri }) {
    await createBodyLog(userId, { date, weight, height, photoUri });
    await cargarDatos(userId);
    setModalVisible(false);
  }

  function handleBorrar(log) {
    Alert.alert('Borrar registro', `¿Borrar el registro del ${log.date}?`, [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Borrar',
        style: 'destructive',
        onPress: async () => {
          await deleteBodyLog(log.id, log.photo_path);
          await cargarDatos(userId);
        },
      },
    ]);
  }

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={colors.cobalto} />
      </View>
    );
  }

  const pesoActual = logs.length > 0 ? logs[logs.length - 1].weight : null;
  const ultimaAltura = logs.length > 0 ? logs[logs.length - 1].height : null;
  const logsRecientesPrimero = [...logs].reverse();

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={{ padding: 22 }}
      refreshControl={
        <RefreshControl refreshing={refrescando} onRefresh={handleRefrescar} tintColor={colors.cobalto} />
      }
    >
      <Text style={styles.titulo}>Físico</Text>
      <View style={styles.pesoFila}>
        <Text style={styles.pesoNumero}>{pesoActual ?? '--'}</Text>
        <Text style={styles.pesoUnidad}>kg</Text>
      </View>
      <WeightChart logs={logs} />
      <Pressable style={styles.boton} onPress={() => setModalVisible(true)}>
        <Text style={styles.botonTexto}>Registrar</Text>
      </Pressable>

      <Text style={styles.subtitulo}>Historial</Text>
      {logsRecientesPrimero.length === 0 && <Text style={styles.sinRegistros}>Todavía no registraste nada.</Text>}
      {logsRecientesPrimero.map((log) => (
        <Pressable
          key={log.id}
          style={styles.fila}
          onPress={() => log.photo_path && setFotoSeleccionada(log.photo_path)}
        >
          <View>
            <Text style={styles.filaFecha}>{log.date}</Text>
            <Text style={styles.filaDetalle}>
              {log.weight} kg · {log.height} cm{log.photo_path ? ' · con foto' : ''}
            </Text>
          </View>
          <Pressable onPress={() => handleBorrar(log)} hitSlop={12}>
            <Text style={styles.borrarTexto}>Borrar</Text>
          </Pressable>
        </Pressable>
      ))}

      <RegistrarFisicoModal
        visible={modalVisible}
        alturaInicial={ultimaAltura}
        onGuardar={handleGuardar}
        onClose={() => setModalVisible(false)}
      />
      <PhotoViewerModal
        visible={!!fotoSeleccionada}
        photoPath={fotoSeleccionada}
        getSignedUrl={getSignedBodyPhotoUrl}
        onClose={() => setFotoSeleccionada(null)}
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  center: { flex: 1, backgroundColor: colors.background, alignItems: 'center', justifyContent: 'center' },
  titulo: { fontSize: 28, fontFamily: 'SpaceGrotesk_700Bold', color: colors.textPrimary, marginBottom: 16 },
  pesoFila: { flexDirection: 'row', alignItems: 'baseline', marginBottom: 8 },
  pesoNumero: { fontSize: 44, fontFamily: 'SpaceGrotesk_700Bold', color: colors.textPrimary, marginRight: 8 },
  pesoUnidad: { fontSize: 18, fontFamily: 'Inter_400Regular', color: colors.textSecondary },
  boton: { marginTop: 8, borderRadius: 20, paddingVertical: 16, alignItems: 'center', backgroundColor: colors.cobalto },
  botonTexto: { fontFamily: 'Inter_600SemiBold', color: '#fff', fontSize: 16 },
  subtitulo: {
    fontFamily: 'SpaceGrotesk_600SemiBold',
    fontSize: 18,
    color: colors.textPrimary,
    marginTop: 28,
    marginBottom: 12,
  },
  sinRegistros: { fontFamily: 'Inter_400Regular', color: colors.textTertiary },
  fila: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.surface,
    borderRadius: 14,
    padding: 14,
    marginBottom: 8,
  },
  filaFecha: { fontFamily: 'Inter_600SemiBold', color: colors.textPrimary, fontSize: 14 },
  filaDetalle: { fontFamily: 'Inter_400Regular', color: colors.textSecondary, fontSize: 13, marginTop: 2 },
  borrarTexto: { fontFamily: 'Inter_500Medium', color: colors.racha.rojo, fontSize: 14 },
});
