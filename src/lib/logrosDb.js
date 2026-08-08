import * as FileSystem from 'expo-file-system/legacy';
import { decode } from 'base64-arraybuffer';
import { supabase } from './supabase';
import { calcularLogrosDesbloqueados, LOGROS } from './logros';

const BUCKET = 'profile_photos';

export async function getLogrosGuardados(userId) {
  const { data, error } = await supabase
    .from('unlocked_logros')
    .select('logro_key, unlocked_at')
    .eq('user_id', userId)
    .order('unlocked_at', { ascending: true });
  if (error) throw error;
  return data;
}

export async function guardarLogroNuevo(userId, logroKey) {
  const { error } = await supabase.from('unlocked_logros').insert({ user_id: userId, logro_key: logroKey });
  if (error) throw error;
}

export async function sincronizarLogros(userId, stats) {
  const elegibles = calcularLogrosDesbloqueados(stats);
  const guardados = await getLogrosGuardados(userId);
  const filas = [...guardados];

  for (const logro of elegibles) {
    if (!filas.some((f) => f.logro_key === logro.key)) {
      await guardarLogroNuevo(userId, logro.key);
      filas.push({ logro_key: logro.key, unlocked_at: new Date().toISOString() });
    }
  }

  return filas
    .map((fila) => {
      const logro = LOGROS.find((l) => l.key === fila.logro_key);
      return logro ? { ...logro, unlockedAt: fila.unlocked_at } : null;
    })
    .filter(Boolean)
    .sort((a, b) => new Date(a.unlockedAt) - new Date(b.unlockedAt));
}

export function getProfilePhotoPath(userId) {
  return `${userId}/foto.jpg`;
}

export async function uploadProfilePhoto(userId, photoUri) {
  const photoPath = getProfilePhotoPath(userId);
  const base64 = await FileSystem.readAsStringAsync(photoUri, {
    encoding: FileSystem.EncodingType.Base64,
  });
  const { error } = await supabase.storage
    .from(BUCKET)
    .upload(photoPath, decode(base64), { contentType: 'image/jpeg', upsert: true });
  if (error) throw error;
}

export async function getSignedProfilePhotoUrl(userId) {
  const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(getProfilePhotoPath(userId), 60);
  if (error) throw error;
  return data.signedUrl;
}
