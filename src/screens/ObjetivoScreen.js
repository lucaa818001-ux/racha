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
import { getBodyLogsForRange } from '../lib/bodyLogs';
import { getGoal, upsertGoal, deleteGoal } from '../lib/goals';
import { calcularProgreso, estimarFechaLogro, calcularRitmoSemanal } from '../lib/objetivoCalculo';
import CrearObjetivoModal from '../components/CrearObjetivoModal';
import ObjetivoChart from '../components/ObjetivoChart';
import { colors } from '../theme/colors';

const ANCHO_GRAFICO = Dimensions.get('window').width - 44 - 32;

function formatDate(d) {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function mensajeMotivacional(progreso) {
  if (progreso >= 100) return '¡Lograste tu objetivo! 🎉';
  if (progreso >= 75) return '¡Ya casi llegás! 🔥';
  if (progreso >= 50) return 'Ya pasaste la mitad, seguí así 💪';
  if (progreso >= 25) return 'Vas por buen camino';
  return 'Arrancando fuerte';
}

export default function ObjetivoScreen() {
  const [userId, setUserId] = useState(null);
  const [goal, setGoal] = useState(null);
  const [logs, setLogs] = useState([]);
  const [tienePeso, setTienePeso] = useState(false);
  const [pesoMasReciente, setPesoMasReciente] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refrescando, setRefrescando] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);

  const cargarDatos = useCallback(async (uid) => {
    const hoy = new Date();
    const desde = new Date(2000, 0, 1);
    const historialCompleto = await getBodyLogsForRange(uid, desde, hoy);
    setTienePeso(historialCompleto.length > 0);
    setPesoMasReciente(historialCompleto.length > 0 ? historialCompleto[historialCompleto.length - 1].weight : null);

    const objetivoActual = await getGoal(uid);
    setGoal(objetivoActual);
    setLogs(objetivoActual ? historialCompleto.filter((l) => l.date >= objetivoActual.start_date) : []);
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

  async function handleCrear({ type, targetValue, targetDate, startValue }) {
    await upsertGoal(userId, {
      type,
      targetValue,
      targetDate,
      startValue,
      startDate: new Date(),
    });
    await cargarDatos(userId);
    setModalVisible(false);
  }

  function handleCancelar() {
    Alert.alert('Cancelar objetivo', '¿Seguro que querés cancelar tu objetivo actual?', [
      { text: 'No', style: 'cancel' },
      {
        text: 'Sí, cancelar',
        style: 'destructive',
        onPress: async () => {
          await deleteGoal(userId);
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

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={{ padding: 22 }}
      refreshControl={
        <RefreshControl refreshing={refrescando} onRefresh={handleRefrescar} tintColor={colors.cobalto} />
      }
    >
      <Text style={styles.titulo}>Objetivo</Text>
      {!goal ? (
        <>
          {tienePeso ? (
            <Pressable style={styles.boton} onPress={() => setModalVisible(true)}>
              <Text style={styles.botonTexto}>Crear objetivo</Text>
            </Pressable>
          ) : (
            <Text style={styles.sinObjetivo}>Registrá tu peso en Físico primero para poder crear un objetivo.</Text>
          )}
        </>
      ) : (
        <>
          {(() => {
            const pesoActual = logs.length > 0 ? logs[logs.length - 1].weight : goal.start_value;
            const progreso = calcularProgreso(goal, pesoActual);
            const restante = Math.round(Math.abs(goal.target_value - pesoActual) * 10) / 10;
            const diasTranscurridos = Math.max(
              0,
              Math.round((new Date() - new Date(goal.start_date + 'T00:00:00')) / (1000 * 60 * 60 * 24))
            );
            return (
              <>
                <View style={styles.progresoFila}>
                  <Text style={styles.icono}>🎯</Text>
                  <Text style={styles.progresoNumero}>{progreso}%</Text>
                </View>
                <Text style={styles.progresoDetalle}>
                  {goal.type === 'bajar' ? 'Bajar' : 'Subir'} de {goal.start_value}kg a {goal.target_value}kg
                </Text>
                <Text style={styles.motivacional}>{mensajeMotivacional(progreso)}</Text>
                <View style={styles.statsFila}>
                  <View style={styles.stat}>
                    <Text style={styles.statNumero}>{pesoActual}kg</Text>
                    <Text style={styles.statLabel}>⚖️ Peso actual</Text>
                  </View>
                  <View style={styles.stat}>
                    <Text style={styles.statNumero}>{restante === 0 ? '¡Listo!' : `${restante}kg`}</Text>
                    <Text style={styles.statLabel}>📍 Restantes</Text>
                  </View>
                  <View style={styles.stat}>
                    <Text style={styles.statNumero}>{diasTranscurridos}</Text>
                    <Text style={styles.statLabel}>📅 Días</Text>
                  </View>
                </View>
              </>
            );
          })()}
          <ObjetivoChart logs={logs} goal={goal} ancho={ANCHO_GRAFICO} />
          {(() => {
            const fechaEstimada = estimarFechaLogro(goal, logs);
            const ritmo = calcularRitmoSemanal(goal.start_date, logs);
            if (!fechaEstimada || ritmo === null) return null;
            const verbo = ritmo < 0 ? 'bajando' : 'subiendo';
            return (
              <Text style={styles.fechaEstimada}>
                Estás {verbo} ~{Math.abs(ritmo)}kg por semana. A este ritmo, llegarías el{' '}
                {formatDate(fechaEstimada)}.
              </Text>
            );
          })()}
          <Pressable style={styles.botonCancelar} onPress={handleCancelar}>
            <Text style={styles.botonCancelarTexto}>Cancelar objetivo</Text>
          </Pressable>
        </>
      )}
      <CrearObjetivoModal
        visible={modalVisible}
        pesoInicial={pesoMasReciente}
        onGuardar={handleCrear}
        onClose={() => setModalVisible(false)}
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  center: { flex: 1, backgroundColor: colors.background, alignItems: 'center', justifyContent: 'center' },
  titulo: { fontSize: 28, fontFamily: 'SpaceGrotesk_700Bold', color: colors.textPrimary, marginBottom: 16 },
  sinObjetivo: { fontFamily: 'Inter_400Regular', color: colors.textSecondary },
  boton: { borderRadius: 20, paddingVertical: 16, alignItems: 'center', backgroundColor: colors.cobalto },
  botonTexto: { fontFamily: 'Inter_600SemiBold', color: '#fff', fontSize: 16 },
  progresoFila: { flexDirection: 'row', alignItems: 'center' },
  icono: { fontSize: 36, marginRight: 8 },
  progresoNumero: { fontSize: 48, fontFamily: 'SpaceGrotesk_700Bold', color: colors.textPrimary },
  progresoDetalle: { fontFamily: 'Inter_400Regular', color: colors.textSecondary, marginBottom: 4 },
  motivacional: { fontFamily: 'Inter_600SemiBold', fontSize: 16, color: colors.cobalto, marginBottom: 16 },
  statsFila: { flexDirection: 'row', marginBottom: 8 },
  stat: { flex: 1, alignItems: 'center' },
  statNumero: { fontFamily: 'SpaceGrotesk_600SemiBold', fontSize: 18, color: colors.textPrimary },
  statLabel: { fontFamily: 'Inter_400Regular', fontSize: 11, color: colors.textTertiary, marginTop: 2 },
  fechaEstimada: { fontFamily: 'Inter_600SemiBold', fontSize: 16, color: colors.cobalto, marginBottom: 16 },
  botonCancelar: {
    marginTop: 8,
    borderRadius: 20,
    paddingVertical: 14,
    alignItems: 'center',
    backgroundColor: colors.surface,
  },
  botonCancelarTexto: { fontFamily: 'Inter_500Medium', color: colors.racha.rojo, fontSize: 14 },
});
