import { Modal, View, Text, Pressable, ScrollView, StyleSheet } from 'react-native';
import { calcularIMC } from '../lib/imc';
import { colors } from '../theme/colors';

export default function HistorialFisicoModal({ visible, logs, onClose, onSeleccionarFoto, onBorrar }) {
  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <View style={styles.contenedor}>
        <View style={styles.encabezado}>
          <Text style={styles.titulo}>Historial de registros</Text>
          <Pressable onPress={onClose} hitSlop={12}>
            <Text style={styles.cerrar}>✕</Text>
          </Pressable>
        </View>
        <ScrollView contentContainerStyle={{ padding: 22 }}>
          {logs.length === 0 && <Text style={styles.sinRegistros}>Todavía no registraste nada.</Text>}
          {logs.map((log) => (
            <Pressable
              key={log.id}
              style={styles.fila}
              onPress={() => log.photo_path && onSeleccionarFoto(log.photo_path)}
            >
              <View>
                <Text style={styles.filaFecha}>{log.date}</Text>
                <Text style={styles.filaDetalle}>
                  {log.weight} kg · {log.height} cm · IMC {calcularIMC(log.weight, log.height)}
                  {log.photo_path ? ' · con foto' : ''}
                </Text>
              </View>
              <Pressable onPress={() => onBorrar(log)} hitSlop={12}>
                <Text style={styles.borrarTexto}>Borrar</Text>
              </Pressable>
            </Pressable>
          ))}
        </ScrollView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  contenedor: { flex: 1, backgroundColor: colors.background },
  encabezado: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 60,
    paddingHorizontal: 22,
    paddingBottom: 16,
  },
  titulo: { fontFamily: 'SpaceGrotesk_700Bold', fontSize: 22, color: colors.textPrimary },
  cerrar: { fontFamily: 'Inter_600SemiBold', fontSize: 20, color: colors.textPrimary },
  sinRegistros: { fontFamily: 'Inter_400Regular', color: colors.textTertiary },
  fila: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.surface,
    borderRadius: 14,
    padding: 14,
    marginBottom: 8,
  },
  filaFecha: { fontFamily: 'Inter_600SemiBold', color: colors.textPrimary, fontSize: 14 },
  filaDetalle: { fontFamily: 'Inter_400Regular', color: colors.textSecondary, fontSize: 13, marginTop: 2 },
  borrarTexto: { fontFamily: 'Inter_500Medium', color: colors.racha.rojo, fontSize: 14 },
});
