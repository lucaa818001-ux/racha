import * as Notifications from 'expo-notifications';
import AsyncStorage from '@react-native-async-storage/async-storage';

const CLAVE_HORA = 'hora_recordatorio';
const HORA_DEFAULT = '20:00';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldPlaySound: false,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

function formatDate(d) {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export async function getHoraRecordatorio() {
  const guardada = await AsyncStorage.getItem(CLAVE_HORA);
  return guardada || HORA_DEFAULT;
}

export async function setHoraRecordatorio(hora) {
  await AsyncStorage.setItem(CLAVE_HORA, hora);
}

export async function sincronizarRecordatorios(checkins) {
  await Notifications.cancelAllScheduledNotificationsAsync();

  let permiso = await Notifications.getPermissionsAsync();
  if (permiso.status !== 'granted') {
    permiso = await Notifications.requestPermissionsAsync();
    if (permiso.status !== 'granted') return;
  }

  const hora = await getHoraRecordatorio();
  const [horas, minutos] = hora.split(':').map(Number);
  const fechasConCheckin = new Set(checkins.map((c) => c.date));

  for (let i = 0; i < 7; i++) {
    const dia = new Date();
    dia.setDate(dia.getDate() + i);
    const fechaStr = formatDate(dia);
    if (fechasConCheckin.has(fechaStr)) continue;

    const disparo = new Date(dia);
    disparo.setHours(horas, minutos, 0, 0);
    if (disparo.getTime() <= Date.now()) continue;

    await Notifications.scheduleNotificationAsync({
      content: {
        title: 'Racha',
        body: 'Todavía no marcaste el gimnasio hoy 🔥',
      },
      trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: disparo },
    });
  }
}
