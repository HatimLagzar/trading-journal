'use client'

import { useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'

export default function TradeFocusRedirectPage() {
  const router = useRouter()
  const params = useParams<{ tradeId: string }>()
  const tradeId = params.tradeId

  useEffect(() => {
    if (!tradeId) {
      router.replace('/trades')
      return
    }

    router.replace(`/trades?decisions=${tradeId}`)
  }, [router, tradeId])

  return (
    <div className="app-theme flex min-h-screen items-center justify-center p-8 text-slate-500">
      Opening decisions...
    </div>
  )
}
