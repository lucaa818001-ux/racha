import { useEffect, useState } from 'react';
import { Modal, View, Image, Text, Pressable, ScrollView, ActivityIndicator, StyleSheet } from 'react-native';
import { getSignedBodyPhotoUrl } from '../lib/bodyLogs';
import { calcularIMC } from '../lib/imc';
import { colors } from '../theme/colors';

export default function HistorialFisicoModal({ visible, logs, onClose, onBorrar }) {
  const [fotoAmpliada, setFotoAmpliada] = useState(null);
  const [url, setUrl] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!visible) setFotoAmpliada(null);
  }, [visible]);

  useEffect(() => {
    if (!fotoAmpliada) return;
    setUrl(null);
    setError(null);
    getSignedBodyPhotoUrl(fotoAmpliada)
      .then(setUrl)
      .catch(() => setError('No se pudo cargar la foto'));
  }, [fotoAmpliada]);

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <View style={styles.contenedor}>
        <View style={styles.encabezado}>
          {fotoAmpliada ? (
            <Pressable onPress={() => setFotoAmpliada(null)} hitSlop={12}>
              <Text style={styles.volver}>‹ Historial</Text>
            </Pressable>
          ) : (
            <Text style={styles.titulo}>Historial de registros</Text>
          )}
          <Pressable onPress={onClose} hitSlop={12}>
            <Text style={styles.cerrar}>✕</Text>
          </Pressable>
        </View>
        {fotoAmpliada ? (
          <View style={styles.fotoContenedor}>
            {error && <Text style={styles.error}>{error}</Text>}
            {!error && !url && <ActivityIndicator size="large" color={colors.cobalto} />}
            {url && (
              <View style={styles.marco}>
                <Image source={{ uri: url }} style={styles.image} resizeMode="cover" />
              </View>
            )}
          </View>
        ) : (
          <ScrollView contentContainerStyle={{ padding: 22 }}>
            {logs.length === 0 && <Text style={styles.sinRegistros}>Todavía no registraste nada.</Text>}
            {logs.map((log) => (
              <Pressable
                key={log.id}
                style={styles.fila}
                onPress={() => log.photo_path && setFotoAmpliada(log.photo_path)}
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
        )}
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
  volver: { fontFamily: 'Inter_600SemiBold', fontSize: 16, color: colors.cobalto },
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
  fotoContenedor: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  marco: {
    width: '85%',
    height: '75%',
    borderRadius: 24,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: colors.border,
  },
  image: { width: '100%', height: '100%' },
  error: { color: colors.textPrimary, fontFamily: 'Inter_500Medium' },
});
