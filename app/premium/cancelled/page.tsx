import { redirect } from 'next/navigation'

export default function PremiumCancelledPage() {
  redirect('/?intent=premium&checkout=cancelled#pricing')
}
