import { NextResponse } from "next/server";

import { createSupabaseAuthServerClient } from "@/lib/supabase/auth-server";
import { getSupabaseAdminClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

const LIVE_CACHE_TTL_MS = 30 * 60 * 1000;
const OFFLINE_CACHE_TTL_MS = 10 * 60 * 1000;
const STALE_SUCCESS_TTL_MS = 6 * 60 * 60 * 1000;
const HANDLE_CACHE_TTL_MS = 24 * 60 * 60 * 1000;

type LiveDiscoveryEntry = {
  data: {
    live: boolean;
    videoId: string | null;
    title?: string;
    thumbnail?: string | null;
    discoveredAt?: number;
    expiresAt?: number;
  };
  expiresAt: number;
  discoveredAt: number;
};

type ChannelAccessRow = {
  id: string;
  name: string;
  access_type: "free" | "paid";
  required_plan_id: string | null;
};

const liveCache = new Map<string, LiveDiscoveryEntry>();

const handleCache = new Map<
  string,
  {
    channelId: string;
    expiresAt: number;
  }
>();

const inFlightLookups = new Map<string, Promise<NextResponse>>();

function isFreshCache(
  entry: { expiresAt: number } | undefined
): entry is { expiresAt: number } {
  return entry !== undefined && entry.expiresAt > Date.now();
}

function logLiveApi(message: string, channelId?: string) {
  if (process.env.NODE_ENV !== "production") {
    console.log(
      `[LIVE API] ${message}${channelId ? `: ${channelId}` : ""}`
    );
  }
}

function rateLimitedResponse() {
  logLiveApi("rate limited");

  return NextResponse.json(
    {
      live: false,
      videoId: null,
      error: "rate_limited",
      source: "youtube",
      cached: false,
      stale: false,
    },
    { status: 429 }
  );
}

function buildCachedResponse(
  data: LiveDiscoveryEntry["data"]
) {
  return NextResponse.json({
    ...data,
    source: "youtube",
    cached: true,
    stale: false,
  });
}

function buildStaleResponse(
  data: LiveDiscoveryEntry["data"]
) {
  return NextResponse.json({
    ...data,
    source: "youtube",
    cached: true,
    stale: true,
  });
}

/**
 * Find the VELORA catalogue channel associated with this live request.
 *
 * We check the database before performing YouTube discovery so premium
 * entitlement is enforced before any cache lookup or YouTube API request.
 */
async function findVeloraChannel(
  channelId: string | null,
  handle: string | null
): Promise<ChannelAccessRow | null> {
  const supabase = getSupabaseAdminClient();

  if (channelId) {
    const { data, error } = await supabase
      .from("channels")
      .select(
        "id, name, access_type, required_plan_id"
      )
      .eq("youtube_channel_id", channelId)
      .eq("is_active", true)
      .maybeSingle();

    if (error) {
      throw new Error(error.message);
    }

    if (data) {
      return data as ChannelAccessRow;
    }
  }

  if (handle) {
    const normalizedHandle = handle.startsWith("@")
      ? handle
      : `@${handle}`;

    const { data, error } = await supabase
      .from("channels")
      .select(
        "id, name, access_type, required_plan_id"
      )
      .eq("youtube_handle", normalizedHandle)
      .eq("is_active", true)
      .maybeSingle();

    if (error) {
      throw new Error(error.message);
    }

    if (data) {
      return data as ChannelAccessRow;
    }
  }

  return null;
}

/**
 * Free channels pass immediately.
 *
 * Paid channels require:
 * - an authenticated Supabase user
 * - a matching required plan
 * - active status
 * - starts_at <= now
 * - expires_at > now
 */
async function authorizeChannelAccess(
  channel: ChannelAccessRow | null
) {
  /*
   * If this request is not associated with a VELORA catalogue channel,
   * do not treat it as premium.
   *
   * We can tighten this later and reject unknown channels completely
   * if you want /api/live to work only for catalogue channels.
   */
  if (!channel || channel.access_type !== "paid") {
    return {
      allowed: true,
      status: 200,
      reason: null,
    };
  }

  if (!channel.required_plan_id) {
    return {
      allowed: false,
      status: 403,
      reason:
        "This premium channel does not have a valid subscription plan configured.",
    };
  }

  const authSupabase =
    await createSupabaseAuthServerClient();

  const {
    data: { user },
    error: userError,
  } = await authSupabase.auth.getUser();

  if (userError || !user) {
    return {
      allowed: false,
      status: 401,
      reason:
        "Please sign in to access this premium channel.",
    };
  }

  const now = new Date().toISOString();

  /*
   * Use the admin server client for the entitlement lookup.
   *
   * The user id came from the verified Supabase server-side session,
   * so the caller cannot choose another user's id.
   */
  const adminSupabase = getSupabaseAdminClient();

  const { data: subscription, error } =
    await adminSupabase
      .from("subscriptions")
      .select("id")
      .eq("user_id", user.id)
      .eq(
        "plan_id",
        channel.required_plan_id
      )
      .eq("status", "active")
      .lte("starts_at", now)
      .gt("expires_at", now)
      .limit(1)
      .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  if (!subscription) {
    return {
      allowed: false,
      status: 403,
      reason:
        "An active premium subscription is required for this channel.",
    };
  }

  return {
    allowed: true,
    status: 200,
    reason: null,
  };
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);

    const channelId =
      searchParams.get("channelId");

    const handle =
      searchParams.get("handle");

    /*
     * -------------------------------------------------------
     * SERVER-SIDE PREMIUM ACCESS CHECK
     * -------------------------------------------------------
     *
     * This intentionally happens BEFORE:
     *
     * - handle resolution
     * - live cache lookup
     * - stale cache lookup
     * - in-flight request reuse
     * - YouTube API discovery
     *
     * Therefore an unauthorized premium viewer cannot obtain
     * a cached paid result or cause a YouTube API request.
     */
    const veloraChannel =
      await findVeloraChannel(
        channelId,
        handle
      );

    /*
     * SECURITY:
     * /api/live only accepts channels that exist in the active
     * VELORA catalogue. This prevents arbitrary YouTube channel IDs
     * from using our endpoint as a general live-discovery proxy.
     *
     * This rejection also happens before cache lookup and YouTube API
     * discovery, so unknown channels cannot consume discovery quota.
     */
    if (!veloraChannel) {
      logLiveApi(
        "unknown catalogue channel rejected",
        channelId ?? handle ?? undefined
      );

      return NextResponse.json(
        {
          live: false,
          videoId: null,
          error: "channel_not_found",
          message:
            "This channel is not available in the VELORA catalogue.",
          cached: false,
          stale: false,
        },
        { status: 404 }
      );
    }

    const access =
      await authorizeChannelAccess(
        veloraChannel
      );

    if (!access.allowed) {
      logLiveApi(
        "premium access denied",
        veloraChannel?.name
      );

      return NextResponse.json(
        {
          live: false,
          videoId: null,
          error:
            access.status === 401
              ? "authentication_required"
              : "subscription_required",
          message: access.reason,
          premium: true,
          cached: false,
          stale: false,
        },
        {
          status: access.status,
        }
      );
    }

    const apiKey =
      process.env.YOUTUBE_API_KEY;

    if (!apiKey) {
      return NextResponse.json(
        {
          error:
            "YouTube API key is missing",
        },
        { status: 500 }
      );
    }

    let resolvedChannelId =
      channelId;

    if (
      !resolvedChannelId &&
      handle
    ) {
      const normalizedHandle =
        handle.startsWith("@")
          ? handle
          : `@${handle}`;

      const handleKey =
        normalizedHandle.toLowerCase();

      const cachedHandle =
        handleCache.get(handleKey);

      if (
        isFreshCache(cachedHandle)
      ) {
        resolvedChannelId =
          cachedHandle.channelId;
      } else {
        try {
          const handleResponse =
            await fetch(
              `https://www.googleapis.com/youtube/v3/channels?part=id&forHandle=${encodeURIComponent(
                normalizedHandle
              )}&key=${apiKey}`,
              {
                cache: "no-store",
              }
            );

          if (
            handleResponse.status === 429
          ) {
            return rateLimitedResponse();
          }

          if (!handleResponse.ok) {
            return NextResponse.json(
              {
                error:
                  "Unable to resolve channel handle",
              },
              {
                status:
                  handleResponse.status,
              }
            );
          }

          const handleData =
            await handleResponse.json();

          const matchedChannelId =
            handleData.items?.[0]?.id ??
            null;

          if (matchedChannelId) {
            handleCache.set(
              handleKey,
              {
                channelId:
                  matchedChannelId,
                expiresAt:
                  Date.now() +
                  HANDLE_CACHE_TTL_MS,
              }
            );
          }

          resolvedChannelId =
            matchedChannelId;
        } catch {
          return NextResponse.json(
            {
              error:
                "Failed to resolve channel handle",
            },
            { status: 500 }
          );
        }
      }
    }

    if (!resolvedChannelId) {
      return NextResponse.json(
        {
          error:
            "channelId or handle is required",
        },
        { status: 400 }
      );
    }

    const cacheKey =
      resolvedChannelId;

    const cachedEntry =
      liveCache.get(cacheKey);

    if (
      cachedEntry &&
      cachedEntry.expiresAt >
        Date.now()
    ) {
      logLiveApi(
        "cache hit",
        cacheKey
      );

      return buildCachedResponse(
        cachedEntry.data
      );
    }

    const staleSuccess =
      cachedEntry &&
      cachedEntry.data.live &&
      typeof cachedEntry.data
        .discoveredAt ===
        "number" &&
      Date.now() -
        cachedEntry.data
          .discoveredAt <=
        STALE_SUCCESS_TTL_MS;

    const existingRequest =
      inFlightLookups.get(cacheKey);

    if (existingRequest) {
      return existingRequest;
    }

    const requestPromise =
      (async () => {
        try {
          logLiveApi(
            "discovery request",
            cacheKey
          );

          const params =
            new URLSearchParams({
              part: "snippet",
              channelId:
                resolvedChannelId as string,
              eventType: "live",
              type: "video",
              videoEmbeddable:
                "true",
              videoSyndicated:
                "true",
              maxResults: "1",
              key: apiKey,
            });

          const response =
            await fetch(
              `https://www.googleapis.com/youtube/v3/search?${params.toString()}`,
              {
                cache:
                  "no-store",
              }
            );

          if (
            response.status === 429
          ) {
            if (
              staleSuccess &&
              cachedEntry
            ) {
              logLiveApi(
                "stale fallback",
                cacheKey
              );

              return buildStaleResponse(
                cachedEntry.data
              );
            }

            return rateLimitedResponse();
          }

          if (!response.ok) {
            if (
              staleSuccess &&
              cachedEntry
            ) {
              logLiveApi(
                "stale fallback",
                cacheKey
              );

              return buildStaleResponse(
                cachedEntry.data
              );
            }

            return NextResponse.json(
              {
                live: false,
                videoId: null,
                error:
                  "Unable to contact YouTube",
                source:
                  "youtube",
                cached: false,
                stale: false,
              },
              {
                status:
                  response.status,
              }
            );
          }

          const data =
            await response.json();

          const video =
            data.items?.[0];

          const now =
            Date.now();

          const payload: LiveDiscoveryEntry["data"] =
            video?.id?.videoId
              ? {
                  live: true,
                  videoId:
                    video.id
                      .videoId,
                  title:
                    video.snippet
                      ?.title ?? "",
                  thumbnail:
                    video.snippet
                      ?.thumbnails
                      ?.high?.url ??
                    null,
                  discoveredAt:
                    now,
                  expiresAt:
                    now +
                    LIVE_CACHE_TTL_MS,
                }
              : {
                  live: false,
                  videoId:
                    null,
                  discoveredAt:
                    now,
                  expiresAt:
                    now +
                    OFFLINE_CACHE_TTL_MS,
                };

          liveCache.set(
            cacheKey,
            {
              data: payload,
              expiresAt:
                payload.expiresAt ??
                now +
                  OFFLINE_CACHE_TTL_MS,
              discoveredAt:
                payload.discoveredAt ??
                now,
            }
          );

          return NextResponse.json({
            ...payload,
            source: "youtube",
            cached: false,
            stale: false,
          });
        } catch {
          if (
            staleSuccess &&
            cachedEntry
          ) {
            logLiveApi(
              "stale fallback",
              cacheKey
            );

            return buildStaleResponse(
              cachedEntry.data
            );
          }

          return NextResponse.json(
            {
              live: false,
              videoId: null,
              error:
                "Failed to fetch live stream",
              source:
                "youtube",
              cached: false,
              stale: false,
            },
            { status: 500 }
          );
        } finally {
          inFlightLookups.delete(
            cacheKey
          );
        }
      })();

    inFlightLookups.set(
      cacheKey,
      requestPromise
    );

    return requestPromise;
  } catch (error) {
    console.error(
      "[LIVE API] Server error:",
      error
    );

    return NextResponse.json(
      {
        live: false,
        videoId: null,
        error:
          "live_api_error",
        message:
          error instanceof Error
            ? error.message
            : "Unable to process live stream request.",
        cached: false,
        stale: false,
      },
      { status: 500 }
    );
  }
}