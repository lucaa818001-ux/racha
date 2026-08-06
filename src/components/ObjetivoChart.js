import { View, Text, StyleSheet } from 'react-native';
import Svg, { Polyline, Circle, Line, Text as SvgText } from 'react-native-svg';
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

  const pesos = logs.map((l) => l.weight).concat([goal.target_value]);
  const min = Math.min(...pesos);
  const max = Math.max(...pesos);
  const margen = (max - min) * 0.1 || 1;
  const pesoMin = min - margen;
  const pesoMax = max + margen;

  const anchoUtil = ancho - MARGEN_LATERAL * 2;

  function yParaPeso(peso) {
    return MARGEN_ETIQUETA + ALTO_GRAFICO - ((peso - pesoMin) / (pesoMax - pesoMin)) * ALTO_GRAFICO;
  }

  const puntos = logs.map((log, i) => ({
    x: MARGEN_LATERAL + (i / (logs.length - 1)) * anchoUtil,
    y: yParaPeso(log.weight),
    weight: log.weight,
    date: log.date,
  }));
  const puntosStr = puntos.map((p) => `${p.x},${p.y}`).join(' ');
  const yMeta = yParaPeso(goal.target_value);

  return (
    <View style={styles.tarjeta}>
      <View style={styles.leyendaFila}>
        <View style={styles.leyendaItem}>
          <View style={[styles.leyendaLinea, { backgroundColor: colors.cobalto }]} />
          <Text style={styles.leyendaTexto}>Tu peso</Text>
        </View>
        <View style={styles.leyendaItem}>
          <View style={styles.leyendaLineaPunteada} />
          <Text style={styles.leyendaTexto}>Meta ({goal.target_value}kg)</Text>
        </View>
      </View>
      <Svg width={ancho} height={ALTO_TOTAL}>
        <Line
          x1={MARGEN_LATERAL}
          y1={yMeta}
          x2={ancho - MARGEN_LATERAL}
          y2={yMeta}
          stroke={colors.textTertiary}
          strokeWidth={2}
          strokeDasharray="6,6"
        />
        <Polyline points={puntosStr} fill="none" stroke={colors.cobalto} strokeWidth={2} />
        {puntos.map((p, i) => (
          <Circle key={i} cx={p.x} cy={p.y} r={4} fill={colors.cobalto} />
        ))}
        <SvgText x={MARGEN_LATERAL} y={ALTO_TOTAL - 6} fontSize="11" fill={colors.textTertiary} textAnchor="start">
          {puntos[0].date}
        </SvgText>
        <SvgText
          x={ancho - MARGEN_LATERAL}
          y={ALTO_TOTAL - 6}
          fontSize="11"
          fill={colors.textTertiary}
          textAnchor="end"
        >
          {puntos[puntos.length - 1].date}
        </SvgText>
      </Svg>
    </View>
  );
}

const styles = StyleSheet.create({
  tarjeta: { backgroundColor: colors.surface, borderRadius: 20, padding: 16, marginVertical: 16 },
  centrado: { height: ALTO_TOTAL, alignItems: 'center', justifyContent: 'center' },
  mensaje: { fontFamily: 'Inter_400Regular', color: colors.textTertiary, textAlign: 'center' },
  leyendaFila: { flexDirection: 'row', marginBottom: 8 },
  leyendaItem: { flexDirection: 'row', alignItems: 'center', marginRight: 16 },
  leyendaLinea: { width: 16, height: 2, marginRight: 6 },
  leyendaLineaPunteada: {
    width: 16,
    height: 0,
    marginRight: 6,
    borderTopWidth: 2,
    borderColor: colors.textTertiary,
    borderStyle: 'dashed',
  },
  leyendaTexto: { fontFamily: 'Inter_400Regular', fontSize: 12, color: colors.textSecondary },
});
