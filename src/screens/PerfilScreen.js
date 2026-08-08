import { useCallback, useEffect, useState } from 'react';
import { View, Text, Pressable, StyleSheet, Platform, ScrollView, Image, Alert, Switch } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import DateTimePicker from '@react-native-community/datetimepicker';
import * as ImagePicker from 'expo-image-picker';
import { supabase } from '../lib/supabase';
import { getCheckinsForRange, getRachaMaxima, getSignedPhotoUrl } from '../lib/checkins';
import { calcularRachaActual } from '../lib/rachaCalculo';
import {
  getHoraRecordatorio,
  setHoraRecordatorio,
  sincronizarRecordatorios,
  getNotificacionesActivadas,
  setNotificacionesActivadas,
} from '../lib/recordatorio';
import { getBodyLogsForRange } from '../lib/bodyLogs';
import { getActiveGoal, getGoalHistory } from '../lib/goals';
import { calcularProgreso } from '../lib/objetivoCalculo';
import { getAllFinishedWorkouts } from '../lib/workouts';
import { calcularVolumenTotal } from '../lib/workoutsCalculo';
import { sincronizarLogros, uploadProfilePhoto, getSignedProfilePhotoUrl } from '../lib/logrosDb';
import EditarNombreModal from '../components/EditarNombreModal';
import MiniSparkline from '../components/MiniSparkline';
import PhotoViewerModal from '../components/PhotoViewerModal';
import { colors, getRachaColor } from '../theme/colors';

const MESES = [
  'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
  'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre',
];

function formatFechaLarga(fechaStr) {
  const d = new Date(fechaStr);
  return `${d.getDate()} de ${MESES[d.getMonth()]} de ${d.getFullYear()}`;
}

const ANCHO_SPARKLINE = 260;

function FotoCheckin({ checkin, onSeleccionar }) {
  const [url, setUrl] = useState(null);

  useEffect(() => {
    getSignedPhotoUrl(checkin.photo_path)
      .then(setUrl)
      .catch(() => {});
  }, [checkin.photo_path]);

  return (
    <Pressable style={styles.miniatura} onPress={() => onSeleccionar(checkin.photo_path)}>
      {url ? (
        <Image source={{ uri: url }} style={styles.miniaturaImagen} resizeMode="cover" />
      ) : (
        <View style={styles.miniaturaImagen} />
      )}
    </Pressable>
  );
}

