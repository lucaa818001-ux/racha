import * as FileSystem from 'expo-file-system/legacy';
import { decode } from 'base64-arraybuffer';
import { supabase } from './supabase';

const BUCKET = 'exercise_photos';

function formatDate(d) {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export async function getFolders(userId) {
  const { data: folders, error } = await supabase
    .from('exercise_folders')
    .select('id, name')
    .eq('user_id', userId)
    .order('created_at', { ascending: true });
  if (error) throw error;

  const { data: items, error: itemsError } = await supabase
    .from('exercise_folder_items')
    .select('folder_id, exercises!inner(user_id)')
    .eq('exercises.user_id', userId);
  if (itemsError) throw itemsError;

  const conteo = {};
  items.forEach((item) => {
    conteo[item.folder_id] = (conteo[item.folder_id] || 0) + 1;
  });

  return folders.map((f) => ({ ...f, cantidadEjercicios: conteo[f.id] || 0 }));
}

export async function createFolder(userId, name) {
  const { data, error } = await supabase
    .from('exercise_folders')
    .insert({ user_id: userId, name })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function deleteFolder(folderId) {
  const { error } = await supabase.from('exercise_folders').delete().eq('id', folderId);
  if (error) throw error;
}

export async function getExercises(userId, folderId) {
  if (folderId === null) {
    const { data, error } = await supabase
      .from('exercises')
      .select('id, name, muscle_group, type, rest_seconds, photo_path')
      .eq('user_id', userId)
      .order('created_at', { ascending: true });
    if (error) throw error;
    return data;
  }

  const { data, error } = await supabase
    .from('exercise_folder_items')
    .select(
      'orden, target_sets, target_reps, target_duration_seg, exercises!inner(id, name, muscle_group, type, rest_seconds, photo_path, user_id)'
    )
    .eq('folder_id', folderId)
    .eq('exercises.user_id', userId)
    .order('orden', { ascending: true, nullsFirst: false });
  if (error) throw error;

  return data.map((item) => ({
    ...item.exercises,
    orden: item.orden,
    target_sets: item.target_sets,
    target_reps: item.target_reps,
    target_duration_seg: item.target_duration_seg,
  }));
}

export async function createExercise(userId, { name, muscleGroup, type, restSeconds, photoUri, folderIds }) {
  let photoPath = null;
  if (photoUri) {
    photoPath = `${userId}/${Date.now()}.jpg`;
    const base64 = await FileSystem.readAsStringAsync(photoUri, {
      encoding: FileSystem.EncodingType.Base64,
    });
    const { error: uploadError } = await supabase.storage
      .from(BUCKET)
      .upload(photoPath, decode(base64), { contentType: 'image/jpeg', upsert: true });
    if (uploadError) throw uploadError;
  }

  const { data, error } = await supabase
    .from('exercises')
    .insert({
      user_id: userId,
      name,
      muscle_group: muscleGroup,
      type,
      rest_seconds: restSeconds || null,
      photo_path: photoPath,
    })
    .select()
    .single();
  if (error) throw error;

  if (folderIds && folderIds.length > 0) {
    const filas = folderIds.map((folderId) => ({ exercise_id: data.id, folder_id: folderId }));
    const { error: folderError } = await supabase.from('exercise_folder_items').insert(filas);
    if (folderError) throw folderError;
  }

  return data;
}

export async function deleteExercise(exerciseId, photoPath) {
  if (photoPath) {
    await supabase.storage.from(BUCKET).remove([photoPath]);
  }
  const { error } = await supabase.from('exercises').delete().eq('id', exerciseId);
  if (error) throw error;
}

export async function updateFolderItem(exerciseId, folderId, { orden, targetSets, targetReps, targetDurationSeg }) {
  const { error } = await supabase
    .from('exercise_folder_items')
    .update({
      orden: orden ?? null,
      target_sets: targetSets ?? null,
      target_reps: targetReps ?? null,
      target_duration_seg: targetDurationSeg ?? null,
    })
    .eq('exercise_id', exerciseId)
    .eq('folder_id', folderId);
  if (error) throw error;
}

export async function getExerciseLogs(exerciseId) {
  const { data, error } = await supabase
    .from('exercise_logs')
    .select('id, date, sets')
    .eq('exercise_id', exerciseId)
    .order('date', { ascending: true });
  if (error) throw error;
  return data;
}

export async function createExerciseLog(exerciseId, userId, { date, sets }) {
  const { data, error } = await supabase
    .from('exercise_logs')
    .insert({ exercise_id: exerciseId, user_id: userId, date: formatDate(date), sets })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function getSignedExercisePhotoUrl(photoPath) {
  const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(photoPath, 60);
  if (error) throw error;
  return data.signedUrl;
}
