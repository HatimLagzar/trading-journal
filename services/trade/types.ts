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

export type TradeAnalyticsRow = Pick<
  Trade,
  | "id"
  | "trade_date"
  | "trade_time"
  | "coin"
  | "direction"
  | "avg_exit"
  | "realised_loss"
  | "realised_win"
  | "r_multiple"
  | "system_id"
  | "sub_system_id"
>;

export type TradePageFilters = {
  systemIds: string[];
  includeUnassignedSystem: boolean;
  subSystemId: string;
  outcome: "all" | "won" | "lost" | "be";
  direction: "all" | "long" | "short";
  asset: string;
  startDate: string | null;
  endDate: string | null;
  breakEvenRThreshold: number;
  dateSortDirection: "none" | "asc" | "desc";
};

export type TradePage = {
  trades: Trade[];
  count: number;
  ongoingCount: number;
  closedCount: number;
};

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
