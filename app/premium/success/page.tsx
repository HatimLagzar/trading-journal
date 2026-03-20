import { redirect } from 'next/navigation'

export default function PremiumSuccessPage() {
  redirect('/?intent=premium&checkout=success#pricing')
}
