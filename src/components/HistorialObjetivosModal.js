import { useEffect, useState } from 'react';
import { Modal, View, Text, Pressable, ScrollView, ActivityIndicator, StyleSheet, Dimensions } from 'react-native';
import { getGoalHistory } from '../lib/goals';
import { getBodyLogsForRange } from '../lib/bodyLogs';
import ObjetivoChart from './ObjetivoChart';
import { colors } from '../theme/colors';

const ANCHO_GRAFICO = Dimensions.get('window').width - 44 - 32;

const MESES = [
  'enero',
  'febrero',
  'marzo',
  'abril',
  'mayo',
  'junio',
  'julio',
  'agosto',
  'septiembre',
  'octubre',
  'noviembre',
  'diciembre',
];

function formatDateLarga(d) {
  return `${d.getDate()} de ${MESES[d.getMonth()]}`;
}

export default function HistorialObjetivosModal({ visible, userId, onClose }) {
  const [historial, setHistorial] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [seleccionado, setSeleccionado] = useState(null);

  useEffect(() => {
    if (!visible) return;
    setSeleccionado(null);
    setCargando(true);
    getGoalHistory(userId).then(async (goals) => {
      const conLogs = await Promise.all(
        goals.map(async (g) => {
          const logs = await getBodyLogsForRange(
            userId,
            new Date(g.start_date + 'T00:00:00'),
            new Date((g.ended_at || g.start_date) + 'T00:00:00')
          );
          return { goal: g, logs };
        })
      );
      setHistorial(conLogs);
      setCargando(false);
    });
  }, [visible, userId]);

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <View style={styles.contenedor}>
        <View style={styles.encabezado}>
          {seleccionado ? (
            <Pressable onPress={() => setSeleccionado(null)} hitSlop={12}>
              <Text style={styles.volver}>‹ Historial</Text>
            </Pressable>
          ) : (
            <Text style={styles.titulo}>Historial de objetivos</Text>
          )}
          <Pressable onPress={onClose} hitSlop={12}>
            <Text style={styles.cerrar}>✕</Text>
          </Pressable>
        </View>
        {cargando ? (
          <ActivityIndicator size="large" color={colors.cobalto} style={{ marginTop: 40 }} />
        ) : seleccionado ? (
          <ScrollView contentContainerStyle={{ padding: 22 }}>
            <Text style={styles.itemTitulo}>
              {seleccionado.goal.status === 'completado' ? '🏆 Completado' : '✕ Cancelado'} ·{' '}
              {seleccionado.goal.type === 'bajar' ? 'Bajar' : 'Subir'} de {seleccionado.goal.start_value}kg a{' '}
              {seleccionado.goal.target_value}kg
            </Text>
            <Text style={styles.itemFechas}>
              {seleccionado.goal.start_date} → {seleccionado.goal.ended_at}
            </Text>
            {seleccionado.goal.status === 'completado' &&
              (() => {
                const goal = seleccionado.goal;
                const fechaReal = new Date(goal.ended_at + 'T00:00:00');
                let textoDiferencia = '—';
                if (goal.target_date) {
                  const diffDias = Math.round(
                    (new Date(goal.target_date + 'T00:00:00') - fechaReal) / (1000 * 60 * 60 * 24)
                  );
                  if (diffDias > 0) textoDiferencia = `${diffDias}d antes`;
                  else if (diffDias < 0) textoDiferencia = `${Math.abs(diffDias)}d después`;
                  else textoDiferencia = 'Justo a tiempo';
                }
                return (
                  <View style={styles.statsCompletadoGrid}>
                    <View style={styles.statsFila}>
                      <View style={styles.stat}>
                        <Text style={styles.statNumeroChico}>
                          {formatDateLarga(new Date(goal.start_date + 'T00:00:00'))}
                        </Text>
                        <Text style={styles.statLabel}>🏁 Inicio</Text>
                      </View>
                      <View style={styles.stat}>
                        <Text style={styles.statNumeroChico}>
                          {goal.target_date ? formatDateLarga(new Date(goal.target_date + 'T00:00:00')) : 'Sin fecha'}
                        </Text>
                        <Text style={styles.statLabel}>🎯 Fecha puesta</Text>
                      </View>
                    </View>
                    <View style={styles.statsFila}>
                      <View style={styles.stat}>
                        <Text style={styles.statNumeroChico}>{formatDateLarga(fechaReal)}</Text>
                        <Text style={styles.statLabel}>✅ Fecha real</Text>
                      </View>
                      <View style={styles.stat}>
                        <Text style={styles.statNumeroChico}>{textoDiferencia}</Text>
                        <Text style={styles.statLabel}>⏱ Diferencia</Text>
                      </View>
                    </View>
                  </View>
                );
              })()}
            <ObjetivoChart logs={seleccionado.logs} goal={seleccionado.goal} ancho={ANCHO_GRAFICO} />
          </ScrollView>
        ) : (
          <ScrollView contentContainerStyle={{ padding: 22 }}>
            {historial.length === 0 && (
              <Text style={styles.sinHistorial}>Todavía no tenés objetivos completados o cancelados.</Text>
            )}
            {historial.map((entrada) => (
              <Pressable key={entrada.goal.id} style={styles.fila} onPress={() => setSeleccionado(entrada)}>
                <View>
                  <Text style={styles.filaTitulo}>
                    {entrada.goal.status === 'completado' ? '🏆' : '✕'}{' '}
                    {entrada.goal.type === 'bajar' ? 'Bajar' : 'Subir'} de {entrada.goal.start_value}kg a{' '}
                    {entrada.goal.target_value}kg
                  </Text>
                  <Text style={styles.filaFechas}>
                    {entrada.goal.start_date} → {entrada.goal.ended_at}
                  </Text>
                </View>
                <Text style={styles.flecha}>›</Text>
              </Pressable>
            ))}
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
  titulo: { fontFamily: 'SpaceGrotesk_700Bold', fontSize: 22, color: colors.textPrimary },
  volver: { fontFamily: 'Inter_600SemiBold', fontSize: 16, color: colors.cobalto },
  cerrar: { fontFamily: 'Inter_600SemiBold', fontSize: 20, color: colors.textPrimary },
  sinHistorial: { fontFamily: 'Inter_400Regular', color: colors.textSecondary },
  fila: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.surface,
    borderRadius: 14,
    padding: 16,
    marginBottom: 8,
  },
  filaTitulo: { fontFamily: 'Inter_600SemiBold', fontSize: 14, color: colors.textPrimary, marginBottom: 4 },
  filaFechas: { fontFamily: 'Inter_400Regular', fontSize: 12, color: colors.textTertiary },
  flecha: { fontSize: 22, color: colors.textTertiary },
  itemTitulo: { fontFamily: 'Inter_600SemiBold', fontSize: 15, color: colors.textPrimary, marginBottom: 4 },
  itemFechas: { fontFamily: 'Inter_400Regular', fontSize: 12, color: colors.textTertiary, marginBottom: 8 },
  statsCompletadoGrid: {
    backgroundColor: colors.surface,
    borderRadius: 16,
    paddingVertical: 12,
    marginBottom: 16,
  },
  statsFila: { flexDirection: 'row', marginBottom: 8 },
  stat: { flex: 1, alignItems: 'center' },
  statNumeroChico: {
    fontFamily: 'SpaceGrotesk_600SemiBold',
    fontSize: 14,
    color: colors.textPrimary,
    textAlign: 'center',
  },
  statLabel: { fontFamily: 'Inter_400Regular', fontSize: 11, color: colors.textTertiary, marginTop: 2 },
});
