import { supabase } from './supabase';
import { calcularRachaActual } from './rachaCalculo';

const BUCKET = 'checkins';

function formatDate(d) {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export async function getCheckinsForRange(userId, fromDate, toDate) {
  const { data, error } = await supabase
    .from('gym_checkins')
    .select('id, date, photo_path, racha_dia')
    .eq('user_id', userId)
    .gte('date', formatDate(fromDate))
    .lte('date', formatDate(toDate))
    .order('date', { ascending: true });
  if (error) throw error;
  return data;
}

export async function getTodayCheckin(userId) {
  const hoy = formatDate(new Date());
  const { data, error } = await supabase
    .from('gym_checkins')
    .select('id, date, photo_path, racha_dia')
    .eq('user_id', userId)
    .eq('date', hoy)
    .maybeSingle();
  if (error) throw error;
  return data;
}

export async function createCheckin(userId, photoUri) {
  const hoy = formatDate(new Date());
  const desde = new Date();
  desde.setDate(desde.getDate() - 60);
  const recientes = await getCheckinsForRange(userId, desde, new Date());
  const rachaDia = calcularRachaActual(recientes.map((c) => c.date)) + 1;

  const photoPath = `${userId}/${hoy}.jpg`;
  const response = await fetch(photoUri);
  const blob = await response.blob();
  const { error: uploadError } = await supabase.storage
    .from(BUCKET)
    .upload(photoPath, blob, { contentType: 'image/jpeg', upsert: true });
  if (uploadError) throw uploadError;

  const { data, error } = await supabase
    .from('gym_checkins')
    .insert({ user_id: userId, date: hoy, photo_path: photoPath, racha_dia: rachaDia })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function getSignedPhotoUrl(photoPath) {
  const { data, error } = await supabase.storage
    .from(BUCKET)
    .createSignedUrl(photoPath, 60);
  if (error) throw error;
  return data.signedUrl;
}
