import { View, Text, StyleSheet } from 'react-native';
import Svg, { Polyline, Circle } from 'react-native-svg';
import { colors } from '../theme/colors';

const ALTO_GRAFICO = 160;
const MARGEN_ETIQUETA = 24;
const MARGEN_LATERAL = 18;
const ALTO_TOTAL = ALTO_GRAFICO + MARGEN_ETIQUETA * 2;

export default function ObjetivoChart({ logs, goal, ancho }) {
  if (logs.length < 2) {
    return (
      <View style={[styles.tarjeta, styles.centrado]}>
        <Text style={styles.mensaje}>Registrá más pesos para ver tu progreso</Text>
      </View>
    );
  }

  const pesos = logs.map((l) => l.weight).concat([goal.target_value, goal.start_value]);
  const min = Math.min(...pesos);
  const max = Math.max(...pesos);
  const margen = (max - min) * 0.1 || 1;
  const pesoMin = min - margen;
  const pesoMax = max + margen;

  const anchoUtil = ancho - MARGEN_LATERAL * 2;
  const fechaInicio = new Date(goal.start_date + 'T00:00:00');
  const fechaFin = goal.target_date
    ? new Date(goal.target_date + 'T00:00:00')
    : new Date(logs[logs.length - 1].date + 'T00:00:00');
  const totalDias = Math.max(1, (fechaFin - fechaInicio) / (1000 * 60 * 60 * 24));

  function xParaFecha(fechaStr) {
    const dias = (new Date(fechaStr + 'T00:00:00') - fechaInicio) / (1000 * 60 * 60 * 24);
    return MARGEN_LATERAL + (dias / totalDias) * anchoUtil;
  }

  function yParaPeso(peso) {
    return MARGEN_ETIQUETA + ALTO_GRAFICO - ((peso - pesoMin) / (pesoMax - pesoMin)) * ALTO_GRAFICO;
  }

  const puntosReales = logs.map((log) => ({ x: xParaFecha(log.date), y: yParaPeso(log.weight) }));
  const puntosRealesStr = puntosReales.map((p) => `${p.x},${p.y}`).join(' ');

  const proyeccionStr = goal.target_date
    ? `${xParaFecha(goal.start_date)},${yParaPeso(goal.start_value)} ${xParaFecha(goal.target_date)},${yParaPeso(
        goal.target_value
      )}`
    : null;

  return (
    <View style={styles.tarjeta}>
      <Svg width={ancho} height={ALTO_TOTAL}>
        {proyeccionStr && (
          <Polyline
            points={proyeccionStr}
            fill="none"
            stroke={colors.textTertiary}
            strokeWidth={2}
            strokeDasharray="6,6"
          />
        )}
        <Polyline points={puntosRealesStr} fill="none" stroke={colors.cobalto} strokeWidth={2} />
        {puntosReales.map((p, i) => (
          <Circle key={i} cx={p.x} cy={p.y} r={4} fill={colors.cobalto} />
        ))}
      </Svg>
    </View>
  );
}

const styles = StyleSheet.create({
  tarjeta: { backgroundColor: colors.surface, borderRadius: 20, padding: 16, marginVertical: 16 },
  centrado: { height: ALTO_TOTAL, alignItems: 'center', justifyContent: 'center' },
  mensaje: { fontFamily: 'Inter_400Regular', color: colors.textTertiary, textAlign: 'center' },
});
