import { supabase } from '@/lib/supabase/client';
import { isPremiumSubscription } from '@/lib/subscription';
import type { UserSubscription } from './types';

export async function getUserSubscription(userId: string): Promise<UserSubscription | null> {
  const { data, error } = await supabase
    .from('user_subscriptions')
    .select('*')
    .eq('user_id', userId)
    .maybeSingle();

  if (error) throw error;
  return data;
}

export function isSubscriptionPremium(subscription: UserSubscription | null): boolean {
  return isPremiumSubscription(subscription);
}
