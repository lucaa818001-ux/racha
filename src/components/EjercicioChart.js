import { View, Text, StyleSheet } from 'react-native';
import Svg, { Polyline, Circle, Text as SvgText } from 'react-native-svg';
import { mejorMarcaSesion } from '../lib/exerciciosCalculo';
import { colors } from '../theme/colors';

const ALTO_GRAFICO = 160;
const MARGEN_ETIQUETA = 24;
const MARGEN_LATERAL = 18;
const ALTO_TOTAL = ALTO_GRAFICO + MARGEN_ETIQUETA * 2;

export default function EjercicioChart({ logs, type, ancho }) {
  if (logs.length < 2) {
    return (
      <View style={[styles.tarjeta, styles.centrado]}>
        <Text style={styles.mensaje}>Registrá más sesiones para ver tu evolución</Text>
      </View>
    );
  }

  const unidad = type === 'tiempo' ? 'seg' : 'kg';
  const marcas = logs.map((log) => mejorMarcaSesion(log.sets, type));
  const min = Math.min(...marcas);
  const max = Math.max(...marcas);
  const margen = (max - min) * 0.1 || 1;
  const marcaMin = min - margen;
  const marcaMax = max + margen;

  const anchoUtil = ancho - MARGEN_LATERAL * 2;
  const puntos = logs.map((log, i) => {
    const marca = marcas[i];
    const x = MARGEN_LATERAL + (i / (logs.length - 1)) * anchoUtil;
    const y = MARGEN_ETIQUETA + ALTO_GRAFICO - ((marca - marcaMin) / (marcaMax - marcaMin)) * ALTO_GRAFICO;
    return { x, y, marca, date: log.date };
  });

  const puntosStr = puntos.map((p) => `${p.x},${p.y}`).join(' ');
  const mostrarEtiquetas = logs.length <= 10;

  return (
    <View style={styles.tarjeta}>
      <Svg width={ancho} height={ALTO_TOTAL}>
        <Polyline points={puntosStr} fill="none" stroke={colors.cobalto} strokeWidth={2} />
        {puntos.map((p, i) => (
          <Circle key={i} cx={p.x} cy={p.y} r={4} fill={colors.cobalto} />
        ))}
        {mostrarEtiquetas &&
          puntos.map((p, i) => (
            <SvgText
              key={`marca-${i}`}
              x={p.x}
              y={p.y - 10}
              fontSize="11"
              fill={colors.textSecondary}
              textAnchor="middle"
            >
              {`${p.marca}${unidad}`}
            </SvgText>
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
});
