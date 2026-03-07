'use client'

import { useEffect, useState } from 'react';
import { useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/AuthContext';
import type { UserSubscription } from '@/services/subscription';

type PremiumStatusResponse = {
  isPremium: boolean;
  subscription: UserSubscription | null;
};

export function usePremiumAccess() {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const [loading, setLoading] = useState(true);
  const [isPremium, setIsPremium] = useState(false);
  const [subscription, setSubscription] = useState<UserSubscription | null>(null);

  useEffect(() => {
    if (authLoading) return;

    if (!user) {
      setLoading(false);
      setIsPremium(false);
      setSubscription(null);
      return;
    }

    let isCancelled = false;

    async function loadStatus() {
      setLoading(true);
      try {
        const response = await fetch('/api/subscription/status', {
          method: 'GET',
          cache: 'no-store',
        });

        if (!response.ok) {
          throw new Error('Failed to fetch premium status');
        }

        const payload = (await response.json()) as PremiumStatusResponse;
        if (isCancelled) return;

        setIsPremium(payload.isPremium);
        setSubscription(payload.subscription);
      } catch {
        if (isCancelled) return;
        setIsPremium(false);
        setSubscription(null);
      } finally {
        if (!isCancelled) {
          setLoading(false);
        }
      }
    }

    loadStatus();

    return () => {
      isCancelled = true;
    };
  }, [authLoading, user]);

  const redirectToPremium = useCallback((feature?: string) => {
    const suffix = feature ? `?feature=${encodeURIComponent(feature)}` : '';
    router.push(`/premium${suffix}`);
  }, [router]);

  return {
    loading: authLoading || loading,
    isPremium,
    subscription,
    redirectToPremium,
  };
}
