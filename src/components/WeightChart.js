import { Dimensions, View, Text, StyleSheet } from 'react-native';
import Svg, { Polyline, Circle } from 'react-native-svg';
import { colors } from '../theme/colors';

const ALTURA = 160;
const ANCHO = Dimensions.get('window').width - 44;

export default function WeightChart({ logs }) {
  if (logs.length < 2) {
    return (
      <View style={[styles.contenedor, styles.centrado]}>
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
    const x = (i / (logs.length - 1)) * ANCHO;
    const y = ALTURA - ((log.weight - pesoMin) / (pesoMax - pesoMin)) * (ALTURA - 16) - 8;
    return { x, y };
  });

  const puntosStr = puntos.map((p) => `${p.x},${p.y}`).join(' ');
  const ultimo = puntos[puntos.length - 1];

  return (
    <View style={styles.contenedor}>
      <Svg width={ANCHO} height={ALTURA}>
        <Polyline points={puntosStr} fill="none" stroke={colors.cobalto} strokeWidth={2} />
        <Circle cx={ultimo.x} cy={ultimo.y} r={4} fill={colors.cobalto} />
      </Svg>
    </View>
  );
}

const styles = StyleSheet.create({
  contenedor: { marginVertical: 16 },
  centrado: { height: ALTURA, alignItems: 'center', justifyContent: 'center' },
  mensaje: { fontFamily: 'Inter_400Regular', color: colors.textTertiary, textAlign: 'center' },
});
