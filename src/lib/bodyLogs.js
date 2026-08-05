import * as FileSystem from 'expo-file-system/legacy';
import { decode } from 'base64-arraybuffer';
import { supabase } from './supabase';

const BUCKET = 'body_photos';

function formatDate(d) {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export async function getBodyLogsForRange(userId, fromDate, toDate) {
  const { data, error } = await supabase
    .from('body_logs')
    .select('id, date, weight, height, photo_path')
    .eq('user_id', userId)
    .gte('date', formatDate(fromDate))
    .lte('date', formatDate(toDate))
    .order('date', { ascending: true });
  if (error) throw error;
  return data;
}

export async function getTodayBodyLog(userId) {
  const hoy = formatDate(new Date());
  const { data, error } = await supabase
    .from('body_logs')
    .select('id, date, weight, height, photo_path')
    .eq('user_id', userId)
    .eq('date', hoy)
    .maybeSingle();
  if (error) throw error;
  return data;
}

export async function createBodyLog(userId, { weight, height, photoUri }) {
  const hoy = formatDate(new Date());
  let photoPath = null;

  if (photoUri) {
    photoPath = `${userId}/${hoy}.jpg`;
    const base64 = await FileSystem.readAsStringAsync(photoUri, {
      encoding: FileSystem.EncodingType.Base64,
    });
    const { error: uploadError } = await supabase.storage
      .from(BUCKET)
      .upload(photoPath, decode(base64), { contentType: 'image/jpeg', upsert: true });
    if (uploadError) throw uploadError;
  }

  const { data, error } = await supabase
    .from('body_logs')
    .insert({ user_id: userId, date: hoy, weight, height, photo_path: photoPath })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function getSignedBodyPhotoUrl(photoPath) {
  const { data, error } = await supabase.storage
    .from(BUCKET)
    .createSignedUrl(photoPath, 60);
  if (error) throw error;
  return data.signedUrl;
}
