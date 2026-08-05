import { useEffect, useState } from 'react';
import { Modal, View, Image, Text, Pressable, ActivityIndicator, StyleSheet } from 'react-native';
import { getSignedPhotoUrl } from '../lib/checkins';
import { colors } from '../theme/colors';

export default function PhotoViewerModal({ visible, photoPath, onClose }) {
  const [url, setUrl] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!visible || !photoPath) return;
    setUrl(null);
    setError(null);
    getSignedPhotoUrl(photoPath)
      .then(setUrl)
      .catch(() => setError('No se pudo cargar la foto'));
  }, [visible, photoPath]);

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <Pressable style={styles.cerrar} onPress={onClose} hitSlop={12}>
          <Text style={styles.cerrarTexto}>✕ Volver</Text>
        </Pressable>
        <Pressable style={styles.contenido} onPress={onClose}>
          {error && <Text style={styles.error}>{error}</Text>}
          {!error && !url && <ActivityIndicator size="large" color={colors.cobalto} />}
          {url && (
            <View style={styles.marco}>
              <Image source={{ uri: url }} style={styles.image} resizeMode="cover" />
            </View>
          )}
        </Pressable>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.9)' },
  cerrar: { position: 'absolute', top: 60, left: 22, zIndex: 1 },
  cerrarTexto: { color: colors.textPrimary, fontFamily: 'Inter_600SemiBold', fontSize: 16 },
  contenido: { flex: 1, alignItems: 'center', justifyContent: 'center' },
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
