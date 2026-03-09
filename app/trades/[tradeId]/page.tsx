'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import type { ChangeEvent, FormEvent } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { Source_Serif_4 } from 'next/font/google'
import { supabase } from '@/lib/supabase/client'
import { usePremiumAccess } from '@/lib/usePremiumAccess'
import AuthNavbar from '@/app/components/AuthNavbar'
import TradeFocusChartSnippet from '@/app/trades/TradeFocusChartSnippet'
import { getSystems } from '@/services/system'
import { createTradeThinkingQuote, getTrade, getTradeThinkingQuotes } from '@/services/trade'
import {
  deleteStoredTradeAsset,
  getScreenshotUrl,
  uploadTradeThinkingQuoteImage,
} from '@/services/upload'
import type { User } from '@supabase/supabase-js'
import type { Trade, TradeThinkingQuote } from '@/services/trade'
import type { System } from '@/services/system'

const thinkingFont = Source_Serif_4({
  subsets: ['latin'],
  weight: ['400', '500', '600'],
})

export default function TradeFocusPage() {
  const router = useRouter()
  const params = useParams<{ tradeId: string }>()
  const tradeId = params.tradeId
  const { isPremium, loading: premiumLoading, redirectToPremium } = usePremiumAccess()

  const [user, setUser] = useState<User | null>(null)
  const [trade, setTrade] = useState<Trade | null>(null)
  const [systems, setSystems] = useState<System[]>([])
  const [quotes, setQuotes] = useState<TradeThinkingQuote[]>([])
  const [quoteImageUrls, setQuoteImageUrls] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(true)
  const [savingQuote, setSavingQuote] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [draftQuote, setDraftQuote] = useState('')
  const [draftImageFile, setDraftImageFile] = useState<File | null>(null)
  const [draftImagePreview, setDraftImagePreview] = useState<string | null>(null)
  const imageInputRef = useRef<HTMLInputElement | null>(null)

  const isTradeOngoing = trade?.avg_exit === null

  useEffect(() => {
    async function loadData() {
      setLoading(true)
      setError(null)

      const { data: { user: currentUser } } = await supabase.auth.getUser()
      if (!currentUser) {
        router.push('/login')
        return
      }

      setUser(currentUser)

      try {
        const [tradeData, systemsData] = await Promise.all([
          getTrade(tradeId),
          getSystems(currentUser.id),
        ])

        setTrade(tradeData)
        setSystems(systemsData)

        const quotesData = await getTradeThinkingQuotes(tradeId)
        setQuotes(quotesData)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load trade focus view')
      } finally {
        setLoading(false)
      }
    }

    if (tradeId) {
      loadData()
    }
  }, [router, tradeId])

  useEffect(() => {
    let isCancelled = false

    async function loadQuoteImages() {
      const quotesWithImages = quotes.filter((quote) => quote.image_storage_path)
      if (quotesWithImages.length === 0) {
        setQuoteImageUrls({})
        return
      }

      try {
        const pairs = await Promise.all(
          quotesWithImages.map(async (quote) => {
            const signedUrl = await getScreenshotUrl(quote.image_storage_path as string)
            return [quote.id, signedUrl] as const
          }),
        )

        if (isCancelled) return
        setQuoteImageUrls(Object.fromEntries(pairs))
      } catch {
        if (!isCancelled) {
          setQuoteImageUrls({})
        }
      }
    }

    loadQuoteImages()

    return () => {
      isCancelled = true
    }
  }, [quotes])

  useEffect(() => {
    return () => {
      if (draftImagePreview) {
        URL.revokeObjectURL(draftImagePreview)
      }
    }
  }, [draftImagePreview])

  useEffect(() => {
    if (!isTradeOngoing) return

    function handlePaste(event: ClipboardEvent) {
      const imageFile = extractFirstImageFromClipboard(event)
      if (!imageFile) return

      event.preventDefault()

      if (!premiumLoading && !isPremium) {
        redirectToPremium('screenshots')
        return
      }

      setDraftImageFile(imageFile)
      setDraftImagePreview((prev) => {
        if (prev) {
          URL.revokeObjectURL(prev)
        }

        return URL.createObjectURL(imageFile)
      })
    }

    window.addEventListener('paste', handlePaste)
    return () => window.removeEventListener('paste', handlePaste)
  }, [isTradeOngoing, isPremium, premiumLoading, redirectToPremium])

  const systemLabel = useMemo(() => {
    if (!trade?.system_id) return '-'
    const system = systems.find((item) => item.id === trade.system_id)
    return system?.name || '-'
  }, [systems, trade?.system_id])

  async function refreshQuotes(currentTradeId: string) {
    const quotesData = await getTradeThinkingQuotes(currentTradeId)
    setQuotes(quotesData)
  }

  function resetQuoteDraft() {
    setDraftQuote('')
    if (draftImagePreview) {
      URL.revokeObjectURL(draftImagePreview)
    }
    setDraftImageFile(null)
    setDraftImagePreview(null)
    if (imageInputRef.current) {
      imageInputRef.current.value = ''
    }
  }

  function setDraftImage(file: File) {
    if (draftImagePreview) {
      URL.revokeObjectURL(draftImagePreview)
    }

    setDraftImageFile(file)
    setDraftImagePreview(URL.createObjectURL(file))
  }

  function handlePickImage(e: ChangeEvent<HTMLInputElement>) {
    const nextFile = e.target.files?.[0]
    if (!nextFile) return

    if (!premiumLoading && !isPremium) {
      redirectToPremium('screenshots')
      if (imageInputRef.current) {
        imageInputRef.current.value = ''
      }
      return
    }

    setDraftImage(nextFile)
  }

  async function handleAddQuote(e: FormEvent) {
    e.preventDefault()

    if (!user || !trade || !isTradeOngoing) return

    const trimmedQuote = draftQuote.trim()
    if (!trimmedQuote && !draftImageFile) {
      setError('Add text or image to post a thought.')
      return
    }

    setSavingQuote(true)
    setError(null)

    let uploadedImage: { storagePath: string; originalFilename: string } | null = null

    try {
      if (draftImageFile) {
        if (!premiumLoading && !isPremium) {
          redirectToPremium('screenshots')
          return
        }

        uploadedImage = await uploadTradeThinkingQuoteImage(user.id, trade.id, draftImageFile)
      }

      await createTradeThinkingQuote({
        trade_id: trade.id,
        user_id: user.id,
        quote_text: trimmedQuote || null,
        image_storage_path: uploadedImage?.storagePath || null,
        image_filename: uploadedImage?.originalFilename || null,
      })

      await refreshQuotes(trade.id)
      resetQuoteDraft()
    } catch (err) {
      if (uploadedImage) {
        try {
          await deleteStoredTradeAsset(uploadedImage.storagePath)
        } catch {
          // Ignore cleanup failures
        }
      }

      setError(err instanceof Error ? err.message : 'Failed to post your thought')
    } finally {
      setSavingQuote(false)
    }
  }

  if (loading) {
    return <div className="p-8">Loading focus view...</div>
  }

  if (error && !trade) {
    return <div className="p-8 text-rose-600">Error: {error}</div>
  }

  if (!trade) {
    return <div className="p-8">Trade not found.</div>
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-100 via-white to-slate-100 px-4 py-8 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl space-y-6">
        <AuthNavbar current="trades" onError={(message) => setError(message || null)} />

        {error && (
          <div className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
            {error}
          </div>
        )}

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-5">
          <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm lg:col-span-3">
            <div className="mb-4 flex flex-wrap items-start justify-between gap-4">
              <div>
                <button
                  type="button"
                  onClick={() => router.push('/trades')}
                  className="mb-2 text-sm text-slate-500 hover:text-slate-800"
                >
                  ← Back to trades
                </button>
                <h1 className="text-2xl font-semibold tracking-tight text-slate-900">
                  Trade Focus · #{trade.trade_number}
                </h1>
                <p className="mt-1 text-sm text-slate-500">
                  {trade.coin.toUpperCase()} · {trade.direction.toUpperCase()} · {trade.trade_date} {trade.trade_time || '00:00'} UTC
                </p>
              </div>

              <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700">
                <p><span className="text-slate-500">System:</span> {systemLabel}</p>
                <p><span className="text-slate-500">Entry:</span> {formatNumber(trade.avg_entry)}</p>
                <p><span className="text-slate-500">Stop:</span> {formatOptionalNumber(trade.stop_loss)}</p>
                <p><span className="text-slate-500">Exit:</span> {formatOptionalNumber(trade.avg_exit)}</p>
              </div>
            </div>

            <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500">Chart Snippet</h2>
            <TradeFocusChartSnippet trade={trade} />
          </section>

          <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm lg:col-span-2 lg:sticky lg:top-6 lg:h-[calc(100vh-6rem)] lg:flex lg:flex-col">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">Thinking Discussion</h2>
              <span className="text-xs text-slate-500">Oldest → newest</span>
            </div>

            <div className="flex-1 space-y-3 overflow-y-auto pr-1">
              {quotes.length === 0 && (
                <div className="rounded-lg border border-dashed border-slate-300 px-3 py-6 text-center text-sm text-slate-500">
                  No thoughts yet. Capture your first decision point.
                </div>
              )}

              {quotes.map((quote) => (
                <article key={quote.id} className="rounded-xl border border-slate-200 bg-white p-3">
                  <p className="mb-2 text-xs text-slate-500">{formatTimestamp(quote.created_at)}</p>
                  {quote.quote_text && (
                    <p className={`${thinkingFont.className} whitespace-pre-wrap text-[1.02rem] font-semibold leading-7 text-slate-900`}>
                      {quote.quote_text}
                    </p>
                  )}
                  {quote.image_storage_path && quoteImageUrls[quote.id] && (
                    <div className="mt-3 rounded-lg border border-slate-200 bg-slate-50 p-2">
                      <img
                        src={quoteImageUrls[quote.id]}
                        alt={quote.image_filename || 'Quote attachment'}
                        className="max-h-72 w-full rounded object-cover"
                      />
                      {quote.image_filename && (
                        <p className="mt-1 truncate text-xs text-slate-500">{quote.image_filename}</p>
                      )}
                    </div>
                  )}
                </article>
              ))}
            </div>

            {isTradeOngoing ? (
              <form onSubmit={handleAddQuote} className="mt-4 space-y-3 rounded-xl border border-slate-200 bg-slate-50 p-3">
                <textarea
                  value={draftQuote}
                  onChange={(e) => setDraftQuote(e.target.value)}
                  rows={3}
                  placeholder="What are you seeing right now? What matters most for your next decision?"
                  className={`${thinkingFont.className} w-full resize-none rounded-lg border border-slate-300 bg-white px-3 py-2 text-base font-semibold leading-relaxed text-slate-900 focus:outline-none focus:ring-2 focus:ring-sky-500`}
                />

                {draftImagePreview && (
                  <div className="rounded-lg border border-slate-300 bg-white p-2">
                    <img src={draftImagePreview} alt="Quote attachment preview" className="h-36 w-full rounded object-cover" />
                    <p className="mt-1 truncate text-xs text-slate-500">{draftImageFile?.name}</p>
                  </div>
                )}

                <input
                  ref={imageInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handlePickImage}
                  className="hidden"
                />

                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      if (!premiumLoading && !isPremium) {
                        redirectToPremium('screenshots')
                        return
                      }
                      imageInputRef.current?.click()
                    }}
                    className="rounded-lg border border-slate-300 px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-100"
                  >
                    {!premiumLoading && !isPremium ? 'Attach image (Premium)' : 'Attach image'}
                  </button>
                  <button
                    type="submit"
                    disabled={savingQuote}
                    className="rounded-lg bg-sky-600 px-3 py-2 text-xs font-semibold text-white hover:bg-sky-700 disabled:opacity-60"
                  >
                    {savingQuote ? 'Posting...' : 'Post thought'}
                  </button>
                </div>
                <p className="text-xs text-slate-500">
                  Tip: paste an image with Cmd+V / Ctrl+V.
                </p>
              </form>
            ) : (
              <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
                This trade is closed. Discussion is now read-only.
              </div>
            )}
          </section>
        </div>
      </div>
    </div>
  )
}

function formatTimestamp(value: string): string {
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) return value
  return parsed.toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function formatNumber(value: number): string {
  return Number(value.toFixed(6)).toString()
}

function formatOptionalNumber(value: number | null): string {
  if (value === null) return '-'
  return formatNumber(value)
}

function extractFirstImageFromClipboard(event: ClipboardEvent): File | null {
  const items = Array.from(event.clipboardData?.items || [])

  for (let index = 0; index < items.length; index += 1) {
    const item = items[index]
    if (!item.type.startsWith('image/')) continue

    const file = item.getAsFile()
    if (!file) continue

    const extension = file.type.split('/')[1] || 'png'
    return new File([file], `focus-quote-${Date.now()}.${extension}`, {
      type: file.type,
    })
  }

  return null
}
