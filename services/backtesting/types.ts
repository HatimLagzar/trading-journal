export type BacktestingSession = {
  id: string;
  created_at: string;
  user_id: string;
  system_id: string | null;
  name: string;
  notes: string | null;
};

export type BacktestingSessionInsert = Omit<BacktestingSession, 'id' | 'created_at'>;
export type BacktestingSessionUpdate = Partial<Omit<BacktestingSession, 'id' | 'created_at'>>;

export type BacktestingTakeProfit = {
  price: number;
  quantity_percent: number;
};

export type BacktestingTrade = {
  id: string;
  created_at: string;
  user_id: string;
  session_id: string;
  trade_date: string;
  trade_time: string | null;
  asset: string;
  direction: 'long' | 'short';
  entry_price: number | null;
  stop_loss: number | null;
  target_price: number | null;
  take_profits: BacktestingTakeProfit[];
  outcome_r: number;
  notes: string | null;
};

export type BacktestingTradeInsert = Omit<BacktestingTrade, 'id' | 'created_at'>;
export type BacktestingTradeUpdate = Partial<Omit<BacktestingTrade, 'id' | 'created_at'>>;
