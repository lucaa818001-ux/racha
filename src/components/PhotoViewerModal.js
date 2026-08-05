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
      <Pressable style={styles.overlay} onPress={onClose}>
        {error && <Text style={styles.error}>{error}</Text>}
        {!error && !url && <ActivityIndicator size="large" color={colors.cobalto} />}
        {url && <Image source={{ uri: url }} style={styles.image} resizeMode="contain" />}
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.9)', alignItems: 'center', justifyContent: 'center' },
  image: { width: '90%', height: '80%' },
  error: { color: colors.textPrimary, fontFamily: 'Inter_500Medium' },
});
