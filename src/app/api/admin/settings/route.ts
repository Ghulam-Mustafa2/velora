import { NextResponse } from "next/server";
import { getSupabaseAdminClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/supabase/require-admin";

const SETTINGS_ID = "global";

const DEFAULT_SETTINGS = {
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
  premium_lock_title: "Subscription required",
  premium_lock_message:
    "This channel requires the {plan_name} plan to watch live.",
};

async function ensureSettingsRow() {
  const supabase = getSupabaseAdminClient();

  const { data, error } = await supabase
    .from("site_settings")
    .select("*")
    .eq("id", SETTINGS_ID)
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (data) return data;

  const { data: created, error: insertError } = await supabase
    .from("site_settings")
    .insert({ id: SETTINGS_ID, ...DEFAULT_SETTINGS })
    .select("*")
    .single();

  if (insertError) throw new Error(insertError.message);
  return created;
}

export async function GET() {
  try {
    const user = await requireAdmin();

    if (!user) {
      return NextResponse.json(
        { ok: false, error: "Unauthorized" },
        { status: 401 }
      );
    }

    const settings = await ensureSettingsRow();

    return NextResponse.json({
      ok: true,
      settings,
    });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error:
          error instanceof Error
            ? error.message
            : "Unknown server error",
      },
      { status: 500 }
    );
  }
}

export async function PATCH(request: Request) {
  try {
    const user = await requireAdmin();

    if (!user) {
      return NextResponse.json(
        { ok: false, error: "Unauthorized" },
        { status: 401 }
      );
    }

    const body = (await request.json()) as {
      siteTitle?: string;
      tagline?: string;
      heroHeading?: string;
      heroSubheading?: string;
      defaultCategory?: string;
      footerText?: string;
      maintenanceMode?: boolean;
      globalNoticeEnabled?: boolean;
      globalNotice?: string;
      premiumLockTitle?: string;
      premiumLockMessage?: string;
    };

    const updates = {
      site_title:
        body.siteTitle?.trim() ||
        DEFAULT_SETTINGS.site_title,

      tagline:
        body.tagline?.trim() ||
        DEFAULT_SETTINGS.tagline,

      hero_heading:
        body.heroHeading?.trim() ||
        DEFAULT_SETTINGS.hero_heading,

      hero_subheading:
        body.heroSubheading?.trim() ||
        DEFAULT_SETTINGS.hero_subheading,

      default_category:
        body.defaultCategory?.trim() ||
        DEFAULT_SETTINGS.default_category,

      footer_text:
        body.footerText?.trim() ||
        DEFAULT_SETTINGS.footer_text,

      maintenance_mode: Boolean(
        body.maintenanceMode
      ),

      global_notice_enabled: Boolean(
        body.globalNoticeEnabled
      ),

      global_notice:
        body.globalNotice?.trim() || "",

      premium_lock_title:
        body.premiumLockTitle?.trim() ||
        DEFAULT_SETTINGS.premium_lock_title,

      premium_lock_message:
        body.premiumLockMessage?.trim() ||
        DEFAULT_SETTINGS.premium_lock_message,

      updated_at: new Date().toISOString(),
    };

    const supabase = getSupabaseAdminClient();

    const { data, error } = await supabase
      .from("site_settings")
      .upsert(
        {
          id: SETTINGS_ID,
          ...updates,
        },
        {
          onConflict: "id",
        }
      )
      .select("*")
      .single();

    if (error) {
      return NextResponse.json(
        {
          ok: false,
          error: error.message,
        },
        { status: 500 }
      );
    }

    return NextResponse.json({
      ok: true,
      settings: data,
    });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error:
          error instanceof Error
            ? error.message
            : "Unknown server error",
      },
      { status: 500 }
    );
  }
}