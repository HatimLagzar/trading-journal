export type SubscriptionPlan = 'free' | 'premium_monthly' | 'premium_annual';

export type SubscriptionStatus = 'inactive' | 'active' | 'trialing' | 'past_due' | 'canceled' | 'unpaid';

export type BillingProvider = 'none' | 'stripe' | 'nowpayments';

export type UserSubscription = {
  user_id: string;
  billing_provider: BillingProvider;
  stripe_customer_id: string | null;
  stripe_subscription_id: string | null;
  plan: SubscriptionPlan;
  status: SubscriptionStatus;
  current_period_end: string | null;
  cancel_at_period_end: boolean;
  created_at: string;
  updated_at: string;
};

export type UserSubscriptionUpsert = {
  user_id: string;
  billing_provider?: BillingProvider;
  stripe_customer_id?: string | null;
  stripe_subscription_id?: string | null;
  plan?: SubscriptionPlan;
  status?: SubscriptionStatus;
  current_period_end?: string | null;
  cancel_at_period_end?: boolean;
};

export type CheckoutPlan = 'monthly' | 'annual';
