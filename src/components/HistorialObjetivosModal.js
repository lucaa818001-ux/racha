import { useEffect, useState } from 'react';
import { Modal, View, Text, Pressable, ScrollView, ActivityIndicator, StyleSheet, Dimensions } from 'react-native';
import { getGoalHistory } from '../lib/goals';
import { getBodyLogsForRange } from '../lib/bodyLogs';
import ObjetivoChart from './ObjetivoChart';
import { colors } from '../theme/colors';

const ANCHO_GRAFICO = Dimensions.get('window').width - 44 - 32;

export default function HistorialObjetivosModal({ visible, userId, onClose }) {
  const [historial, setHistorial] = useState([]);
  const [cargando, setCargando] = useState(true);

  useEffect(() => {
    if (!visible) return;
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
          <Text style={styles.titulo}>Historial de objetivos</Text>
          <Pressable onPress={onClose} hitSlop={12}>
            <Text style={styles.cerrar}>✕</Text>
          </Pressable>
        </View>
        {cargando ? (
          <ActivityIndicator size="large" color={colors.cobalto} style={{ marginTop: 40 }} />
        ) : (
          <ScrollView contentContainerStyle={{ padding: 22 }}>
            {historial.length === 0 && (
              <Text style={styles.sinHistorial}>Todavía no tenés objetivos completados o cancelados.</Text>
            )}
            {historial.map(({ goal, logs }) => (
              <View key={goal.id} style={styles.item}>
                <Text style={styles.itemTitulo}>
                  {goal.status === 'completado' ? '🏆 Completado' : '✕ Cancelado'} ·{' '}
                  {goal.type === 'bajar' ? 'Bajar' : 'Subir'} de {goal.start_value}kg a {goal.target_value}kg
                </Text>
                <Text style={styles.itemFechas}>
                  {goal.start_date} → {goal.ended_at}
                </Text>
                <ObjetivoChart logs={logs} goal={goal} ancho={ANCHO_GRAFICO} />
              </View>
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
  cerrar: { fontFamily: 'Inter_600SemiBold', fontSize: 20, color: colors.textPrimary },
  sinHistorial: { fontFamily: 'Inter_400Regular', color: colors.textSecondary },
  item: { marginBottom: 24 },
  itemTitulo: { fontFamily: 'Inter_600SemiBold', fontSize: 15, color: colors.textPrimary, marginBottom: 4 },
  itemFechas: { fontFamily: 'Inter_400Regular', fontSize: 12, color: colors.textTertiary, marginBottom: 8 },
});
