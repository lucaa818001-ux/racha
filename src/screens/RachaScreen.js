import { useCallback, useState } from 'react';
import { View, Text, Pressable, StyleSheet, Alert, ActivityIndicator, ScrollView, RefreshControl } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import * as ImagePicker from 'expo-image-picker';
import { supabase } from '../lib/supabase';
import { getCheckinsForRange, createCheckin, getRachaMaxima, getSignedPhotoUrl } from '../lib/checkins';
import { calcularRachaActual } from '../lib/rachaCalculo';
import { calcularEstadisticas } from '../lib/estadisticas';
import { sincronizarRecordatorios } from '../lib/recordatorio';
import CalendarGrid from '../components/CalendarGrid';
import MonthSelector from '../components/MonthSelector';
import YearHeatmap from '../components/YearHeatmap';
import PhotoViewerModal from '../components/PhotoViewerModal';
import { colors } from '../theme/colors';

function formatDate(d) {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export default function RachaScreen() {
  const hoy = new Date();
  const [userId, setUserId] = useState(null);
  const [checkinsDelAnio, setCheckinsDelAnio] = useState([]);
  const [rachaActual, setRachaActual] = useState(0);
  const [rachaMaxima, setRachaMaxima] = useState(0);
  const [checkinHoy, setCheckinHoy] = useState(null);
  const [loading, setLoading] = useState(true);
  const [subiendo, setSubiendo] = useState(false);
  const [fotoSeleccionada, setFotoSeleccionada] = useState(null);
  const [vista, setVista] = useState('mes');
  const [mesVisible, setMesVisible] = useState(hoy.getMonth());
  const [refrescando, setRefrescando] = useState(false);

  const cargarDatos = useCallback(async (uid) => {
    const inicioAnio = new Date(hoy.getFullYear(), 0, 1);
    const finAnio = new Date(hoy.getFullYear(), 11, 31);
    const [lista, maxima] = await Promise.all([
      getCheckinsForRange(uid, inicioAnio, finAnio),
      getRachaMaxima(uid),
    ]);
    setCheckinsDelAnio(lista);
    setRachaMaxima(maxima);
    setRachaActual(calcularRachaActual(lista.map((c) => c.date)));
    setCheckinHoy(lista.find((c) => c.date === formatDate(hoy)) || null);
    await sincronizarRecordatorios(lista);
  }, []);

  useFocusEffect(
    useCallback(() => {
      let cancelado = false;
      supabase.auth.getUser().then(async ({ data: { user } }) => {
        if (cancelado) return;
        setUserId(user.id);
        await cargarDatos(user.id);
        if (!cancelado) setLoading(false);
      });
      return () => {
        cancelado = true;
      };
    }, [cargarDatos])
  );

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

  async function handleRefrescar() {
    setRefrescando(true);
    try {
      await cargarDatos(userId);
    } finally {
      setRefrescando(false);
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

  const { totalMes, totalAnio, promedioSemanal } = calcularEstadisticas(checkinsDelAnio, hoy);

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={{ padding: 22 }}
      refreshControl={
        <RefreshControl refreshing={refrescando} onRefresh={handleRefrescar} tintColor={colors.cobalto} />
      }
    >
      <Text style={styles.titulo}>Racha</Text>
      <View style={styles.contador}>
        <Text style={styles.llama}>🔥</Text>
        <Text style={styles.numero}>{rachaActual}</Text>
        <Text style={styles.dias}>días seguidos</Text>
      </View>

      <View style={styles.statsFila}>
        <View style={styles.stat}>
          <Text style={styles.statNumero}>{rachaMaxima}</Text>
          <Text style={styles.statLabel}>Racha máxima</Text>
        </View>
        <View style={styles.stat}>
          <Text style={styles.statNumero}>{totalMes}</Text>
          <Text style={styles.statLabel}>Este mes</Text>
        </View>
        <View style={styles.stat}>
          <Text style={styles.statNumero}>{totalAnio}</Text>
          <Text style={styles.statLabel}>Este año</Text>
        </View>
        <View style={styles.stat}>
          <Text style={styles.statNumero}>{promedioSemanal}</Text>
          <Text style={styles.statLabel}>Prom./semana</Text>
        </View>
      </View>

      <View style={styles.toggleFila}>
        <Pressable
          onPress={() => setVista('mes')}
          style={[styles.toggleBoton, vista === 'mes' && styles.toggleBotonActivo]}
        >
          <Text style={styles.toggleTexto}>Mes</Text>
        </Pressable>
        <Pressable
          onPress={() => setVista('anio')}
          style={[styles.toggleBoton, vista === 'anio' && styles.toggleBotonActivo]}
        >
          <Text style={styles.toggleTexto}>Año</Text>
        </Pressable>
      </View>

      {vista === 'mes' ? (
        <>
          <MonthSelector
            year={hoy.getFullYear()}
            month={mesVisible}
            onChange={(_year, month) => setMesVisible(month)}
          />
          <CalendarGrid
            year={hoy.getFullYear()}
            month={mesVisible}
            checkins={checkinsDelAnio}
            onDayPress={(checkin) => setFotoSeleccionada(checkin.photo_path)}
          />
        </>
      ) : (
        <YearHeatmap year={hoy.getFullYear()} checkins={checkinsDelAnio} />
      )}

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
        getSignedUrl={getSignedPhotoUrl}
        onClose={() => setFotoSeleccionada(null)}
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  center: { flex: 1, backgroundColor: colors.background, alignItems: 'center', justifyContent: 'center' },
  titulo: { fontSize: 28, fontFamily: 'SpaceGrotesk_700Bold', color: colors.textPrimary, marginBottom: 16 },
  contador: { flexDirection: 'row', alignItems: 'baseline', marginBottom: 20 },
  llama: { fontSize: 32, marginRight: 8 },
  numero: { fontSize: 48, fontFamily: 'SpaceGrotesk_700Bold', color: colors.textPrimary, marginRight: 8 },
  dias: { fontSize: 16, fontFamily: 'Inter_400Regular', color: colors.textSecondary },
  statsFila: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 20 },
  stat: { alignItems: 'center' },
  statNumero: { fontFamily: 'SpaceGrotesk_600SemiBold', fontSize: 20, color: colors.textPrimary },
  statLabel: { fontFamily: 'Inter_400Regular', fontSize: 11, color: colors.textTertiary, marginTop: 2 },
  toggleFila: { flexDirection: 'row', marginBottom: 16, backgroundColor: colors.surface, borderRadius: 12, padding: 4 },
  toggleBoton: { flex: 1, paddingVertical: 8, borderRadius: 8, alignItems: 'center' },
  toggleBotonActivo: { backgroundColor: colors.cobalto },
  toggleTexto: { fontFamily: 'Inter_600SemiBold', color: colors.textPrimary, fontSize: 14 },
  boton: { marginTop: 24, borderRadius: 20, paddingVertical: 16, alignItems: 'center', backgroundColor: colors.cobalto },
  botonHecho: { backgroundColor: colors.surface },
  botonTexto: { fontFamily: 'Inter_600SemiBold', color: '#fff', fontSize: 16 },
});
