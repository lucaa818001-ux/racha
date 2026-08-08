import { View, StyleSheet } from 'react-native';
import Svg, { Polyline } from 'react-native-svg';
import { colors } from '../theme/colors';

export default function MiniSparkline({ valores, ancho, alto }) {
  if (valores.length < 2) return null;

  const min = Math.min(...valores);
  const max = Math.max(...valores);
  const rango = max - min || 1;

  const puntos = valores.map((valor, i) => {
    const x = (i / (valores.length - 1)) * ancho;
    const y = alto - ((valor - min) / rango) * alto;
    return `${x},${y}`;
  });

  return (
    <View style={styles.contenedor}>
      <Svg width={ancho} height={alto}>
        <Polyline points={puntos.join(' ')} fill="none" stroke={colors.cobalto} strokeWidth={2} />
      </Svg>
    </View>
  );
}

const styles = StyleSheet.create({
  contenedor: { alignItems: 'center' },
});
