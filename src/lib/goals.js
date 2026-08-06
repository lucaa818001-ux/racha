import { supabase } from './supabase';

function formatDate(d) {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export async function getActiveGoal(userId) {
  const { data, error } = await supabase
    .from('goals')
    .select('id, type, target_value, target_date, start_value, start_date, status, ended_at')
    .eq('user_id', userId)
    .eq('status', 'activo')
    .maybeSingle();
  if (error) throw error;
  return data;
}

export async function createGoal(userId, { type, targetValue, targetDate, startValue, startDate }) {
  const { data, error } = await supabase
    .from('goals')
    .insert({
      user_id: userId,
      type,
      target_value: targetValue,
      target_date: targetDate ? formatDate(targetDate) : null,
      start_value: startValue,
      start_date: formatDate(startDate),
      status: 'activo',
    })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function cancelGoal(goalId) {
  const { error } = await supabase
    .from('goals')
    .update({ status: 'cancelado', ended_at: formatDate(new Date()) })
    .eq('id', goalId);
  if (error) throw error;
}

export async function completeGoal(goalId) {
  const { error } = await supabase
    .from('goals')
    .update({ status: 'completado', ended_at: formatDate(new Date()) })
    .eq('id', goalId);
  if (error) throw error;
}

export async function getGoalHistory(userId) {
  const { data, error } = await supabase
    .from('goals')
    .select('id, type, target_value, target_date, start_value, start_date, status, ended_at')
    .eq('user_id', userId)
    .in('status', ['completado', 'cancelado'])
    .order('ended_at', { ascending: false });
  if (error) throw error;
  return data;
}
