import { useEffect, useState } from 'react';
import { View, Image, Text, StyleSheet } from 'react-native';
import { getSignedExercisePhotoUrl } from '../lib/exercises';
import { colors } from '../theme/colors';

const EMOJI_POR_GRUPO = {
  pecho: '🎽',
  espalda: '🧍',
  cuadriceps: '🦵',
  isquios_gluteos: '🍑',
  hombros: '🤷',
  biceps: '💪',
  triceps: '🦾',
  core: '🔥',
  cardio: '❤️',
  otro: '🏋️',
};

export default function DiagramaMusculo({ photoPath, muscleGroup, tamano = 64 }) {
  const [url, setUrl] = useState(null);

  useEffect(() => {
    if (!photoPath) {
      setUrl(null);
      return;
    }
    getSignedExercisePhotoUrl(photoPath).then(setUrl).catch(() => setUrl(null));
  }, [photoPath]);

  if (photoPath && url) {
    return (
      <Image
        source={{ uri: url }}
        style={[styles.imagen, { width: tamano, height: tamano }]}
        resizeMode="cover"
      />
    );
  }

  return (
    <View style={[styles.emojiContenedor, { width: tamano, height: tamano }]}>
      <Text style={{ fontSize: tamano * 0.5 }}>{EMOJI_POR_GRUPO[muscleGroup] || '🏋️'}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  imagen: { borderRadius: 12 },
  emojiContenedor: {
    borderRadius: 12,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
