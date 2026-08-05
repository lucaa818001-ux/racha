import { View, Text, StyleSheet } from 'react-native';
import Svg, { Polyline, Circle, Text as SvgText } from 'react-native-svg';
import { colors } from '../theme/colors';

const ALTO_GRAFICO = 160;
const MARGEN_ETIQUETA = 24;
const ALTO_TOTAL = ALTO_GRAFICO + MARGEN_ETIQUETA * 2;

export default function WeightChart({ logs, ancho }) {
  if (logs.length < 2) {
    return (
      <View style={[styles.tarjeta, styles.centrado]}>
        <Text style={styles.mensaje}>Registrá más días para ver tu evolución</Text>
      </View>
    );
  }

  const pesos = logs.map((l) => l.weight);
  const min = Math.min(...pesos);
  const max = Math.max(...pesos);
  const margen = (max - min) * 0.1 || 1;
  const pesoMin = min - margen;
  const pesoMax = max + margen;

  const puntos = logs.map((log, i) => {
    const x = (i / (logs.length - 1)) * ancho;
    const y = MARGEN_ETIQUETA + ALTO_GRAFICO - ((log.weight - pesoMin) / (pesoMax - pesoMin)) * ALTO_GRAFICO;
    return { x, y, weight: log.weight, date: log.date };
  });

  const puntosStr = puntos.map((p) => `${p.x},${p.y}`).join(' ');
  const mostrarEtiquetasPeso = logs.length <= 10;

  return (
    <View style={styles.tarjeta}>
      <Svg width={ancho} height={ALTO_TOTAL}>
        <Polyline points={puntosStr} fill="none" stroke={colors.cobalto} strokeWidth={2} />
        {puntos.map((p, i) => (
          <Circle key={i} cx={p.x} cy={p.y} r={4} fill={colors.cobalto} />
        ))}
        {mostrarEtiquetasPeso &&
          puntos.map((p, i) => (
            <SvgText
              key={`peso-${i}`}
              x={p.x}
              y={p.y - 10}
              fontSize="11"
              fill={colors.textSecondary}
              textAnchor="middle"
            >
              {p.weight}
            </SvgText>
          ))}
        <SvgText x={0} y={ALTO_TOTAL - 6} fontSize="11" fill={colors.textTertiary} textAnchor="start">
          {puntos[0].date}
        </SvgText>
        <SvgText x={ancho} y={ALTO_TOTAL - 6} fontSize="11" fill={colors.textTertiary} textAnchor="end">
          {puntos[puntos.length - 1].date}
        </SvgText>
      </Svg>
    </View>
  );
}

const styles = StyleSheet.create({
  tarjeta: {
    backgroundColor: colors.surface,
    borderRadius: 20,
    padding: 16,
    marginVertical: 16,
  },
  centrado: { height: ALTO_TOTAL, alignItems: 'center', justifyContent: 'center' },
  mensaje: { fontFamily: 'Inter_400Regular', color: colors.textTertiary, textAlign: 'center' },
});
