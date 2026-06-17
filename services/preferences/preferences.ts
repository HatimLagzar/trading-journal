import { supabase } from '@/lib/supabase/client';
import { DEFAULT_BREAK_EVEN_R_THRESHOLD } from '@/lib/trade-outcome';
import type { UserPreferences, UserPreferencesUpdate } from './types';

export async function getUserPreferences(userId: string): Promise<UserPreferences> {
  const { data, error } = await supabase
    .from('user_preferences')
    .select('*')
    .eq('user_id', userId)
    .maybeSingle();

  if (error) throw error;

  if (data) {
    return data as UserPreferences;
  }

  const { data: created, error: createError } = await supabase
    .from('user_preferences')
    .insert({
      user_id: userId,
      break_even_r_threshold: DEFAULT_BREAK_EVEN_R_THRESHOLD,
    })
    .select('*')
    .single();

  if (createError) throw createError;
  return created as UserPreferences;
}

export async function updateUserPreferences(
  userId: string,
  updates: UserPreferencesUpdate,
): Promise<UserPreferences> {
  await getUserPreferences(userId);

  const { data, error } = await supabase
    .from('user_preferences')
    .update(updates)
    .eq('user_id', userId)
    .select('*')
    .single();

  if (error) throw error;
  return data as UserPreferences;
}
