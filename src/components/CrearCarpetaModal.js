import { useState } from 'react';
import { Modal, View, Text, TextInput, Pressable, StyleSheet, Alert } from 'react-native';
import { colors } from '../theme/colors';

export default function CrearCarpetaModal({ visible, onGuardar, onClose }) {
  const [nombre, setNombre] = useState('');
  const [guardando, setGuardando] = useState(false);

  const nombreValido = nombre.trim() !== '';

  async function handleGuardar() {
    setGuardando(true);
    try {
      await onGuardar(nombre.trim());
      setNombre('');
    } catch (e) {
      console.error('Error al crear carpeta:', e.message, e);
      Alert.alert('Error', 'No se pudo crear la carpeta, intentá de nuevo.');
    } finally {
      setGuardando(false);
    }
  }

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={styles.card}>
          <Text style={styles.titulo}>Nueva carpeta</Text>
          <TextInput
            style={styles.input}
            placeholder="Nombre (ej: Pecho, Lunes)"
            placeholderTextColor={colors.textTertiary}
            value={nombre}
            onChangeText={setNombre}
            autoFocus
          />
          <Pressable
            style={[styles.guardarButton, (!nombreValido || guardando) && styles.guardarButtonDeshabilitado]}
            disabled={!nombreValido || guardando}
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
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 14,
    padding: 14,
    marginBottom: 16,
    backgroundColor: colors.background,
    color: colors.textPrimary,
    fontFamily: 'Inter_400Regular',
  },
  guardarButton: { borderRadius: 20, paddingVertical: 14, alignItems: 'center', backgroundColor: colors.cobalto },
  guardarButtonDeshabilitado: { opacity: 0.5 },
  guardarButtonTexto: { fontFamily: 'Inter_600SemiBold', color: '#fff', fontSize: 16 },
  cancelar: { textAlign: 'center', marginTop: 16, fontFamily: 'Inter_500Medium', color: colors.textSecondary },
});
