import { useEffect, useState } from 'react';
import { Modal, View, Text, Pressable, StyleSheet, ActivityIndicator, ScrollView } from 'react-native';
import { getBodyLogsConFoto, getSignedBodyPhotoUrl } from '../lib/bodyLogs';
import BeforeAfterSlider from './BeforeAfterSlider';
import { colors } from '../theme/colors';

export default function ComparacionFotosModal({ visible, userId, onClose }) {
  const [fotos, setFotos] = useState([]);
  const [antesId, setAntesId] = useState(null);
  const [despuesId, setDespuesId] = useState(null);
  const [beforeUrl, setBeforeUrl] = useState(null);
  const [afterUrl, setAfterUrl] = useState(null);
  const [eligiendo, setEligiendo] = useState(null);
  const [cargando, setCargando] = useState(true);

  useEffect(() => {
    if (!visible) return;
    setCargando(true);
    getBodyLogsConFoto(userId).then((lista) => {
      setFotos(lista);
      if (lista.length >= 2) {
        setAntesId(lista[0].id);
        setDespuesId(lista[lista.length - 1].id);
      }
      setCargando(false);
    });
  }, [visible, userId]);

  useEffect(() => {
    const foto = fotos.find((f) => f.id === antesId);
    if (foto) getSignedBodyPhotoUrl(foto.photo_path).then(setBeforeUrl);
  }, [antesId, fotos]);

  useEffect(() => {
    const foto = fotos.find((f) => f.id === despuesId);
    if (foto) getSignedBodyPhotoUrl(foto.photo_path).then(setAfterUrl);
  }, [despuesId, fotos]);

  function elegir(id) {
    if (eligiendo === 'antes') setAntesId(id);
    if (eligiendo === 'despues') setDespuesId(id);
    setEligiendo(null);
  }

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <Pressable style={styles.cerrar} onPress={onClose} hitSlop={12}>
          <Text style={styles.cerrarTexto}>✕ Volver</Text>
        </Pressable>
        {cargando && <ActivityIndicator size="large" color={colors.cobalto} />}
        {!cargando && eligiendo && (
          <ScrollView style={styles.listaFechas}>
            {fotos.map((f) => (
              <Pressable key={f.id} style={styles.filaFecha} onPress={() => elegir(f.id)}>
                <Text style={styles.filaFechaTexto}>{f.date}</Text>
              </Pressable>
            ))}
          </ScrollView>
        )}
        {!cargando && !eligiendo && beforeUrl && afterUrl && (
          <>
            <BeforeAfterSlider beforeUrl={beforeUrl} afterUrl={afterUrl} />
            <View style={styles.botonesFila}>
              <Pressable onPress={() => setEligiendo('antes')}>
                <Text style={styles.cambiarTexto}>Cambiar "antes"</Text>
              </Pressable>
              <Pressable onPress={() => setEligiendo('despues')}>
                <Text style={styles.cambiarTexto}>Cambiar "después"</Text>
              </Pressable>
            </View>
          </>
        )}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: colors.background,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 22,
  },
  cerrar: { position: 'absolute', top: 60, left: 22, zIndex: 1 },
  cerrarTexto: { color: colors.textPrimary, fontFamily: 'Inter_600SemiBold', fontSize: 16 },
  botonesFila: { flexDirection: 'row', justifyContent: 'space-between', width: '100%', marginTop: 16 },
  cambiarTexto: { fontFamily: 'Inter_500Medium', color: colors.cobalto },
  listaFechas: { width: '100%', marginTop: 100 },
  filaFecha: { padding: 14, backgroundColor: colors.surface, borderRadius: 12, marginBottom: 8 },
  filaFechaTexto: { color: colors.textPrimary, fontFamily: 'Inter_500Medium' },
});
