'use client'

import { useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { usePremiumState } from '@/lib/PremiumContext';

export function usePremiumAccess() {
  const router = useRouter();
  const { loading, isPremium, subscription, refreshPremiumStatus } = usePremiumState();

  const redirectToPremium = useCallback((feature?: string) => {
    const params = new URLSearchParams({ intent: 'premium' });
    if (feature) {
      params.set('feature', feature);
    }
    router.push(`/?${params.toString()}#pricing`);
  }, [router]);

  return {
    loading,
    isPremium,
    subscription,
    refreshPremiumStatus,
    redirectToPremium,
  };
}
