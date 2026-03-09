import { supabase } from '@/lib/supabase/client';
import type {
  BacktestingTrade,
  BacktestingSessionInsert,
  BacktestingSessionUpdate,
  BacktestingTradeInsert,
  BacktestingTradeUpdate,
} from './types';

type MirrorLookupInput = {
  userId: string;
  asset: string;
  entryPrice: number;
  stopLoss: number | null;
  sessionId?: string | null;
};

type MirrorPayloadInput = {
  userId: string;
  sessionId: string;
  tradeDate: string;
  tradeTime: string | null;
  asset: string;
  direction: 'long' | 'short';
  entryPrice: number;
  stopLoss: number | null;
  notes: string | null;
  outcomeR: number | null;
};

export async function getBacktestingSessions(userId: string) {
  const { data, error } = await supabase
    .from('backtesting_sessions')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });

  if (error) throw error;
  return data;
}

export async function createBacktestingSession(session: BacktestingSessionInsert) {
  const { data, error } = await supabase
    .from('backtesting_sessions')
    .insert(session)
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function updateBacktestingSession(id: string, updates: BacktestingSessionUpdate) {
  const { data, error } = await supabase
    .from('backtesting_sessions')
    .update(updates)
    .eq('id', id)
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function deleteBacktestingSession(id: string) {
  const { error } = await supabase
    .from('backtesting_sessions')
    .delete()
    .eq('id', id);

  if (error) throw error;
}

export async function getBacktestingTrades(userId: string, sessionId: string) {
  const { data, error } = await supabase
    .from('backtesting_trades')
    .select('*')
    .eq('user_id', userId)
    .eq('session_id', sessionId)
    .order('created_at', { ascending: false });

  if (error) throw error;
  return data;
}

export async function createBacktestingTrade(trade: BacktestingTradeInsert) {
  const { data, error } = await supabase
    .from('backtesting_trades')
    .insert(trade)
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function createBacktestingTradesBulk(trades: BacktestingTradeInsert[]) {
  if (trades.length === 0) return [];

  const { data, error } = await supabase
    .from('backtesting_trades')
    .insert(trades)
    .select();

  if (error) throw error;
  return data;
}

export async function updateBacktestingTrade(id: string, updates: BacktestingTradeUpdate) {
  const { data, error } = await supabase
    .from('backtesting_trades')
    .update(updates)
    .eq('id', id)
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function deleteBacktestingTrade(id: string) {
  const { error } = await supabase
    .from('backtesting_trades')
    .delete()
    .eq('id', id);

  if (error) throw error;
}

export async function findMatchingBacktestingTrade({
  userId,
  asset,
  entryPrice,
  stopLoss,
  sessionId,
}: MirrorLookupInput): Promise<BacktestingTrade | null> {
  const normalizedAsset = asset.trim();
  if (!normalizedAsset) return null;

  let query = supabase
    .from('backtesting_trades')
    .select('*')
    .eq('user_id', userId)
    .eq('asset', normalizedAsset)
    .order('created_at', { ascending: false })
    .limit(100);

  if (sessionId) {
    query = query.eq('session_id', sessionId);
  }

  const { data, error } = await query;
  if (error) throw error;

  const exact = data.find((trade) =>
    trade.entry_price === entryPrice &&
    trade.stop_loss === stopLoss,
  );

  if (exact) return exact;

  const tolerant = data.find((trade) =>
    numbersMatch(trade.entry_price, entryPrice) &&
    numbersMatch(trade.stop_loss, stopLoss),
  );

  return tolerant ?? null;
}

export async function createBacktestingMirrorFromLiveTrade(input: MirrorPayloadInput) {
  const payload: BacktestingTradeInsert = {
    user_id: input.userId,
    session_id: input.sessionId,
    trade_date: input.tradeDate,
    trade_time: input.tradeTime,
    asset: input.asset.trim(),
    direction: input.direction,
    entry_price: input.entryPrice,
    stop_loss: input.stopLoss,
    target_price: null,
    outcome_r: toOutcomeR(input.outcomeR),
    notes: normalizeNotes(input.notes),
  };

  return createBacktestingTrade(payload);
}

export async function updateBacktestingMirrorFromLiveTrade(
  tradeId: string,
  input: Omit<MirrorPayloadInput, 'sessionId'>,
) {
  const updates: BacktestingTradeUpdate = {
    trade_date: input.tradeDate,
    trade_time: input.tradeTime,
    asset: input.asset.trim(),
    direction: input.direction,
    entry_price: input.entryPrice,
    stop_loss: input.stopLoss,
    target_price: null,
    outcome_r: toOutcomeR(input.outcomeR),
    notes: normalizeNotes(input.notes),
  };

  return updateBacktestingTrade(tradeId, updates);
}

function toOutcomeR(value: number | null): number {
  if (value === null || !Number.isFinite(value)) return 0;
  return value;
}

function normalizeNotes(value: string | null): string | null {
  if (!value) return null;
  const trimmed = value.trim();
  return trimmed || null;
}

function numbersMatch(a: number | null, b: number | null): boolean {
  if (a === null || b === null) return a === b;
  return Math.abs(a - b) <= 0.00000001;
}
