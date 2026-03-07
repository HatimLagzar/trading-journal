import type { SubscriptionPlan, SubscriptionStatus } from '@/services/subscription';

type SubscriptionLike = {
  plan: SubscriptionPlan;
  status: SubscriptionStatus;
  current_period_end: string | null;
};

export function isPremiumSubscription(subscription: SubscriptionLike | null): boolean {
  if (!subscription) return false;

  const activeStatus = subscription.status === 'active' || subscription.status === 'trialing';
  if (!activeStatus) return false;

  const paidPlan = subscription.plan === 'premium_monthly' || subscription.plan === 'premium_annual';
  if (!paidPlan) return false;

  if (!subscription.current_period_end) return true;
  return new Date(subscription.current_period_end).getTime() > Date.now();
}
