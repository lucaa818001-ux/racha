import { View, Text, Pressable, StyleSheet } from 'react-native';
import { colors, getRachaColor } from '../theme/colors';

const DIAS_SEMANA = ['L', 'M', 'X', 'J', 'V', 'S', 'D'];

function buildGrid(year, month) {
  const primerDia = new Date(year, month, 1);
  const offset = (primerDia.getDay() + 6) % 7;
  const diasEnMes = new Date(year, month + 1, 0).getDate();
  const celdas = [];
  for (let i = 0; i < offset; i++) celdas.push(null);
  for (let dia = 1; dia <= diasEnMes; dia++) celdas.push(dia);
  while (celdas.length % 7 !== 0) celdas.push(null);
  return celdas;
}

export default function CalendarGrid({ year, month, checkins, onDayPress, compact = false }) {
  const celdas = buildGrid(year, month);
  const checkinsPorDia = {};
  checkins.forEach((c) => {
    const d = new Date(c.date + 'T00:00:00');
    if (d.getFullYear() === year && d.getMonth() === month) {
      checkinsPorDia[d.getDate()] = c;
    }
  });
  const hoy = new Date();
  const esHoy = (dia) =>
    dia === hoy.getDate() && month === hoy.getMonth() && year === hoy.getFullYear();

  const semanas = [];
  for (let i = 0; i < celdas.length; i += 7) {
    semanas.push(celdas.slice(i, i + 7));
  }

  return (
    <View>
      {!compact && (
        <View style={styles.fila}>
          {DIAS_SEMANA.map((d) => (
            <Text key={d} style={styles.diaSemana}>{d}</Text>
          ))}
        </View>
      )}
      {semanas.map((semana, i) => (
        <View key={i} style={[styles.fila, compact && styles.filaCompacta]}>
          {semana.map((dia, idx) => {
            if (dia === null) {
              return <View key={idx} style={compact ? styles.celdaCompacta : styles.celda} />;
            }
            const checkin = checkinsPorDia[dia];
            const bg = checkin ? getRachaColor(checkin.racha_dia) : colors.surface;
            return (
              <Pressable
                key={idx}
                style={[
                  compact ? styles.celdaCompacta : styles.celda,
                  { backgroundColor: bg },
                  esHoy(dia) && !compact && styles.celdaHoy,
                ]}
                disabled={compact || !checkin}
                onPress={() => !compact && checkin && onDayPress(checkin)}
              >
                {!compact && <Text style={styles.numeroDia}>{dia}</Text>}
              </Pressable>
            );
          })}
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  fila: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 },
  filaCompacta: { justifyContent: 'flex-start', marginBottom: 2 },
  diaSemana: { width: 40, textAlign: 'center', color: colors.textTertiary, fontFamily: 'Inter_500Medium' },
  celda: { width: 40, height: 40, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  celdaCompacta: { width: 9, height: 9, borderRadius: 2, marginRight: 2 },
  celdaHoy: { borderWidth: 2, borderColor: '#fff' },
  numeroDia: { color: colors.textPrimary, fontFamily: 'Inter_500Medium', fontSize: 13 },
});
