export type Trade = {
  id: string;
  created_at: string;
  user_id: string;
  trade_number: number;
  trade_date: string;
  trade_time: string | null;
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
  system_id: string | null;
  sub_system_id: string | null;
  notes: string | null;
};

export type TradeInsert = Omit<Trade, "id" | "created_at" | "trade_number">;

export type TradeUpdate = Partial<Omit<Trade, "id" | "created_at" | "trade_number">>;

export type TradeScreenshot = {
  id: string;
  created_at: string;
  trade_id: string;
  user_id: string;
  storage_path: string;
  filename: string;
  caption: string | null;
};

export type TradeScreenshotInsert = Omit<TradeScreenshot, "id" | "created_at">;

export type TradeThinkingQuote = {
  id: string;
  created_at: string;
  trade_id: string;
  user_id: string;
  quote_text: string | null;
  image_storage_path: string | null;
  image_filename: string | null;
};

export type TradeThinkingQuoteInsert = Omit<TradeThinkingQuote, 'id' | 'created_at'>;
