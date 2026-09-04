import {
  channels as localChannels,
  type Channel,
} from "@/data/channels";

import { getSupabaseClient } from "@/lib/supabase/client";
import type { ChannelRow } from "@/types/database";

type PlanNameRow = {
  id: string;
  name: string;
};

function mapRowToChannel(
  row: ChannelRow,
  planNames: Map<string, string>
): Channel {
  const localMatch = localChannels.find(
    (channel) => channel.name === row.name
  );

  return {
    id: localMatch?.id ?? row.sort_order,
    name: row.name,
    category: row.category,
    description: row.description,

    youtubeChannelId:
      row.youtube_channel_id ?? undefined,

    youtubeHandle:
      row.youtube_handle ?? undefined,

    officialEmbedUrl:
      row.official_embed_url ?? undefined,

    logoLocal:
      row.logo_local ?? undefined,

    comingSoon: row.coming_soon,

    accessType:
      row.access_type === "paid"
        ? "paid"
        : "free",

    requiredPlanId:
      row.required_plan_id ?? undefined,

    requiredPlanName:
      row.required_plan_id
        ? planNames.get(row.required_plan_id)
        : undefined,
  };
}

export async function getChannels(): Promise<Channel[]> {
  const supabase = getSupabaseClient();

  if (!supabase) {
    return localChannels.map((channel) => ({
      ...channel,
      accessType: channel.accessType ?? "free",
    }));
  }

  try {
    const { data, error } = await supabase
      .from("channels")
      .select("*")
      .eq("is_active", true)
      .order("sort_order", {
        ascending: true,
      });

    if (error || !data) {
      console.warn(
        "[VELORA] Supabase channel read failed, using local fallback."
      );

      return localChannels.map((channel) => ({
        ...channel,
        accessType: channel.accessType ?? "free",
      }));
    }

    const rows = data as ChannelRow[];

    const requiredPlanIds = Array.from(
      new Set(
        rows
          .map((row) => row.required_plan_id)
          .filter((id): id is string => Boolean(id))
      )
    );

    const planNames = new Map<string, string>();

    if (requiredPlanIds.length > 0) {
      const { data: planData, error: planError } =
        await supabase
          .from("plans")
          .select("id, name")
          .in("id", requiredPlanIds);

      if (!planError && planData) {
        (planData as PlanNameRow[]).forEach((plan) => {
          planNames.set(plan.id, plan.name);
        });
      }
    }

    return rows.map((row) =>
      mapRowToChannel(row, planNames)
    );
  } catch {
    console.warn(
      "[VELORA] Supabase unavailable, using local fallback."
    );

    return localChannels.map((channel) => ({
      ...channel,
      accessType: channel.accessType ?? "free",
    }));
  }
}