'use client'

import { useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { usePremiumState } from '@/lib/PremiumContext';

export function usePremiumAccess() {
  const router = useRouter();
  const { loading, isPremium, subscription, refreshPremiumStatus } = usePremiumState();

  const redirectToPremium = useCallback((feature?: string) => {
    const suffix = feature ? `?feature=${encodeURIComponent(feature)}` : '';
    router.push(`/premium${suffix}`);
  }, [router]);

  return {
    loading,
    isPremium,
    subscription,
    refreshPremiumStatus,
    redirectToPremium,
  };
}
