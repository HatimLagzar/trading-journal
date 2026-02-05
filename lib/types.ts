// Database types matching your Supabase schema

export type Trade = {
  id: string;
  created_at: string;
  user_id: string;
  trade_number: number;
  trade_date: string; // ISO date string 'YYYY-MM-DD'
  trade_time: string | null; // 'HH:MM:SS'
  coin: string;
  direction: "long" | "short";
  entry_order_type: string | null;
  avg_entry: number;
  stop_loss: number | null;
  avg_exit: number | null;
  risk: number | null;
  expected_loss: number | null;
  realised_loss: number | null;
  realised_win: number | null;
  deviation: number | null;
  r_multiple: number | null;
  early_exit_reason: string | null;
  rules: string | null;
  system_number: string | null;
  notes: string | null;
};

// For inserting new trades (omit auto-generated fields)
export type TradeInsert = Omit<Trade, "id" | "created_at" | "trade_number">;

// For updating trades (all fields optional except id)
export type TradeUpdate = Partial<
  Omit<Trade, "id" | "created_at" | "trade_number">
>;
