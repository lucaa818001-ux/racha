import { View, Text, Pressable, StyleSheet } from 'react-native';
import { colors } from '../theme/colors';

const NOMBRES_MES = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
];

export default function MonthSelector({ year, month, onChange }) {
  const hoy = new Date();
  const esMesActual = year === hoy.getFullYear() && month === hoy.getMonth();
  const esEnero = month === 0;

  function irAnterior() {
    if (esEnero) return;
    onChange(year, month - 1);
  }

  function irSiguiente() {
    if (esMesActual) return;
    onChange(year, month + 1);
  }

  return (
    <View style={styles.fila}>
      <Pressable onPress={irAnterior} disabled={esEnero} hitSlop={12}>
        <Text style={[styles.flecha, esEnero && styles.flechaDeshabilitada]}>‹</Text>
      </Pressable>
      <Text style={styles.titulo}>{NOMBRES_MES[month]} {year}</Text>
      <Pressable onPress={irSiguiente} disabled={esMesActual} hitSlop={12}>
        <Text style={[styles.flecha, esMesActual && styles.flechaDeshabilitada]}>›</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  fila: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 },
  titulo: { fontFamily: 'Inter_600SemiBold', fontSize: 16, color: colors.textPrimary },
  flecha: { fontSize: 28, color: colors.cobalto, paddingHorizontal: 12 },
  flechaDeshabilitada: { color: colors.textTertiary },
});
