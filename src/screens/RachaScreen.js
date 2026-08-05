import { useCallback, useEffect, useState } from 'react';
import { View, Text, Pressable, StyleSheet, Alert, ActivityIndicator } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { supabase } from '../lib/supabase';
import { getCheckinsForRange, createCheckin } from '../lib/checkins';
import { calcularRachaActual } from '../lib/rachaCalculo';
import CalendarGrid from '../components/CalendarGrid';
import PhotoViewerModal from '../components/PhotoViewerModal';
import { colors } from '../theme/colors';

function formatDate(d) {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export default function RachaScreen() {
  const [userId, setUserId] = useState(null);
  const [checkins, setCheckins] = useState([]);
  const [rachaActual, setRachaActual] = useState(0);
  const [checkinHoy, setCheckinHoy] = useState(null);
  const [loading, setLoading] = useState(true);
  const [subiendo, setSubiendo] = useState(false);
  const [fotoSeleccionada, setFotoSeleccionada] = useState(null);

  const hoy = new Date();

  const cargarDatos = useCallback(async (uid) => {
    const desde = new Date();
    desde.setDate(desde.getDate() - 60);
    const lista = await getCheckinsForRange(uid, desde, new Date());
    setCheckins(lista);
    setRachaActual(calcularRachaActual(lista.map((c) => c.date)));
    setCheckinHoy(lista.find((c) => c.date === formatDate(hoy)) || null);
  }, []);

  useEffect(() => {
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      setUserId(user.id);
      await cargarDatos(user.id);
      setLoading(false);
    });
  }, [cargarDatos]);

  async function elegirFoto(origen) {
    const permiso =
      origen === 'camara'
        ? await ImagePicker.requestCameraPermissionsAsync()
        : await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permiso.granted) {
      Alert.alert('Permiso necesario', 'Activá el permiso correspondiente en Ajustes para poder registrar tu día.');
      return;
    }
    const resultado =
      origen === 'camara'
        ? await ImagePicker.launchCameraAsync({ quality: 0.6 })
        : await ImagePicker.launchImageLibraryAsync({ quality: 0.6 });
    if (resultado.canceled) return;

    setSubiendo(true);
    try {
      await createCheckin(userId, resultado.assets[0].uri);
      await cargarDatos(userId);
    } catch (e) {
      console.error('Error en createCheckin:', e.message, e);
      Alert.alert('Error', 'No se pudo guardar, intentá de nuevo.');
    } finally {
      setSubiendo(false);
    }
  }

  function handleRegistrar() {
    Alert.alert('Registrar hoy', '¿Cómo querés agregar la foto?', [
      { text: 'Tomar foto', onPress: () => elegirFoto('camara') },
      { text: 'Elegir de galería', onPress: () => elegirFoto('galeria') },
      { text: 'Cancelar', style: 'cancel' },
    ]);
  }

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={colors.cobalto} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.titulo}>Racha</Text>
      <View style={styles.contador}>
        <Text style={styles.llama}>🔥</Text>
        <Text style={styles.numero}>{rachaActual}</Text>
        <Text style={styles.dias}>días seguidos</Text>
      </View>
      <CalendarGrid
        year={hoy.getFullYear()}
        month={hoy.getMonth()}
        checkins={checkins}
        onDayPress={(checkin) => setFotoSeleccionada(checkin.photo_path)}
      />
      <Pressable
        style={[styles.boton, checkinHoy && styles.botonHecho]}
        disabled={!!checkinHoy || subiendo}
        onPress={handleRegistrar}
      >
        <Text style={styles.botonTexto}>
          {subiendo ? 'Subiendo...' : checkinHoy ? '✅ Ya fuiste hoy' : 'Registrar hoy'}
        </Text>
      </Pressable>
      <PhotoViewerModal
        visible={!!fotoSeleccionada}
        photoPath={fotoSeleccionada}
        onClose={() => setFotoSeleccionada(null)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background, padding: 22 },
  center: { flex: 1, backgroundColor: colors.background, alignItems: 'center', justifyContent: 'center' },
  titulo: { fontSize: 28, fontFamily: 'SpaceGrotesk_700Bold', color: colors.textPrimary, marginBottom: 16 },
  contador: { flexDirection: 'row', alignItems: 'baseline', marginBottom: 24 },
  llama: { fontSize: 32, marginRight: 8 },
  numero: { fontSize: 48, fontFamily: 'SpaceGrotesk_700Bold', color: colors.textPrimary, marginRight: 8 },
  dias: { fontSize: 16, fontFamily: 'Inter_400Regular', color: colors.textSecondary },
  boton: { marginTop: 24, borderRadius: 20, paddingVertical: 16, alignItems: 'center', backgroundColor: colors.cobalto },
  botonHecho: { backgroundColor: colors.surface },
  botonTexto: { fontFamily: 'Inter_600SemiBold', color: '#fff', fontSize: 16 },
});
