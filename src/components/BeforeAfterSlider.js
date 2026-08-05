import { useRef, useState } from 'react';
import { View, Image, PanResponder, StyleSheet, Dimensions } from 'react-native';
import { colors } from '../theme/colors';

const ANCHO = Dimensions.get('window').width - 44;
const ALTO = 380;

export default function BeforeAfterSlider({ beforeUrl, afterUrl }) {
  const posRef = useRef(ANCHO / 2);
  const inicioRef = useRef(ANCHO / 2);
  const [posicion, setPosicion] = useState(ANCHO / 2);

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onPanResponderGrant: () => {
        inicioRef.current = posRef.current;
      },
      onPanResponderMove: (_evt, gesture) => {
        const nueva = Math.max(0, Math.min(ANCHO, inicioRef.current + gesture.dx));
        posRef.current = nueva;
        setPosicion(nueva);
      },
    })
  ).current;

  return (
    <View style={styles.contenedor}>
      <Image source={{ uri: afterUrl }} style={styles.imagenBase} resizeMode="cover" />
      <View style={[styles.imagenRecortada, { width: posicion }]}>
        <Image source={{ uri: beforeUrl }} style={styles.imagenBase} resizeMode="cover" />
      </View>
      <View {...panResponder.panHandlers} style={[styles.manija, { left: posicion - 20 }]}>
        <View style={styles.linea} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  contenedor: {
    width: ANCHO,
    height: ALTO,
    borderRadius: 20,
    overflow: 'hidden',
    backgroundColor: colors.surface,
  },
  imagenBase: { width: ANCHO, height: ALTO, position: 'absolute' },
  imagenRecortada: { height: ALTO, overflow: 'hidden', position: 'absolute', left: 0, top: 0 },
  manija: { position: 'absolute', top: 0, bottom: 0, width: 40, alignItems: 'center', justifyContent: 'center' },
  linea: { width: 3, height: '100%', backgroundColor: '#fff' },
});
