export type UserPreferences = {
  user_id: string;
  break_even_r_threshold: number;
  created_at: string;
  updated_at: string;
};

export type UserPreferencesUpdate = {
  break_even_r_threshold?: number;
};
