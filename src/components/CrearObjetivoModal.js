import { useEffect, useState } from 'react';
import { Modal, View, Text, TextInput, Pressable, StyleSheet, Alert, Platform } from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { colors } from '../theme/colors';

export default function CrearObjetivoModal({ visible, pesoInicial, onGuardar, onClose }) {
  const [tipo, setTipo] = useState('bajar');
  const [valor, setValor] = useState('');
  const [inicial, setInicial] = useState('');
  const [mostrarFecha, setMostrarFecha] = useState(false);
  const [fecha, setFecha] = useState(new Date());
  const [guardando, setGuardando] = useState(false);

  useEffect(() => {
    if (visible) setInicial(pesoInicial ? String(pesoInicial) : '');
  }, [visible, pesoInicial]);

  const valorValido = valor.trim() !== '' && !Number.isNaN(Number(valor));
  const inicialValido = inicial.trim() !== '' && !Number.isNaN(Number(inicial));

  async function handleGuardar() {
    setGuardando(true);
    try {
      await onGuardar({
        type: tipo,
        targetValue: Number(valor),
        targetDate: mostrarFecha ? fecha : null,
        startValue: Number(inicial),
      });
      setValor('');
      setMostrarFecha(false);
    } catch (e) {
      console.error('Error al guardar objetivo:', e.message, e);
      Alert.alert('Error', 'No se pudo guardar, intentá de nuevo.');
    } finally {
      setGuardando(false);
    }
  }

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={styles.card}>
          <Text style={styles.titulo}>Crear objetivo</Text>
          <View style={styles.tipoFila}>
            <Pressable
              style={[styles.tipoBoton, tipo === 'bajar' && styles.tipoBotonActivo]}
              onPress={() => setTipo('bajar')}
            >
              <Text style={styles.tipoBotonTexto}>Bajar de peso</Text>
            </Pressable>
            <Pressable
              style={[styles.tipoBoton, tipo === 'subir' && styles.tipoBotonActivo]}
              onPress={() => setTipo('subir')}
            >
              <Text style={styles.tipoBotonTexto}>Subir de peso</Text>
            </Pressable>
          </View>
          <TextInput
            style={styles.input}
            placeholder="Peso inicial (kg)"
            placeholderTextColor={colors.textTertiary}
            keyboardType="decimal-pad"
            value={inicial}
            onChangeText={setInicial}
          />
          <TextInput
            style={styles.input}
            placeholder="Peso objetivo (kg)"
            placeholderTextColor={colors.textTertiary}
            keyboardType="decimal-pad"
            value={valor}
            onChangeText={setValor}
          />
          <Pressable style={styles.fechaButton} onPress={() => setMostrarFecha(!mostrarFecha)}>
            <Text style={styles.fechaButtonTexto}>
              {mostrarFecha ? 'Quitar fecha objetivo' : 'Agregar fecha objetivo (opcional)'}
            </Text>
          </Pressable>
          {mostrarFecha && (
            <View style={styles.fechaFila}>
              <DateTimePicker
                value={fecha}
                mode="date"
                display={Platform.OS === 'ios' ? 'compact' : 'default'}
                themeVariant="dark"
                minimumDate={new Date()}
                onChange={(event, valorFecha) => valorFecha && setFecha(valorFecha)}
              />
            </View>
          )}
          <Pressable
            style={[
              styles.guardarButton,
              (!valorValido || !inicialValido || guardando) && styles.guardarButtonDeshabilitado,
            ]}
            disabled={!valorValido || !inicialValido || guardando}
            onPress={handleGuardar}
          >
            <Text style={styles.guardarButtonTexto}>{guardando ? 'Guardando...' : 'Guardar'}</Text>
          </Pressable>
          <Pressable onPress={onClose}>
            <Text style={styles.cancelar}>Cancelar</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'center', padding: 22 },
  card: { backgroundColor: colors.surface, borderRadius: 20, padding: 22 },
  titulo: {
    fontFamily: 'SpaceGrotesk_700Bold',
    fontSize: 20,
    color: colors.textPrimary,
    marginBottom: 16,
    textAlign: 'center',
  },
  tipoFila: {
    flexDirection: 'row',
    marginBottom: 12,
    backgroundColor: colors.background,
    borderRadius: 12,
    padding: 4,
  },
  tipoBoton: { flex: 1, paddingVertical: 10, borderRadius: 8, alignItems: 'center' },
  tipoBotonActivo: { backgroundColor: colors.cobalto },
  tipoBotonTexto: { fontFamily: 'Inter_500Medium', color: colors.textPrimary, fontSize: 13 },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 14,
    padding: 14,
    marginBottom: 12,
    backgroundColor: colors.background,
    color: colors.textPrimary,
    fontFamily: 'Inter_400Regular',
  },
  fechaButton: {
    borderRadius: 14,
    padding: 14,
    marginBottom: 12,
    backgroundColor: colors.background,
    alignItems: 'center',
  },
  fechaButtonTexto: { fontFamily: 'Inter_500Medium', color: colors.textPrimary },
  fechaFila: { alignItems: 'center', marginBottom: 12 },
  guardarButton: { borderRadius: 20, paddingVertical: 14, alignItems: 'center', backgroundColor: colors.cobalto },
  guardarButtonDeshabilitado: { opacity: 0.5 },
  guardarButtonTexto: { fontFamily: 'Inter_600SemiBold', color: '#fff', fontSize: 16 },
  cancelar: { textAlign: 'center', marginTop: 16, fontFamily: 'Inter_500Medium', color: colors.textSecondary },
});
