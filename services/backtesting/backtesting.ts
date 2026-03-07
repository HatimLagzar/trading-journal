import { supabase } from '@/lib/supabase/client';
import type {
  BacktestingSessionInsert,
  BacktestingSessionUpdate,
  BacktestingTradeInsert,
  BacktestingTradeUpdate,
} from './types';

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
    .order('trade_date', { ascending: false })
    .order('trade_time', { ascending: false, nullsFirst: false })
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
