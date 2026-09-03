export type ChannelRow = {
  id: string;
  key: string;
  name: string;
  category: string;
  description: string;
  youtube_channel_id: string | null;
  youtube_handle: string | null;
  official_embed_url: string | null;
  logo_local: string | null;
  coming_soon: boolean;
  is_active: boolean;
  sort_order: number;
  created_at: string;
  updated_at: string;
};

export type Database = {
  public: {
    Tables: {
      channels: {
        Row: ChannelRow;
        Insert: Omit<ChannelRow, "id" | "created_at" | "updated_at"> & {
          id?: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Omit<ChannelRow, "id" | "created_at" | "updated_at">> & {
          updated_at?: string;
        };
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
};
