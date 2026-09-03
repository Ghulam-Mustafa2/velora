import { channels as localChannels, type Channel } from "@/data/channels";
import { getSupabaseClient } from "@/lib/supabase/client";
import type { ChannelRow } from "@/types/database";

function mapRowToChannel(row: ChannelRow): Channel {
  const localMatch = localChannels.find(
    (channel) => channel.name === row.name
  );

  return {
    id: localMatch?.id ?? row.sort_order,
    name: row.name,
    category: row.category,
    description: row.description,
    youtubeChannelId: row.youtube_channel_id ?? undefined,
    youtubeHandle: row.youtube_handle ?? undefined,
    officialEmbedUrl: row.official_embed_url ?? undefined,
    logoLocal: row.logo_local ?? undefined,
    comingSoon: row.coming_soon,
  };
}

export async function getChannels(): Promise<Channel[]> {
  const supabase = getSupabaseClient();

  if (!supabase) {
    return localChannels;
  }

  try {
    const { data, error } = await supabase
      .from("channels")
      .select("*")
      .eq("is_active", true)
      .order("sort_order", { ascending: true });

    if (error || !data) {
      console.warn("[VELORA] Supabase channel read failed, using local fallback.");
      return localChannels;
    }

    return (data as ChannelRow[]).map(mapRowToChannel);
  } catch {
    console.warn("[VELORA] Supabase unavailable, using local fallback.");
    return localChannels;
  }
}