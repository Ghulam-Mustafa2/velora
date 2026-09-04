import { NextResponse } from "next/server";

import { getChannels } from "@/lib/supabase/getChannels";
import { getSupabaseAdminClient } from "@/lib/supabase/server";

type PlanNameRow = {
  id: string;
  name: string;
};

export async function GET() {
  try {
    const channels = await getChannels();

    const requiredPlanIds = Array.from(
      new Set(
        channels
          .map((channel) => channel.requiredPlanId)
          .filter((id): id is string => Boolean(id))
      )
    );

    if (requiredPlanIds.length === 0) {
      return NextResponse.json({
        channels,
      });
    }

    const supabase = getSupabaseAdminClient();

    const { data: plans, error } = await supabase
      .from("plans")
      .select("id, name")
      .in("id", requiredPlanIds);

    if (error || !plans) {
      return NextResponse.json({
        channels,
      });
    }

    const planNames = new Map<string, string>();

    (plans as PlanNameRow[]).forEach((plan) => {
      planNames.set(plan.id, plan.name);
    });

    const enrichedChannels = channels.map((channel) => ({
      ...channel,
      requiredPlanName: channel.requiredPlanId
        ? planNames.get(channel.requiredPlanId)
        : undefined,
    }));

    return NextResponse.json({
      channels: enrichedChannels,
    });
  } catch {
    return NextResponse.json({
      channels: await getChannels(),
    });
  }
}