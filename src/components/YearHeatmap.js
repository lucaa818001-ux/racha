import { View, Text, StyleSheet } from 'react-native';
import CalendarGrid from './CalendarGrid';
import { colors } from '../theme/colors';

const NOMBRES_MES_CORTOS = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];

export default function YearHeatmap({ year, checkins }) {
  return (
    <View style={styles.grilla}>
      {NOMBRES_MES_CORTOS.map((nombre, mes) => (
        <View key={mes} style={styles.bloqueMes}>
          <Text style={styles.nombreMes}>{nombre}</Text>
          <CalendarGrid year={year} month={mes} checkins={checkins} compact />
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  grilla: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between' },
  bloqueMes: { width: '31%', marginBottom: 16 },
  nombreMes: { fontFamily: 'Inter_500Medium', fontSize: 11, color: colors.textTertiary, marginBottom: 4 },
});
