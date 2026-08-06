import { useEffect, useState } from 'react';
import { View, Text, Image, Pressable, ScrollView, StyleSheet } from 'react-native';
import { getSignedBodyPhotoUrl } from '../lib/bodyLogs';
import { colors } from '../theme/colors';

export default function FotosRecientes({ logs, onSeleccionar }) {
  const [urls, setUrls] = useState({});

  useEffect(() => {
    logs.forEach((log) => {
      if (!urls[log.photo_path]) {
        getSignedBodyPhotoUrl(log.photo_path).then((url) => {
          setUrls((anteriores) => ({ ...anteriores, [log.photo_path]: url }));
        });
      }
    });
  }, [logs]);

  if (logs.length === 0) {
    return (
      <View style={styles.vacio}>
        <Text style={styles.vacioTexto}>Tus fotos de progreso van a aparecer acá</Text>
      </View>
    );
  }

  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.fila}>
      {logs.map((log) => (
        <Pressable
          key={log.id}
          style={styles.miniatura}
          onPress={() => onSeleccionar(log.photo_path)}
        >
          {urls[log.photo_path] ? (
            <Image source={{ uri: urls[log.photo_path] }} style={styles.imagen} resizeMode="cover" />
          ) : (
            <View style={styles.imagen} />
          )}
          <Text style={styles.fecha}>{log.date.slice(5)}</Text>
        </Pressable>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  fila: { marginBottom: 4 },
  miniatura: { marginRight: 10, alignItems: 'center' },
  imagen: { width: 72, height: 96, borderRadius: 14, backgroundColor: colors.surface },
  fecha: { fontFamily: 'Inter_400Regular', color: colors.textTertiary, fontSize: 11, marginTop: 4 },
  vacio: {
    height: 96,
    borderRadius: 14,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  vacioTexto: { fontFamily: 'Inter_400Regular', color: colors.textTertiary, fontSize: 12 },
});
