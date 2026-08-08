import { supabase } from './supabase';

function formatDate(d) {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export async function startWorkout(userId, folderId) {
  const { data, error } = await supabase
    .from('workouts')
    .insert({ user_id: userId, folder_id: folderId })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function finishWorkout(workoutId) {
  const { error } = await supabase
    .from('workouts')
    .update({ ended_at: new Date().toISOString() })
    .eq('id', workoutId);
  if (error) throw error;
}

export async function cancelWorkout(workoutId) {
  const { error } = await supabase.from('workouts').delete().eq('id', workoutId);
  if (error) throw error;
}

export async function getActiveWorkout(userId) {
  const { data, error } = await supabase
    .from('workouts')
    .select('id, folder_id, started_at, ended_at')
    .eq('user_id', userId)
    .is('ended_at', null)
    .order('started_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return data;
}

export async function getRecentWorkouts(userId, limite) {
  const { data, error } = await supabase
    .from('workouts')
    .select('id, started_at, ended_at, exercise_logs(sets, exercises(name, type))')
    .eq('user_id', userId)
    .not('ended_at', 'is', null)
    .order('started_at', { ascending: false })
    .limit(limite);
  if (error) throw error;
  return data;
}

export async function getAllFinishedWorkouts(userId) {
  const { data, error } = await supabase
    .from('workouts')
    .select('id, started_at, ended_at, exercise_logs(sets, exercises(name, type))')
    .eq('user_id', userId)
    .not('ended_at', 'is', null)
    .order('started_at', { ascending: false });
  if (error) throw error;
  return data;
}

export async function upsertWorkoutExerciseLog(workoutId, exerciseId, userId, { date, sets }) {
  const { data, error } = await supabase
    .from('exercise_logs')
    .upsert(
      { workout_id: workoutId, exercise_id: exerciseId, user_id: userId, date: formatDate(date), sets },
      { onConflict: 'workout_id,exercise_id' }
    )
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function getWorkoutExerciseLogs(workoutId) {
  const { data, error } = await supabase
    .from('exercise_logs')
    .select('id, sets, exercises(id, name, muscle_group, type, rest_seconds, photo_path)')
    .eq('workout_id', workoutId)
    .order('created_at', { ascending: true });
  if (error) throw error;
  return data;
}
