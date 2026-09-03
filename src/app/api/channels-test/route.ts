import { NextResponse } from "next/server";
import { getChannels } from "@/lib/supabase/getChannels";

export async function GET() {
  const channels = await getChannels();

  return NextResponse.json({
    count: channels.length,
    channels: channels.map((channel) => ({
      id: channel.id,
      name: channel.name,
      category: channel.category,
      comingSoon: channel.comingSoon ?? false,
    })),
  });
}