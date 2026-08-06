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
  Dimensions,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { supabase } from '../lib/supabase';
import { getBodyLogsForRange, createBodyLog, deleteBodyLog, getSignedBodyPhotoUrl } from '../lib/bodyLogs';
import WeightChart from '../components/WeightChart';
import RegistrarFisicoModal from '../components/RegistrarFisicoModal';
import PhotoViewerModal from '../components/PhotoViewerModal';
import ComparacionFotosModal from '../components/ComparacionFotosModal';
import HistorialFisicoModal from '../components/HistorialFisicoModal';
import FotosRecientes from '../components/FotosRecientes';
import { calcularIMC } from '../lib/imc';
import { colors } from '../theme/colors';

const ANCHO_GRAFICO = Dimensions.get('window').width - 44 - 32;

function formatDate(d) {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

const RANGOS = [
  { key: 'semana', label: '1 semana', dias: 7 },
  { key: 'mes', label: '1 mes', dias: 30 },
  { key: 'anio', label: '1 año', dias: 365 },
  { key: 'todo', label: 'Todo', dias: null },
];

export default function FisicoScreen() {
  const [userId, setUserId] = useState(null);
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refrescando, setRefrescando] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [fotoSeleccionada, setFotoSeleccionada] = useState(null);
  const [comparacionVisible, setComparacionVisible] = useState(false);
  const [historialVisible, setHistorialVisible] = useState(false);
  const [rango, setRango] = useState('todo');

  const cargarDatos = useCallback(async (uid) => {
    const hoy = new Date();
    const desde = new Date(2000, 0, 1);
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

  async function handleGuardar({ date, weight, height, photoUri, measurements }) {
    await createBodyLog(userId, { date, weight, height, photoUri, measurements });
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
  const fotosDisponibles = logs.filter((l) => l.photo_path).length;
  const fotosRecientes = logsRecientesPrimero.filter((l) => l.photo_path).slice(0, 8);
  const cambioPeso =
    logs.length > 1 ? Math.round((pesoActual - logs[0].weight) * 10) / 10 : null;
  const rangoActual = RANGOS.find((r) => r.key === rango);
  let logsDelRango = logs;
  if (rangoActual.dias !== null) {
    const desdeRango = new Date();
    desdeRango.setDate(desdeRango.getDate() - rangoActual.dias);
    const desdeRangoStr = formatDate(desdeRango);
    logsDelRango = logs.filter((l) => l.date >= desdeRangoStr);
  }

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={{ padding: 22 }}
      refreshControl={
        <RefreshControl refreshing={refrescando} onRefresh={handleRefrescar} tintColor={colors.cobalto} />
      }
    >
      <View style={styles.encabezadoFila}>
        <Text style={styles.titulo}>Físico</Text>
        <Pressable style={styles.historialBoton} onPress={() => setHistorialVisible(true)}>
          <Text style={styles.historialIcono}>📜</Text>
        </Pressable>
      </View>

      <FotosRecientes logs={fotosRecientes} onSeleccionar={setFotoSeleccionada} />

      <View style={styles.pesoFila}>
        <Text style={styles.pesoNumero}>{pesoActual ?? '--'}</Text>
        <Text style={styles.pesoUnidad}>kg</Text>
      </View>

      <View style={styles.statsFila}>
        <View style={styles.stat}>
          <Text style={styles.statNumero}>{ultimaAltura ?? '--'}</Text>
          <Text style={styles.statLabel}>📏 Altura</Text>
        </View>
        <View style={styles.stat}>
          <Text style={styles.statNumero}>{pesoActual !== null ? calcularIMC(pesoActual, ultimaAltura) : '--'}</Text>
          <Text style={styles.statLabel}>⚖️ IMC</Text>
        </View>
        <View style={styles.stat}>
          <Text style={styles.statNumero}>{logs.length}</Text>
          <Text style={styles.statLabel}>📋 Registros</Text>
        </View>
        <View style={styles.stat}>
          <Text style={styles.statNumero}>
            {cambioPeso === null ? '--' : `${cambioPeso > 0 ? '+' : ''}${cambioPeso}kg`}
          </Text>
          <Text style={styles.statLabel}>📈 Desde el inicio</Text>
        </View>
      </View>

      <View style={styles.rangoFila}>
        {RANGOS.map((opcion) => (
          <Pressable
            key={opcion.key}
            onPress={() => setRango(opcion.key)}
            style={[styles.rangoBoton, rango === opcion.key && styles.rangoBotonActivo]}
          >
            <Text style={styles.rangoBotonTexto}>{opcion.label}</Text>
          </Pressable>
        ))}
      </View>
      <WeightChart logs={logsDelRango} ancho={ANCHO_GRAFICO} />
      <Pressable style={styles.boton} onPress={() => setModalVisible(true)}>
        <Text style={styles.botonTexto}>Registrar</Text>
      </Pressable>
      <Pressable
        style={[styles.botonSecundario, fotosDisponibles < 2 && styles.botonDeshabilitado]}
        disabled={fotosDisponibles < 2}
        onPress={() => setComparacionVisible(true)}
      >
        <Text style={styles.botonSecundarioTexto}>
          {fotosDisponibles < 2 ? 'Necesitás al menos 2 fotos para comparar' : 'Comparar fotos'}
        </Text>
      </Pressable>

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
      <ComparacionFotosModal
        visible={comparacionVisible}
        userId={userId}
        onClose={() => setComparacionVisible(false)}
      />
      <HistorialFisicoModal
        visible={historialVisible}
        logs={logsRecientesPrimero}
        onClose={() => setHistorialVisible(false)}
        onSeleccionarFoto={setFotoSeleccionada}
        onBorrar={handleBorrar}
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  center: { flex: 1, backgroundColor: colors.background, alignItems: 'center', justifyContent: 'center' },
  titulo: { fontSize: 28, fontFamily: 'SpaceGrotesk_700Bold', color: colors.textPrimary },
  encabezadoFila: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  historialBoton: {
    backgroundColor: colors.surface,
    borderRadius: 12,
    paddingVertical: 8,
    paddingHorizontal: 10,
  },
  historialIcono: { fontSize: 22 },
  pesoFila: { flexDirection: 'row', alignItems: 'baseline', marginBottom: 8 },
  pesoNumero: { fontSize: 44, fontFamily: 'SpaceGrotesk_700Bold', color: colors.textPrimary, marginRight: 8 },
  pesoUnidad: { fontSize: 18, fontFamily: 'Inter_400Regular', color: colors.textSecondary },
  statsFila: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 20, marginBottom: 4 },
  stat: { alignItems: 'center' },
  statNumero: { fontFamily: 'SpaceGrotesk_600SemiBold', fontSize: 18, color: colors.textPrimary },
  statLabel: { fontFamily: 'Inter_400Regular', fontSize: 11, color: colors.textTertiary, marginTop: 2 },
  rangoFila: { flexDirection: 'row', marginTop: 12, backgroundColor: colors.surface, borderRadius: 12, padding: 4 },
  rangoBoton: { flex: 1, paddingVertical: 8, borderRadius: 8, alignItems: 'center' },
  rangoBotonActivo: { backgroundColor: colors.cobalto },
  rangoBotonTexto: { fontFamily: 'Inter_500Medium', color: colors.textPrimary, fontSize: 13 },
  boton: { marginTop: 8, borderRadius: 20, paddingVertical: 16, alignItems: 'center', backgroundColor: colors.cobalto },
  botonTexto: { fontFamily: 'Inter_600SemiBold', color: '#fff', fontSize: 16 },
  botonSecundario: {
    marginTop: 12,
    borderRadius: 20,
    paddingVertical: 14,
    alignItems: 'center',
    backgroundColor: colors.surface,
  },
  botonDeshabilitado: { opacity: 0.5 },
  botonSecundarioTexto: { fontFamily: 'Inter_500Medium', color: colors.textPrimary, fontSize: 14 },
});
