import { NextResponse } from "next/server";

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
    console.log(`[LIVE API] ${message}${channelId ? `: ${channelId}` : ""}`);
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

function buildCachedResponse(data: LiveDiscoveryEntry["data"]) {
  return NextResponse.json({
    ...data,
    source: "youtube",
    cached: true,
    stale: false,
  });
}

function buildStaleResponse(data: LiveDiscoveryEntry["data"]) {
  return NextResponse.json({
    ...data,
    source: "youtube",
    cached: true,
    stale: true,
  });
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const channelId = searchParams.get("channelId");
  const handle = searchParams.get("handle");

  const apiKey = process.env.YOUTUBE_API_KEY;

  if (!apiKey) {
    return NextResponse.json(
      { error: "YouTube API key is missing" },
      { status: 500 }
    );
  }

  let resolvedChannelId = channelId;

  if (!resolvedChannelId && handle) {
    const normalizedHandle = handle.startsWith("@") ? handle : `@${handle}`;
    const handleKey = normalizedHandle.toLowerCase();
    const cachedHandle = handleCache.get(handleKey);

    if (isFreshCache(cachedHandle)) {
      resolvedChannelId = cachedHandle.channelId;
    } else {
      try {
        const handleResponse = await fetch(
          `https://www.googleapis.com/youtube/v3/channels?part=id&forHandle=${encodeURIComponent(normalizedHandle)}&key=${apiKey}`,
          {
            cache: "no-store",
          }
        );

        if (handleResponse.status === 429) {
          return rateLimitedResponse();
        }

        if (!handleResponse.ok) {
          return NextResponse.json(
            { error: "Unable to resolve channel handle" },
            { status: handleResponse.status }
          );
        }

        const handleData = await handleResponse.json();
        const matchedChannelId = handleData.items?.[0]?.id ?? null;

        if (matchedChannelId) {
          handleCache.set(handleKey, {
            channelId: matchedChannelId,
            expiresAt: Date.now() + HANDLE_CACHE_TTL_MS,
          });
        }

        resolvedChannelId = matchedChannelId;
      } catch {
        return NextResponse.json(
          { error: "Failed to resolve channel handle" },
          { status: 500 }
        );
      }
    }
  }

  if (!resolvedChannelId) {
    return NextResponse.json(
      { error: "channelId or handle is required" },
      { status: 400 }
    );
  }

  const cacheKey = resolvedChannelId;
  const cachedEntry = liveCache.get(cacheKey);

  if (cachedEntry && cachedEntry.expiresAt > Date.now()) {
    logLiveApi("cache hit", cacheKey);
    return buildCachedResponse(cachedEntry.data);
  }

  const staleSuccess =
    cachedEntry &&
    cachedEntry.data.live &&
    typeof cachedEntry.data.discoveredAt === "number" &&
    Date.now() - cachedEntry.data.discoveredAt <= STALE_SUCCESS_TTL_MS;

  const existingRequest = inFlightLookups.get(cacheKey);
  if (existingRequest) {
    return existingRequest;
  }

  const requestPromise = (async () => {
    try {
      logLiveApi("discovery request", cacheKey);

      const params = new URLSearchParams({
        part: "snippet",
        channelId: resolvedChannelId as string,
        eventType: "live",
        type: "video",
        videoEmbeddable: "true",
        videoSyndicated: "true",
        maxResults: "1",
        key: apiKey,
      });

      const response = await fetch(
        `https://www.googleapis.com/youtube/v3/search?${params.toString()}`,
        {
          cache: "no-store",
        }
      );

      if (response.status === 429) {
        if (staleSuccess) {
          logLiveApi("stale fallback", cacheKey);
          return buildStaleResponse(cachedEntry.data);
        }

        return rateLimitedResponse();
      }

      if (!response.ok) {
        if (staleSuccess) {
          logLiveApi("stale fallback", cacheKey);
          return buildStaleResponse(cachedEntry.data);
        }

        return NextResponse.json(
          {
            live: false,
            videoId: null,
            error: "Unable to contact YouTube",
            source: "youtube",
            cached: false,
            stale: false,
          },
          { status: response.status }
        );
      }

      const data = await response.json();
      const video = data.items?.[0];
      const now = Date.now();
      const payload: LiveDiscoveryEntry["data"] = video?.id?.videoId
        ? {
            live: true,
            videoId: video.id.videoId,
            title: video.snippet?.title ?? "",
            thumbnail: video.snippet?.thumbnails?.high?.url ?? null,
            discoveredAt: now,
            expiresAt: now + LIVE_CACHE_TTL_MS,
          }
        : {
            live: false,
            videoId: null,
            discoveredAt: now,
            expiresAt: now + OFFLINE_CACHE_TTL_MS,
          };

      liveCache.set(cacheKey, {
        data: payload,
        expiresAt: payload.expiresAt ?? now + OFFLINE_CACHE_TTL_MS,
        discoveredAt: payload.discoveredAt ?? now,
      });

      return NextResponse.json({
        ...payload,
        source: "youtube",
        cached: false,
        stale: false,
      });
    } catch {
      if (staleSuccess) {
        logLiveApi("stale fallback", cacheKey);
        return buildStaleResponse(cachedEntry.data);
      }

      return NextResponse.json(
        {
          live: false,
          videoId: null,
          error: "Failed to fetch live stream",
          source: "youtube",
          cached: false,
          stale: false,
        },
        { status: 500 }
      );
    } finally {
      inFlightLookups.delete(cacheKey);
    }
  })();

  inFlightLookups.set(cacheKey, requestPromise);
  return requestPromise;
}
