export type System = {
  id: string;
  created_at: string;
  user_id: string;
  name: string;
  entry_rules: string | null;
  sl_rules: string | null;
  tp_rules: string | null;
  description: string | null;
};

export type SystemInsert = Omit<System, 'id' | 'created_at'>;
export type SystemUpdate = Partial<Omit<System, 'id' | 'created_at'>>;

export type SubSystem = {
  id: string;
  created_at: string;
  user_id: string;
  system_id: string;
  name: string;
  entry_rules: string | null;
  sl_rules: string | null;
  tp_rules: string | null;
  description: string | null;
};

export type SubSystemInsert = Omit<SubSystem, 'id' | 'created_at'>;
export type SubSystemUpdate = Partial<Omit<SubSystem, 'id' | 'created_at'>>;
