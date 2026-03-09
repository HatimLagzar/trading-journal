import { supabase } from '@/lib/supabase/client'
import type { TradeThinkingQuote, TradeThinkingQuoteInsert } from './types'

export async function getTradeThinkingQuotes(tradeId: string): Promise<TradeThinkingQuote[]> {
  const { data, error } = await supabase
    .from('trade_thinking_quotes')
    .select('*')
    .eq('trade_id', tradeId)
    .order('created_at', { ascending: true })

  if (error) throw error
  return data
}

export async function createTradeThinkingQuote(
  quote: TradeThinkingQuoteInsert,
): Promise<TradeThinkingQuote> {
  const { data, error } = await supabase
    .from('trade_thinking_quotes')
    .insert(quote)
    .select()
    .single()

  if (error) throw error
  return data
}
