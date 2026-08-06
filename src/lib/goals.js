import { supabase } from './supabase';

function formatDate(d) {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export async function getGoal(userId) {
  const { data, error } = await supabase
    .from('goals')
    .select('id, type, target_value, target_date, start_value, start_date')
    .eq('user_id', userId)
    .maybeSingle();
  if (error) throw error;
  return data;
}

export async function upsertGoal(userId, { type, targetValue, targetDate, startValue, startDate }) {
  const { data, error } = await supabase
    .from('goals')
    .upsert(
      {
        user_id: userId,
        type,
        target_value: targetValue,
        target_date: targetDate ? formatDate(targetDate) : null,
        start_value: startValue,
        start_date: formatDate(startDate),
      },
      { onConflict: 'user_id' }
    )
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function deleteGoal(userId) {
  const { error } = await supabase.from('goals').delete().eq('user_id', userId);
  if (error) throw error;
}
