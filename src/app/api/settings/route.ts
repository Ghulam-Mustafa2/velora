import { NextResponse } from "next/server";
import { getSupabaseAdminClient } from "@/lib/supabase/server";

const SETTINGS_ID = "global";

const DEFAULT_SETTINGS = {
  id: SETTINGS_ID,
  site_title: "VELORA",
  tagline: "Premium Pakistani television, reimagined.",
  hero_heading: "Television, Reimagined.",
  hero_subheading:
    "Premium Pakistani live television, curated into a cinematic viewing experience.",
  default_category: "All",
  footer_text: "Premium Pakistani television, reimagined.",
  maintenance_mode: false,
  global_notice_enabled: false,
  global_notice: "",
};

export async function GET() {
  try {
    const supabase = getSupabaseAdminClient();

    const { data, error } = await supabase
      .from("site_settings")
      .select(
        "site_title, tagline, hero_heading, hero_subheading, default_category, footer_text, maintenance_mode, global_notice_enabled, global_notice"
      )
      .eq("id", SETTINGS_ID)
      .maybeSingle();

    if (error) {
      return NextResponse.json({
        ok: true,
        settings: DEFAULT_SETTINGS,
        fallback: true,
      });
    }

    return NextResponse.json({
      ok: true,
      settings: data ?? DEFAULT_SETTINGS,
      fallback: !data,
    });
  } catch {
    return NextResponse.json({
      ok: true,
      settings: DEFAULT_SETTINGS,
      fallback: true,
    });
  }
}
