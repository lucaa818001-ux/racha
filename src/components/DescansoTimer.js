import { useEffect, useRef, useState } from 'react';
import { View, Text, Pressable, StyleSheet, Vibration } from 'react-native';
import * as Notifications from 'expo-notifications';
import { colors } from '../theme/colors';

export default function DescansoTimer({ segundos, onFinalizar }) {
  const [restante, setRestante] = useState(segundos);
  const notificationIdRef = useRef(null);

  useEffect(() => {
    setRestante(segundos);
    const finEn = Date.now() + segundos * 1000;

    async function programarAviso() {
      let permiso = await Notifications.getPermissionsAsync();
      if (permiso.status !== 'granted') {
        permiso = await Notifications.requestPermissionsAsync();
        if (permiso.status !== 'granted') return;
      }
      const disparo = new Date(finEn);
      const id = await Notifications.scheduleNotificationAsync({
        content: { title: 'Descanso terminado', body: 'Volvé a la próxima serie 💪', sound: 'default' },
        trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: disparo },
      });
      notificationIdRef.current = id;
    }
    programarAviso();

    const intervalo = setInterval(() => {
      const quedan = Math.max(0, Math.round((finEn - Date.now()) / 1000));
      setRestante(quedan);
      if (quedan <= 0) {
        clearInterval(intervalo);
        Vibration.vibrate();
        onFinalizar();
      }
    }, 1000);

    return () => {
      clearInterval(intervalo);
      if (notificationIdRef.current) {
        Notifications.cancelScheduledNotificationAsync(notificationIdRef.current);
        notificationIdRef.current = null;
      }
    };
  }, [segundos]);

  function saltar() {
    if (notificationIdRef.current) {
      Notifications.cancelScheduledNotificationAsync(notificationIdRef.current);
      notificationIdRef.current = null;
    }
    onFinalizar();
  }

  const minutos = Math.floor(restante / 60);
  const segs = restante % 60;
  const texto = `${String(minutos).padStart(2, '0')}:${String(segs).padStart(2, '0')}`;

  return (
    <View style={styles.contenedor}>
      <Text style={styles.texto}>⏱ Descanso: {texto}</Text>
      <Pressable onPress={saltar}>
        <Text style={styles.saltar}>Saltar</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  contenedor: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.cobalto,
    borderRadius: 16,
    padding: 14,
    marginBottom: 12,
  },
  texto: { fontFamily: 'Inter_600SemiBold', color: '#fff', fontSize: 15 },
  saltar: { fontFamily: 'Inter_600SemiBold', color: '#fff', fontSize: 14, textDecorationLine: 'underline' },
});
