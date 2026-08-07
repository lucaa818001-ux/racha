import { useState } from 'react';
import { Modal, View, Text, TextInput, Pressable, StyleSheet, Alert, Platform } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import DateTimePicker from '@react-native-community/datetimepicker';
import { colors } from '../theme/colors';

function aNumero(texto) {
  return Number(String(texto).replace(',', '.'));
}

export default function RegistrarFisicoModal({ visible, alturaInicial, onGuardar, onClose }) {
  const [fecha, setFecha] = useState(new Date());
  const [peso, setPeso] = useState('');
  const [altura, setAltura] = useState(alturaInicial ? String(alturaInicial) : '');
  const [photoUri, setPhotoUri] = useState(null);
  const [guardando, setGuardando] = useState(false);
  const [mostrarMedidas, setMostrarMedidas] = useState(false);
  const [cintura, setCintura] = useState('');
  const [brazo, setBrazo] = useState('');
  const [pierna, setPierna] = useState('');

  const pesoValido = peso.trim() !== '' && !Number.isNaN(aNumero(peso));
  const alturaValida = altura.trim() !== '' && !Number.isNaN(aNumero(altura));

  async function elegirFoto(origen) {
    const permiso =
      origen === 'camara'
        ? await ImagePicker.requestCameraPermissionsAsync()
        : await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permiso.granted) {
      Alert.alert('Permiso necesario', 'Activá el permiso correspondiente en Ajustes.');
      return;
    }
    const resultado =
      origen === 'camara'
        ? await ImagePicker.launchCameraAsync({ quality: 0.6 })
        : await ImagePicker.launchImageLibraryAsync({ quality: 0.6 });
    if (!resultado.canceled) setPhotoUri(resultado.assets[0].uri);
  }

  function elegirOrigenFoto() {
    Alert.alert('Agregar foto', '¿Cómo querés agregarla?', [
      { text: 'Tomar foto', onPress: () => elegirFoto('camara') },
      { text: 'Elegir de galería', onPress: () => elegirFoto('galeria') },
      { text: 'Cancelar', style: 'cancel' },
    ]);
  }

  async function handleGuardar() {
    setGuardando(true);
    try {
      const measurements = {};
      if (cintura.trim() !== '' && !Number.isNaN(aNumero(cintura))) measurements.cintura = aNumero(cintura);
      if (brazo.trim() !== '' && !Number.isNaN(aNumero(brazo))) measurements.brazo = aNumero(brazo);
      if (pierna.trim() !== '' && !Number.isNaN(aNumero(pierna))) measurements.pierna = aNumero(pierna);

      await onGuardar({
        date: fecha,
        weight: aNumero(peso),
        height: aNumero(altura),
        photoUri,
        measurements: Object.keys(measurements).length > 0 ? measurements : null,
      });
      setPeso('');
      setPhotoUri(null);
      setFecha(new Date());
      setCintura('');
      setBrazo('');
      setPierna('');
      setMostrarMedidas(false);
    } catch (e) {
      console.error('Error al guardar registro físico:', e.message, e);
      Alert.alert('Error', 'No se pudo guardar, intentá de nuevo.');
    } finally {
      setGuardando(false);
    }
  }

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={styles.card}>
          <Text style={styles.titulo}>Registrar</Text>
          <View style={styles.fechaFila}>
            <Text style={styles.fechaTexto}>Fecha</Text>
            <DateTimePicker
              value={fecha}
              mode="date"
              display={Platform.OS === 'ios' ? 'compact' : 'default'}
              themeVariant="dark"
              maximumDate={new Date()}
              onChange={(event, valor) => valor && setFecha(valor)}
            />
          </View>
          <TextInput
            style={styles.input}
            placeholder="Peso (kg)"
            placeholderTextColor={colors.textTertiary}
            keyboardType="decimal-pad"
            value={peso}
            onChangeText={setPeso}
          />
          <TextInput
            style={styles.input}
            placeholder="Altura (cm)"
            placeholderTextColor={colors.textTertiary}
            keyboardType="decimal-pad"
            value={altura}
            onChangeText={setAltura}
          />
          <Pressable style={styles.fotoButton} onPress={elegirOrigenFoto}>
            <Text style={styles.fotoButtonTexto}>{photoUri ? 'Foto lista ✓' : 'Agregar foto (opcional)'}</Text>
          </Pressable>
          <Pressable style={styles.fotoButton} onPress={() => setMostrarMedidas(!mostrarMedidas)}>
            <Text style={styles.fotoButtonTexto}>
              {mostrarMedidas ? 'Ocultar medidas' : 'Agregar medidas (opcional)'}
            </Text>
          </Pressable>
          {mostrarMedidas && (
            <>
              <TextInput
                style={styles.input}
                placeholder="Cintura (cm)"
                placeholderTextColor={colors.textTertiary}
                keyboardType="decimal-pad"
                value={cintura}
                onChangeText={setCintura}
              />
              <TextInput
                style={styles.input}
                placeholder="Brazo (cm)"
                placeholderTextColor={colors.textTertiary}
                keyboardType="decimal-pad"
                value={brazo}
                onChangeText={setBrazo}
              />
              <TextInput
                style={styles.input}
                placeholder="Pierna (cm)"
                placeholderTextColor={colors.textTertiary}
                keyboardType="decimal-pad"
                value={pierna}
                onChangeText={setPierna}
              />
            </>
          )}
          <Pressable
            style={[
              styles.guardarButton,
              (!pesoValido || !alturaValida || guardando) && styles.guardarButtonDeshabilitado,
            ]}
            disabled={!pesoValido || !alturaValida || guardando}
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
  fechaFila: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  fechaTexto: { fontFamily: 'Inter_500Medium', color: colors.textPrimary, fontSize: 15 },
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
  fotoButton: {
    borderRadius: 14,
    padding: 14,
    marginBottom: 16,
    backgroundColor: colors.background,
    alignItems: 'center',
  },
  fotoButtonTexto: { fontFamily: 'Inter_500Medium', color: colors.textPrimary },
  guardarButton: { borderRadius: 20, paddingVertical: 14, alignItems: 'center', backgroundColor: colors.cobalto },
  guardarButtonDeshabilitado: { opacity: 0.5 },
  guardarButtonTexto: { fontFamily: 'Inter_600SemiBold', color: '#fff', fontSize: 16 },
  cancelar: { textAlign: 'center', marginTop: 16, fontFamily: 'Inter_500Medium', color: colors.textSecondary },
});
