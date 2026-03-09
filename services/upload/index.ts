import { supabase } from '@/lib/supabase/client'
import type { TradeScreenshot, TradeScreenshotInsert } from '@/services/trade'

const BUCKET = 'trades-screenshots'

export async function uploadScreenshot(
  userId: string,
  tradeId: string,
  file: File,
  caption?: string
): Promise<TradeScreenshot> {
  const timestamp = Date.now()
  const fileExt = file.name.split('.').pop()
  const filename = `${timestamp}.${fileExt}`
  const storagePath = `${userId}/${tradeId}/${filename}`

  const { error: uploadError } = await supabase.storage
    .from(BUCKET)
    .upload(storagePath, file)

  if (uploadError) throw uploadError

  const record: TradeScreenshotInsert = {
    trade_id: tradeId,
    user_id: userId,
    storage_path: storagePath,
    filename: file.name,
    caption: caption || null,
  }

  const { data, error: dbError } = await supabase
    .from('trade_screenshots')
    .insert(record)
    .select()
    .single()

  if (dbError) {
    await supabase.storage.from(BUCKET).remove([storagePath])
    throw dbError
  }

  return data
}

export async function getTradeScreenshots(tradeId: string): Promise<TradeScreenshot[]> {
  const { data, error } = await supabase
    .from('trade_screenshots')
    .select('*')
    .eq('trade_id', tradeId)
    .order('created_at', { ascending: true })

  if (error) throw error
  return data
}

export async function getScreenshotUrl(storagePath: string): Promise<string> {
  const { data, error } = await supabase.storage
    .from(BUCKET)
    .createSignedUrl(storagePath, 3600)

  if (error) throw error
  return data.signedUrl
}

export async function deleteScreenshot(screenshot: TradeScreenshot): Promise<void> {
  const { error: storageError } = await supabase.storage
    .from(BUCKET)
    .remove([screenshot.storage_path])

  if (storageError) throw storageError

  const { error: dbError } = await supabase
    .from('trade_screenshots')
    .delete()
    .eq('id', screenshot.id)

  if (dbError) throw dbError
}

export async function deleteAllTradeScreenshots(
  userId: string,
  tradeId: string
): Promise<void> {
  const screenshots = await getTradeScreenshots(tradeId)

  if (screenshots.length === 0) return

  const paths = screenshots.map(s => s.storage_path)
  const { error: storageError } = await supabase.storage
    .from(BUCKET)
    .remove(paths)

  if (storageError) throw storageError

  const { error: dbError } = await supabase
    .from('trade_screenshots')
    .delete()
    .eq('trade_id', tradeId)

  if (dbError) throw dbError
}

export async function updateScreenshotCaption(
  screenshotId: string,
  caption: string | null
): Promise<void> {
  const { error } = await supabase
    .from('trade_screenshots')
    .update({ caption })
    .eq('id', screenshotId)

  if (error) throw error
}

export async function uploadTradeThinkingQuoteImage(
  userId: string,
  tradeId: string,
  file: File,
): Promise<{ storagePath: string; originalFilename: string }> {
  const timestamp = Date.now()
  const fileExt = file.name.split('.').pop()
  const filename = `${timestamp}.${fileExt}`
  const storagePath = `${userId}/${tradeId}/thinking-quotes/${filename}`

  const { error } = await supabase.storage
    .from(BUCKET)
    .upload(storagePath, file)

  if (error) throw error

  return {
    storagePath,
    originalFilename: file.name,
  }
}

export async function deleteStoredTradeAsset(storagePath: string): Promise<void> {
  const { error } = await supabase.storage
    .from(BUCKET)
    .remove([storagePath])

  if (error) throw error
}
