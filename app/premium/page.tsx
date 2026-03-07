import PremiumClient from './PremiumClient';

type PremiumPageProps = {
  searchParams: Promise<{
    checkout?: string;
    feature?: string;
  }>;
};

export default async function PremiumPage({ searchParams }: PremiumPageProps) {
  const params = await searchParams;
  const monthlyPriceUsd = parseUsd(process.env.STRIPE_PREMIUM_MONTHLY_PRICE_USD, 5);
  const annualPriceUsd = parseUsd(process.env.STRIPE_PREMIUM_ANNUAL_PRICE_USD, 50);

  return (
    <PremiumClient
      checkoutState={params.checkout ?? null}
      requestedFeature={params.feature ?? null}
      monthlyPriceUsd={monthlyPriceUsd}
      annualPriceUsd={annualPriceUsd}
    />
  );
}

function parseUsd(value: string | undefined, fallback: number): number {
  if (!value) return fallback;

  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return fallback;
  }

  return parsed;
}
