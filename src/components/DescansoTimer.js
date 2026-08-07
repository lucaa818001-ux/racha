import { useEffect, useRef, useState } from 'react';
import { View, Text, Pressable, StyleSheet, Vibration } from 'react-native';
import * as Notifications from 'expo-notifications';
import { colors } from '../theme/colors';

function programarNotificacion(finEn, notificationIdRef) {
  Notifications.getPermissionsAsync()
    .then((permiso) => (permiso.status === 'granted' ? permiso : Notifications.requestPermissionsAsync()))
    .then((permiso) => {
      if (permiso.status !== 'granted') return;
      return Notifications.scheduleNotificationAsync({
        content: { title: 'Descanso terminado', body: 'Volvé a la próxima serie 💪', sound: 'default' },
        trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: new Date(finEn) },
      });
    })
    .then((id) => {
      if (id) notificationIdRef.current = id;
    });
}

function cancelarNotificacion(notificationIdRef) {
  if (notificationIdRef.current) {
    Notifications.cancelScheduledNotificationAsync(notificationIdRef.current);
    notificationIdRef.current = null;
  }
}

export default function DescansoTimer({ segundos, onFinalizar }) {
  const [restante, setRestante] = useState(segundos);
  const notificationIdRef = useRef(null);
  const finEnRef = useRef(Date.now() + segundos * 1000);

  useEffect(() => {
    finEnRef.current = Date.now() + segundos * 1000;
    setRestante(segundos);
    programarNotificacion(finEnRef.current, notificationIdRef);

    const intervalo = setInterval(() => {
      const quedan = Math.max(0, Math.round((finEnRef.current - Date.now()) / 1000));
      setRestante(quedan);
      if (quedan <= 0) {
        clearInterval(intervalo);
        Vibration.vibrate();
        onFinalizar();
      }
    }, 1000);

    return () => {
      clearInterval(intervalo);
      cancelarNotificacion(notificationIdRef);
    };
  }, [segundos]);

  function ajustar(delta) {
    finEnRef.current += delta * 1000;
    setRestante((actual) => Math.max(0, actual + delta));
    cancelarNotificacion(notificationIdRef);
    programarNotificacion(finEnRef.current, notificationIdRef);
  }

  function saltar() {
    cancelarNotificacion(notificationIdRef);
    onFinalizar();
  }

  const minutos = Math.floor(restante / 60);
  const segs = restante % 60;
  const texto = `${String(minutos).padStart(2, '0')}:${String(segs).padStart(2, '0')}`;

  return (
    <View style={styles.contenedor}>
      <Pressable onPress={() => ajustar(-15)} hitSlop={8}>
        <Text style={styles.ajusteTexto}>-15s</Text>
      </Pressable>
      <Text style={styles.texto}>⏱ {texto}</Text>
      <Pressable onPress={() => ajustar(15)} hitSlop={8}>
        <Text style={styles.ajusteTexto}>+15s</Text>
      </Pressable>
      <Pressable onPress={saltar} hitSlop={8}>
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
  ajusteTexto: { fontFamily: 'Inter_600SemiBold', color: '#fff', fontSize: 13, opacity: 0.85 },
  saltar: { fontFamily: 'Inter_600SemiBold', color: '#fff', fontSize: 14, textDecorationLine: 'underline' },
});