export default function PerfilScreen() {
  const [userId, setUserId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [nombre, setNombre] = useState('');
  const [miembroDesde, setMiembroDesde] = useState(null);
  const [fotoPerfilUrl, setFotoPerfilUrl] = useState(null);
  const [rachaActual, setRachaActual] = useState(0);
  const [rachaMaxima, setRachaMaxima] = useState(0);
  const [pesoActual, setPesoActual] = useState(null);
  const [sparklineValores, setSparklineValores] = useState([]);
  const [objetivoActivo, setObjetivoActivo] = useState(null);
  const [progresoObjetivo, setProgresoObjetivo] = useState(0);
  const [totalEntrenamientos, setTotalEntrenamientos] = useState(0);
  const [volumenTotal, setVolumenTotal] = useState(0);
  const [logros, setLogros] = useState([]);
  const [fotosRecientes, setFotosRecientes] = useState([]);
  const [fotoSeleccionada, setFotoSeleccionada] = useState(null);
  const [editarNombreVisible, setEditarNombreVisible] = useState(false);
  const [hora, setHora] = useState('20:00');
  const [notificacionesActivadas, setNotificacionesActivadasState] = useState(true);

  const cargarDatos = useCallback(async (user) => {
    setNombre(user.user_metadata?.nombre || '');
    setMiembroDesde(user.created_at);

    try {
      const url = await getSignedProfilePhotoUrl(user.id);
      setFotoPerfilUrl(url);
    } catch {
      setFotoPerfilUrl(null);
    }

    const hoy = new Date();
    const desde60 = new Date();
    desde60.setDate(desde60.getDate() - 60);
    const checkinsRecientes = await getCheckinsForRange(user.id, desde60, hoy);
    const actual = calcularRachaActual(checkinsRecientes.map((c) => c.date));
    const maxima = await getRachaMaxima(user.id);
    setRachaActual(actual);
    setRachaMaxima(maxima);
    setFotosRecientes(checkinsRecientes.filter((c) => c.photo_path).reverse().slice(0, 8));

    const desdeInicio = new Date(2000, 0, 1);
    const logsPeso = await getBodyLogsForRange(user.id, desdeInicio, hoy);
    const ultimoPeso = logsPeso.length > 0 ? logsPeso[logsPeso.length - 1].weight : null;
    setPesoActual(ultimoPeso);
    setSparklineValores(logsPeso.slice(-10).map((l) => l.weight));

    const goal = await getActiveGoal(user.id);
    setObjetivoActivo(goal);
    if (goal) {
      const pesoParaProgreso = ultimoPeso !== null ? ultimoPeso : goal.start_value;
      setProgresoObjetivo(calcularProgreso(goal, pesoParaProgreso));
    }

    const historial = await getGoalHistory(user.id);
    const objetivosCompletados = historial.filter((g) => g.status === 'completado').length;

    const workouts = await getAllFinishedWorkouts(user.id);
    setTotalEntrenamientos(workouts.length);
    const volumen = workouts.reduce((total, w) => {
      const entradas = (w.exercise_logs ?? [])
        .filter((log) => log.exercises)
        .map((log) => ({ type: log.exercises.type, sets: log.sets }));
      return total + calcularVolumenTotal(entradas);
    }, 0);
    setVolumenTotal(volumen);

    const logrosDesbloqueados = await sincronizarLogros(user.id, {
      rachaMaxima: maxima,
      objetivosCompletados,
      totalEntrenamientos: workouts.length,
    });
    setLogros(logrosDesbloqueados);
  }, []);

  useFocusEffect(
    useCallback(() => {
      let cancelado = false;
      supabase.auth.getUser().then(async ({ data: { user } }) => {
        if (cancelado) return;
        try {
          setUserId(user.id);
          const h = await getHoraRecordatorio();
          if (!cancelado) setHora(h);
          const activadas = await getNotificacionesActivadas();
          if (!cancelado) setNotificacionesActivadasState(activadas);
          await cargarDatos(user);
        } catch (e) {
          console.error('Error al cargar Perfil:', e.message, e);
          if (!cancelado) Alert.alert('Error', 'No se pudo cargar, intentá de nuevo.');
        } finally {
          if (!cancelado) setLoading(false);
        }
      });
      return () => {
        cancelado = true;
      };
    }, [cargarDatos])
  );

  async function alCambiarHora(event, fecha) {
    if (!fecha) return;
    const horaStr = `${String(fecha.getHours()).padStart(2, '0')}:${String(fecha.getMinutes()).padStart(2, '0')}`;
    setHora(horaStr);
    await setHoraRecordatorio(horaStr);

    const hoy = new Date();
    const checkins = await getCheckinsForRange(
      userId,
      new Date(hoy.getFullYear(), 0, 1),
      new Date(hoy.getFullYear(), 11, 31)
    );
    await sincronizarRecordatorios(checkins);
  }

  async function alCambiarNotificaciones(valor) {
    setNotificacionesActivadasState(valor);
    try {
      await setNotificacionesActivadas(valor);
      const hoy = new Date();
      const checkins = await getCheckinsForRange(
        userId,
        new Date(hoy.getFullYear(), 0, 1),
        new Date(hoy.getFullYear(), 11, 31)
      );
      await sincronizarRecordatorios(checkins);
    } catch (e) {
      console.error('Error al cambiar notificaciones:', e.message, e);
      Alert.alert('Error', 'No se pudo guardar, intentá de nuevo.');
    }
  }

  async function handleGuardarNombre(nuevoNombre) {
    const { error } = await supabase.auth.updateUser({ data: { nombre: nuevoNombre } });
    if (error) throw error;
    setNombre(nuevoNombre);
    setEditarNombreVisible(false);
  }

  function elegirOrigenFotoPerfil() {
    Alert.alert('Foto de perfil', '¿Cómo querés agregarla?', [
      { text: 'Tomar foto', onPress: () => elegirFotoPerfil('camara') },
      { text: 'Elegir de galería', onPress: () => elegirFotoPerfil('galeria') },
      { text: 'Cancelar', style: 'cancel' },
    ]);
  }

  async function elegirFotoPerfil(origen) {
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
    if (resultado.canceled) return;
    try {
      await uploadProfilePhoto(userId, resultado.assets[0].uri);
      const url = await getSignedProfilePhotoUrl(userId);
      setFotoPerfilUrl(url);
    } catch (e) {
      console.error('Error al subir foto de perfil:', e.message, e);
      Alert.alert('Error', 'No se pudo subir la foto, intentá de nuevo.');
    }
  }

  if (loading) {
    return (
      <View style={styles.center}>
        <Text style={styles.cargando}>Cargando...</Text>
      </View>
    );
  }

  const [horas, minutos] = hora.split(':').map(Number);
  const valorPicker = new Date();
  valorPicker.setHours(horas, minutos, 0, 0);

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ padding: 22 }}>
      <View style={styles.encabezado}>
        <Pressable onPress={elegirOrigenFotoPerfil}>
          {fotoPerfilUrl ? (
            <Image source={{ uri: fotoPerfilUrl }} style={styles.fotoPerfil} />
          ) : (
            <View style={[styles.fotoPerfil, styles.fotoPerfilPlaceholder]}>
              <Text style={styles.fotoPerfilInicial}>{(nombre || '?').charAt(0).toUpperCase()}</Text>
            </View>
          )}
        </Pressable>
        <Pressable onPress={() => setEditarNombreVisible(true)}>
          <Text style={styles.nombre}>{nombre || 'Poné tu nombre'} ✏️</Text>
        </Pressable>
        {miembroDesde && <Text style={styles.miembroDesde}>Miembro desde {formatFechaLarga(miembroDesde)}</Text>}
      </View>

      <View style={styles.statsGrid}>
        <View style={styles.statCaja}>
          <Text style={[styles.statNumero, { color: getRachaColor(rachaActual) }]}>🔥 {rachaActual}</Text>
          <Text style={styles.statLabel}>Racha actual</Text>
        </View>
        <View style={styles.statCaja}>
          <Text style={styles.statNumero}>🏆 {rachaMaxima}</Text>
          <Text style={styles.statLabel}>Racha máxima</Text>
        </View>
        <View style={styles.statCaja}>
          <Text style={styles.statNumero}>⚖️ {pesoActual ?? '--'}</Text>
          <Text style={styles.statLabel}>Peso actual</Text>
        </View>
        {objetivoActivo && (
          <View style={styles.statCaja}>
            <Text style={styles.statNumero}>🎯 {progresoObjetivo}%</Text>
            <Text style={styles.statLabel}>Objetivo</Text>
          </View>
        )}
      </View>

      {sparklineValores.length >= 2 && (
        <View style={styles.sparklineCaja}>
          <Text style={styles.sparklineTitulo}>Tendencia de peso</Text>
          <MiniSparkline valores={sparklineValores} ancho={ANCHO_SPARKLINE} alto={40} />
        </View>
      )}

      <Text style={styles.subtitulo}>Logros</Text>
      {logros.length === 0 && <Text style={styles.sinDatos}>Todavía no desbloqueaste ningún logro.</Text>}
      <View style={styles.logrosGrid}>
        {logros.map((logro) => (
          <View key={logro.key} style={styles.logroChip}>
            <Text style={styles.logroEmoji}>{logro.emoji}</Text>
            <Text style={styles.logroLabel}>{logro.label}</Text>
          </View>
        ))}
      </View>

      <Text style={styles.subtitulo}>Totales</Text>
      <View style={styles.totalesFila}>
        <View style={styles.totalCaja}>
          <Text style={styles.totalNumero}>{totalEntrenamientos}</Text>
          <Text style={styles.totalLabel}>Entrenamientos</Text>
        </View>
        <View style={styles.totalCaja}>
          <Text style={styles.totalNumero}>{volumenTotal}kg</Text>
          <Text style={styles.totalLabel}>Volumen total</Text>
        </View>
      </View>

      <Text style={styles.subtitulo}>Fotos recientes</Text>
      {fotosRecientes.length === 0 ? (
        <Text style={styles.sinDatos}>Todavía no subiste ninguna foto de check-in.</Text>
      ) : (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.galeriaFila}>
          {fotosRecientes.map((checkin) => (
            <FotoCheckin key={checkin.id} checkin={checkin} onSeleccionar={setFotoSeleccionada} />
          ))}
        </ScrollView>
      )}

      <View style={styles.nubeFila}>
        <Text style={styles.nubeTexto}>☁️ Todo respaldado en la nube</Text>
      </View>

      <Text style={styles.subtitulo}>Configuración</Text>
      <View style={styles.fila}>
        <Text style={styles.filaTexto}>Notificaciones</Text>
        <Switch
          value={notificacionesActivadas}
          onValueChange={alCambiarNotificaciones}
          trackColor={{ true: colors.cobalto }}
        />
      </View>
      {notificacionesActivadas && (
        <View style={styles.fila}>
          <Text style={styles.filaTexto}>Recordatorio</Text>
          <DateTimePicker
            value={valorPicker}
            mode="time"
            display={Platform.OS === 'ios' ? 'compact' : 'default'}
            themeVariant="dark"
            onChange={alCambiarHora}
          />
        </View>
      )}
      <Pressable style={styles.signOutButton} onPress={() => supabase.auth.signOut()}>
        <Text style={styles.signOutText}>Cerrar sesión</Text>
      </Pressable>

      <EditarNombreModal
        visible={editarNombreVisible}
        nombreActual={nombre}
        onGuardar={handleGuardarNombre}
        onClose={() => setEditarNombreVisible(false)}
      />
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
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.background },
  cargando: { fontFamily: 'Inter_400Regular', color: colors.textSecondary },
  encabezado: { alignItems: 'center', marginBottom: 24 },
  fotoPerfil: { width: 96, height: 96, borderRadius: 48, marginBottom: 12, backgroundColor: colors.surface },
  fotoPerfilPlaceholder: { alignItems: 'center', justifyContent: 'center' },
  fotoPerfilInicial: { fontFamily: 'SpaceGrotesk_700Bold', fontSize: 36, color: colors.textPrimary },
  nombre: { fontFamily: 'SpaceGrotesk_700Bold', fontSize: 22, color: colors.textPrimary, marginBottom: 4 },
  miembroDesde: { fontFamily: 'Inter_400Regular', fontSize: 13, color: colors.textTertiary },
  statsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 20 },
  statCaja: {
    flexBasis: '47%',
    flexGrow: 1,
    backgroundColor: colors.surface,
    borderRadius: 16,
    padding: 14,
    alignItems: 'center',
  },
  statNumero: { fontFamily: 'SpaceGrotesk_700Bold', fontSize: 20, color: colors.textPrimary },
  statLabel: { fontFamily: 'Inter_400Regular', fontSize: 12, color: colors.textTertiary, marginTop: 4 },
  sparklineCaja: {
    backgroundColor: colors.surface,
    borderRadius: 16,
    padding: 14,
    marginBottom: 20,
    alignItems: 'center',
  },
  sparklineTitulo: { fontFamily: 'Inter_500Medium', fontSize: 13, color: colors.textSecondary, marginBottom: 8 },
  subtitulo: {
    fontFamily: 'SpaceGrotesk_600SemiBold',
    fontSize: 18,
    color: colors.textPrimary,
    marginBottom: 10,
    marginTop: 4,
  },
  sinDatos: { fontFamily: 'Inter_400Regular', color: colors.textTertiary, marginBottom: 16 },
  logrosGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 20 },
  logroChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: 12,
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  logroEmoji: { fontSize: 16, marginRight: 6 },
  logroLabel: { fontFamily: 'Inter_500Medium', fontSize: 12, color: colors.textPrimary },
  totalesFila: { flexDirection: 'row', gap: 10, marginBottom: 20 },
  totalCaja: { flex: 1, backgroundColor: colors.surface, borderRadius: 16, padding: 14, alignItems: 'center' },
  totalNumero: { fontFamily: 'SpaceGrotesk_700Bold', fontSize: 20, color: colors.textPrimary },
  totalLabel: { fontFamily: 'Inter_400Regular', fontSize: 12, color: colors.textTertiary, marginTop: 4 },
  galeriaFila: { marginBottom: 20 },
  miniatura: { marginRight: 10 },
  miniaturaImagen: { width: 72, height: 96, borderRadius: 14, backgroundColor: colors.surface },
  nubeFila: { alignItems: 'center', marginBottom: 24 },
  nubeTexto: { fontFamily: 'Inter_400Regular', fontSize: 12, color: colors.textTertiary },
  fila: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderRadius: 14,
    backgroundColor: colors.surface,
    marginBottom: 16,
  },
  filaTexto: { fontFamily: 'Inter_500Medium', color: colors.textPrimary, fontSize: 15 },
  signOutButton: { paddingVertical: 12, alignItems: 'center', borderRadius: 20, backgroundColor: colors.racha.rojo },
  signOutText: { fontFamily: 'Inter_600SemiBold', color: '#fff', fontSize: 15 },
});
