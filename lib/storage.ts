import { supabase } from './supabase/client'
import type { TradeScreenshot, TradeScreenshotInsert } from './types'

const BUCKET = 'trades-screenshots'

// Upload a screenshot and create database record
export async function uploadScreenshot(
  userId: string,
  tradeId: string,
  file: File,
  caption?: string
): Promise<TradeScreenshot> {
  // Create unique filename to avoid collisions
  const timestamp = Date.now()
  const fileExt = file.name.split('.').pop()
  const filename = `${timestamp}.${fileExt}`
  const storagePath = `${userId}/${tradeId}/${filename}`

  // 1. Upload to storage
  const { error: uploadError } = await supabase.storage
    .from(BUCKET)
    .upload(storagePath, file)

  if (uploadError) throw uploadError

  // 2. Create database record
  const record: TradeScreenshotInsert = {
    trade_id: tradeId,
    user_id: userId,
    storage_path: storagePath,
    filename: file.name, // Original filename for display
    caption: caption || null,
  }

  const { data, error: dbError } = await supabase
    .from('trade_screenshots')
    .insert(record)
    .select()
    .single()

  if (dbError) {
    // Rollback: delete uploaded file if db insert fails
    await supabase.storage.from(BUCKET).remove([storagePath])
    throw dbError
  }

  return data
}

// Get all screenshots for a trade
export async function getTradeScreenshots(tradeId: string): Promise<TradeScreenshot[]> {
  const { data, error } = await supabase
    .from('trade_screenshots')
    .select('*')
    .eq('trade_id', tradeId)
    .order('created_at', { ascending: true })

  if (error) throw error
  return data
}

// Get signed URL for viewing a screenshot
export async function getScreenshotUrl(storagePath: string): Promise<string> {
  const { data, error } = await supabase.storage
    .from(BUCKET)
    .createSignedUrl(storagePath, 3600) // 1 hour

  if (error) throw error
  return data.signedUrl
}

// Delete a screenshot (storage + database record)
export async function deleteScreenshot(screenshot: TradeScreenshot): Promise<void> {
  // 1. Delete from storage
  const { error: storageError } = await supabase.storage
    .from(BUCKET)
    .remove([screenshot.storage_path])

  if (storageError) throw storageError

  // 2. Delete database record
  const { error: dbError } = await supabase
    .from('trade_screenshots')
    .delete()
    .eq('id', screenshot.id)

  if (dbError) throw dbError
}

// Delete all screenshots for a trade
export async function deleteAllTradeScreenshots(
  userId: string,
  tradeId: string
): Promise<void> {
  // 1. Get all screenshots for the trade
  const screenshots = await getTradeScreenshots(tradeId)

  if (screenshots.length === 0) return

  // 2. Delete all files from storage
  const paths = screenshots.map(s => s.storage_path)
  const { error: storageError } = await supabase.storage
    .from(BUCKET)
    .remove(paths)

  if (storageError) throw storageError

  // 3. Delete all database records
  const { error: dbError } = await supabase
    .from('trade_screenshots')
    .delete()
    .eq('trade_id', tradeId)

  if (dbError) throw dbError
}

// Update screenshot caption
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
