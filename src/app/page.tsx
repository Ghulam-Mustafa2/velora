"use client";

import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import { channels as localChannels, type Channel } from "@/data/channels";

type ChannelLiveState = {
  status:
    | "ready"
    | "loading"
    | "live-youtube"
    | "live-official"
    | "offline"
    | "error"
    | "coming-soon";
  videoId?: string;
  title?: string;
};

type LiveVideo = {
  live: boolean;
  videoId: string | null;
  title?: string;
  thumbnail?: string | null;
  error?: string;
  source?: "youtube";
  cached?: boolean;
  stale?: boolean;
};

type RecentHistoryItem = {
  channelId: number;
  timestamp: number;
};

type PublicSiteSettings = {
  siteTitle: string;
  tagline: string;
  heroHeading: string;
  heroSubheading: string;
  defaultCategory: string;
  footerText: string;
  maintenanceMode: boolean;
  globalNoticeEnabled: boolean;
  globalNotice: string;
};

type PublicSiteSettingsRow = {
  site_title?: string | null;
  tagline?: string | null;
  hero_heading?: string | null;
  hero_subheading?: string | null;
  default_category?: string | null;
  footer_text?: string | null;
  maintenance_mode?: boolean | null;
  global_notice_enabled?: boolean | null;
  global_notice?: string | null;
};

const defaultPublicSiteSettings: PublicSiteSettings = {
  siteTitle: "VELORA",
  tagline: "Premium Pakistani television, reimagined.",
  heroHeading: "Television, Reimagined.",
  heroSubheading:
    "Premium Pakistani live television, curated into a cinematic viewing experience.",
  defaultCategory: "All",
  footerText: "Premium Pakistani television, reimagined.",
  maintenanceMode: false,
  globalNoticeEnabled: false,
  globalNotice: "",
};

const FAVORITES_STORAGE_KEY = "velora:favorites:v1";
const RECENT_STORAGE_KEY = "velora:recent:v1";
const MAX_RECENT_ITEMS = 6;

function getChannelInitials(channelName: string) {
  return channelName
    .split(/\s+/)
    .filter(Boolean)
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

function ChannelIdentity({
  channel,
  compact = false,
}: {
  channel: Channel;
  compact?: boolean;
}) {
  const sizeClass = compact ? "h-12 w-12" : "h-24 w-24";
  const initials = getChannelInitials(channel.name);

  return (
    <div
      className={`${sizeClass} relative flex shrink-0 items-center justify-center overflow-hidden rounded-xl border border-white/10 bg-[radial-gradient(circle_at_top_left,rgba(220,38,38,0.18),transparent_55%),#090909] text-xs font-black uppercase tracking-[0.18em] text-white/90`}
      aria-label={`${channel.name} logo`}
    >
      <span className="absolute inset-0 flex items-center justify-center">
        {initials}
      </span>

      {channel.logoLocal ? (
        // Native img supports both /public paths and direct remote image URLs.
        // The initials remain underneath as a safe fallback if the image fails.
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={channel.logoLocal}
          alt={`${channel.name} logo`}
          className="relative z-10 h-full w-full bg-[#090909] object-contain p-1.5"
          loading={compact ? "eager" : "lazy"}
          onError={(event) => {
            event.currentTarget.style.display = "none";
          }}
        />
      ) : null}
    </div>
  );
}

function StatusBadge({ status }: { status: ChannelLiveState["status"] }) {
  const styles = {
    ready: "border-white/10 bg-white/5 text-white/55",
    loading: "border-white/15 bg-white/5 text-white/70",
    "live-youtube": "border-red-500/30 bg-red-600/15 text-red-200",
    "live-official": "border-red-500/30 bg-red-600/15 text-red-200",
    offline: "border-white/10 bg-white/[0.03] text-white/40",
    error: "border-amber-400/20 bg-amber-400/5 text-amber-200/75",
    "coming-soon": "border-white/10 bg-white/5 text-white/45",
  } as const;

  const labels = {
    ready: "READY",
    loading: "CHECKING",
    "live-youtube": "LIVE",
    "live-official": "LIVE",
    offline: "OFFLINE",
    error: "UNAVAILABLE",
    "coming-soon": "COMING SOON",
  } as const;

  return (
    <span
      className={[
        "inline-flex items-center gap-2 rounded-full border px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.22em] backdrop-blur-sm",
        styles[status],
      ].join(" ")}
    >
      {status === "live-youtube" || status === "live-official" ? (
        <span className="h-1.5 w-1.5 rounded-full bg-red-400 shadow-[0_0_0_4px_rgba(239,68,68,0.15)]" />
      ) : status === "loading" ? (
        <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-white/70" />
      ) : null}
      {labels[status]}
    </span>
  );
}

function PlayerPlaceholder({
  title,
  subtitle,
  icon,
}: {
  title: string;
  subtitle: string;
  icon: string;
}) {
  return (
    <div className="absolute inset-0 flex flex-col items-center justify-center bg-[radial-gradient(circle_at_center,rgba(239,68,68,0.08),transparent_55%),linear-gradient(135deg,rgba(17,17,17,0.98),rgba(3,3,3,0.96))] px-5 text-center">
      <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-full border border-white/10 bg-white/[0.04] text-2xl text-white/80 shadow-[inset_0_1px_0_rgba(255,255,255,0.08)] sm:mb-5 sm:h-20 sm:w-20 sm:text-3xl">
        {icon}
      </div>
      <h3 className="text-xl font-bold tracking-tight text-white sm:text-2xl">{title}</h3>
      <p className="mt-2 max-w-md text-sm leading-6 text-white/50 sm:mt-3">{subtitle}</p>
    </div>
  );
}

const RATE_LIMIT_COOLDOWN_MS = 5 * 60 * 1000;
const REQUEST_COOLDOWN_MS = 5 * 60 * 1000;

function getCooldownUntil(channelId: number, cooldowns: Record<number, number>) {
  return cooldowns[channelId] ?? 0;
}

function isRateLimited(channelId: number, cooldowns: Record<number, number>) {
  return getCooldownUntil(channelId, cooldowns) > Date.now();
}

function setCooldownUntil(channelId: number, cooldowns: Record<number, number>) {
  cooldowns[channelId] = Date.now() + RATE_LIMIT_COOLDOWN_MS;
}

function getChannelLookupUrl(channel: Channel) {
  if (channel.youtubeChannelId) {
    return `/api/live?channelId=${encodeURIComponent(channel.youtubeChannelId)}`;
  }

  if (channel.youtubeHandle) {
    return `/api/live?handle=${encodeURIComponent(channel.youtubeHandle)}`;
  }

  return null;
}

export default function Home() {
  const [channels, setChannels] = useState<Channel[]>(localChannels);
  const [siteSettings, setSiteSettings] =
    useState<PublicSiteSettings>(defaultPublicSiteSettings);
  const [settingsLoaded, setSettingsLoaded] = useState(false);
  const [activeCategory, setActiveCategory] = useState("All");
  const [searchTerm, setSearchTerm] = useState("");
  const [favoriteFilter, setFavoriteFilter] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [favorites, setFavorites] = useState<number[]>([]);
  const [recentHistory, setRecentHistory] = useState<RecentHistoryItem[]>([]);
  const [hasHydratedStorage, setHasHydratedStorage] = useState(false);
  const [selectedChannel, setSelectedChannel] = useState<Channel>(channels[0]);
  const [hasUserSelectedChannel, setHasUserSelectedChannel] = useState(false);
  const [userRequestedPlayback, setUserRequestedPlayback] = useState(false);
  const [playWithSound, setPlayWithSound] = useState(false);
  const [channelStatuses, setChannelStatuses] = useState<Record<number, ChannelLiveState>>({});
  const [liveVideoId, setLiveVideoId] = useState<string | null>(null);
  const [liveTitle, setLiveTitle] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [officialEmbedUrl, setOfficialEmbedUrl] = useState<string | null>(null);
  const playerRef = useRef<HTMLDivElement>(null);
  const selectedChannelRef = useRef<Channel>(channels[0]);
  const channelStatusesRef = useRef<Record<number, ChannelLiveState>>({});
  const inFlightChannelChecks = useRef<Set<number>>(new Set());
  const rateLimitCooldowns = useRef<Record<number, number>>({});
  const requestCooldowns = useRef<Record<number, boolean>>({});
  const requestCooldownTimers = useRef<
    Record<number, ReturnType<typeof setTimeout>>
  >({});

  useEffect(() => {
    channelStatusesRef.current = channelStatuses;
  }, [channelStatuses]);

  useEffect(() => {
    const timers = requestCooldownTimers.current;

    return () => {
      Object.values(timers).forEach((timer) => {
        clearTimeout(timer);
      });
    };
  }, []);

  useEffect(() => {
  let cancelled = false;

  async function loadChannels() {
    try {
      const response = await fetch("/api/channels", {
        cache: "no-store",
      });

      if (!response.ok) return;

      const payload = (await response.json()) as {
        channels?: Channel[];
      };

      if (
        !cancelled &&
        Array.isArray(payload.channels) &&
        payload.channels.length > 0
      ) {
        setChannels(payload.channels);

        setSelectedChannel((currentSelected) => {
          const refreshedSelected =
            payload.channels?.find(
              (channel) => channel.id === currentSelected.id
            ) ?? payload.channels?.[0];

          if (refreshedSelected) {
            selectedChannelRef.current = refreshedSelected;
            return refreshedSelected;
          }

          return currentSelected;
        });
      }
    } catch {
      // Keep local channel data as fallback.
    }
  }

  void loadChannels();

  return () => {
    cancelled = true;
  };
}, []);
  useEffect(() => {
    let cancelled = false;

    async function loadSettings() {
      try {
        const response = await fetch("/api/settings", {
          cache: "no-store",
        });

        if (!response.ok) return;

        const payload = (await response.json()) as {
          ok?: boolean;
          settings?: PublicSiteSettingsRow;
        };

        if (!payload.ok || !payload.settings || cancelled) return;

        const row = payload.settings;
        const nextSettings: PublicSiteSettings = {
          siteTitle: row.site_title ?? defaultPublicSiteSettings.siteTitle,
          tagline: row.tagline ?? defaultPublicSiteSettings.tagline,
          heroHeading:
            row.hero_heading ?? defaultPublicSiteSettings.heroHeading,
          heroSubheading:
            row.hero_subheading ?? defaultPublicSiteSettings.heroSubheading,
          defaultCategory:
            row.default_category ?? defaultPublicSiteSettings.defaultCategory,
          footerText:
            row.footer_text ?? defaultPublicSiteSettings.footerText,
          maintenanceMode:
            row.maintenance_mode ?? defaultPublicSiteSettings.maintenanceMode,
          globalNoticeEnabled:
            row.global_notice_enabled ??
            defaultPublicSiteSettings.globalNoticeEnabled,
          globalNotice:
            row.global_notice ?? defaultPublicSiteSettings.globalNotice,
        };

        setSiteSettings(nextSettings);
        setActiveCategory(nextSettings.defaultCategory || "All");
      } catch {
        // Keep local defaults as a safe fallback.
      } finally {
        if (!cancelled) {
          setSettingsLoaded(true);
        }
      }
    }

    void loadSettings();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    document.title = siteSettings.siteTitle
      ? `${siteSettings.siteTitle} — Live TV`
      : "VELORA — Live TV";
  }, [siteSettings.siteTitle]);

  useEffect(() => {
    const hydrationTimer = window.setTimeout(() => {
      try {
        const storedFavorites = window.localStorage.getItem(FAVORITES_STORAGE_KEY);
        if (storedFavorites) {
          const parsedFavorites = JSON.parse(storedFavorites);
          if (Array.isArray(parsedFavorites)) {
            setFavorites(
              parsedFavorites.filter(
                (entry): entry is number =>
                  typeof entry === "number" && Number.isFinite(entry)
              )
            );
          }
        }

        const storedRecent = window.localStorage.getItem(RECENT_STORAGE_KEY);
        if (storedRecent) {
          const parsedRecent = JSON.parse(storedRecent);
          if (Array.isArray(parsedRecent)) {
            setRecentHistory(
              parsedRecent
                .filter(
                  (entry): entry is RecentHistoryItem =>
                    !!entry &&
                    typeof entry.channelId === "number" &&
                    Number.isFinite(entry.channelId) &&
                    typeof entry.timestamp === "number" &&
                    Number.isFinite(entry.timestamp)
                )
                .slice(0, MAX_RECENT_ITEMS)
            );
          }
        }
      } catch {
        // Ignore malformed or unavailable local storage.
      } finally {
        setHasHydratedStorage(true);
      }
    }, 0);

    return () => window.clearTimeout(hydrationTimer);
  }, []);

  useEffect(() => {
    if (!hasHydratedStorage) {
      return;
    }

    try {
      window.localStorage.setItem(FAVORITES_STORAGE_KEY, JSON.stringify(favorites));
    } catch {
      // Ignore storage failures.
    }
  }, [favorites, hasHydratedStorage]);

  useEffect(() => {
    if (!hasHydratedStorage) {
      return;
    }

    try {
      window.localStorage.setItem(
        RECENT_STORAGE_KEY,
        JSON.stringify(recentHistory.slice(0, MAX_RECENT_ITEMS))
      );
    } catch {
      // Ignore storage failures.
    }
  }, [recentHistory, hasHydratedStorage]);

  const recentChannels = recentHistory
    .map((entry) => channels.find((channel) => channel.id === entry.channelId))
    .filter((channel): channel is Channel => Boolean(channel));

  const normalizedSearch = searchTerm.trim().toLowerCase();

  const categories = [
    "All",
    ...Array.from(
      new Set(
        channels
          .map((channel) => channel.category.trim())
          .filter(Boolean)
      )
    ).sort((a, b) => a.localeCompare(b)),
  ];

  const effectiveActiveCategory = categories.includes(activeCategory)
    ? activeCategory
    : "All";

  const categoryCounts = channels.reduce<Record<string, number>>(
    (counts, channel) => {
      const categoryName = channel.category.trim();

      if (categoryName) {
        counts[categoryName] = (counts[categoryName] ?? 0) + 1;
      }

      return counts;
    },
    {}
  );

  const filteredChannels = channels.filter((channel) => {
    if (favoriteFilter && !favorites.includes(channel.id)) {
      return false;
    }

    if (
      effectiveActiveCategory !== "All" &&
      channel.category !== effectiveActiveCategory
    ) {
      return false;
    }

    if (!normalizedSearch) {
      return true;
    }

    const searchableText = `${channel.name} ${channel.category} ${channel.description}`.toLowerCase();
    return searchableText.includes(normalizedSearch);
  });

  const syncSelectedChannelView = (channel: Channel, status?: ChannelLiveState) => {
    const selectedSource = getChannelLookupUrl(channel);

    if (!selectedSource) {
      setLiveVideoId(null);
      setLiveTitle("");
      setIsLoading(false);
      setOfficialEmbedUrl(null);
      setError("Live streaming support is coming soon.");
      return;
    }

    if (status?.status === "loading") {
      setLiveVideoId(null);
      setLiveTitle(channel.name);
      setOfficialEmbedUrl(channel.officialEmbedUrl ?? null);
      setError("");
      setIsLoading(true);
      return;
    }

    if (status?.status === "ready") {
      setLiveVideoId(null);
      setLiveTitle("");
      setOfficialEmbedUrl(null);
      setError("");
      setIsLoading(false);
      return;
    }

    if (status?.status === "live-youtube" && status.videoId) {
      setLiveVideoId(status.videoId);
      setLiveTitle(status.title ?? channel.name);
      setOfficialEmbedUrl(null);
      setError("");
      setIsLoading(false);
      return;
    }

    if (status?.status === "live-official") {
      setLiveVideoId(null);
      setLiveTitle(channel.name);
      setOfficialEmbedUrl(channel.officialEmbedUrl ?? null);
      setError("");
      setIsLoading(false);
      return;
    }

    if (status?.status === "offline") {
      if (channel.officialEmbedUrl) {
        setLiveVideoId(null);
        setLiveTitle(channel.name);
        setOfficialEmbedUrl(channel.officialEmbedUrl);
        setError("");
        setIsLoading(false);
        return;
      }

      setLiveVideoId(null);
      setLiveTitle("");
      setOfficialEmbedUrl(null);
      setError("");
      setIsLoading(false);
      return;
    }

    if (status?.status === "error") {
      setLiveVideoId(null);
      setLiveTitle(channel.officialEmbedUrl ? channel.name : "");
      setOfficialEmbedUrl(channel.officialEmbedUrl ?? null);
      setError(
        channel.officialEmbedUrl
          ? "Live status is temporarily unavailable."
          : "Live status is temporarily unavailable."
      );
      setIsLoading(false);
      return;
    }

    setLiveVideoId(null);
    setLiveTitle("");
    setOfficialEmbedUrl(null);
    setError("");
    setIsLoading(false);
  };

  const fetchChannelStatus = async (channel: Channel, requestedByUser = false) => {
    if (!requestedByUser && !userRequestedPlayback && !hasUserSelectedChannel) {
      return;
    }

    const requestUrl = getChannelLookupUrl(channel);

    if (!requestUrl) {
      const nextStatus = { status: "coming-soon" as const };
      setChannelStatuses((prev) => ({
        ...prev,
        [channel.id]: nextStatus,
      }));

      if (channel.id === selectedChannelRef.current.id) {
        syncSelectedChannelView(channel, nextStatus);
      }
      return;
    }

    const cachedStatus = channelStatusesRef.current[channel.id];

    if (
      requestCooldowns.current[channel.id] &&
      cachedStatus &&
      cachedStatus.status !== "loading"
    ) {
      if (channel.id === selectedChannelRef.current.id) {
        syncSelectedChannelView(channel, cachedStatus);
      }
      return;
    }

    if (isRateLimited(channel.id, rateLimitCooldowns.current)) {
      const nextStatus = channel.officialEmbedUrl
        ? ({ status: "live-official" as const })
        : ({ status: "error" as const });
      setChannelStatuses((prev) => ({
        ...prev,
        [channel.id]: nextStatus,
      }));

      if (channel.id === selectedChannelRef.current.id) {
        syncSelectedChannelView(channel, nextStatus);
      }
      return;
    }

    if (inFlightChannelChecks.current.has(channel.id)) {
      return;
    }

    inFlightChannelChecks.current.add(channel.id);

    const nextLoadingStatus = { status: "loading" as const };
    setChannelStatuses((prev) => ({
      ...prev,
      [channel.id]: nextLoadingStatus,
    }));

    if (channel.id === selectedChannelRef.current.id) {
      syncSelectedChannelView(channel, nextLoadingStatus);
    }

    try {
      const response = await fetch(requestUrl, { cache: "no-store" });

      if (response.status === 429) {
        setCooldownUntil(channel.id, rateLimitCooldowns.current);
        const nextStatus = channel.officialEmbedUrl
          ? ({ status: "live-official" as const })
          : ({ status: "error" as const });

        setChannelStatuses((prev) => ({
          ...prev,
          [channel.id]: nextStatus,
        }));

        if (channel.id === selectedChannelRef.current.id) {
          syncSelectedChannelView(channel, nextStatus);
        }
        return;
      }

      if (!response.ok) {
        throw new Error("Request failed");
      }

      const data: LiveVideo & { error?: string; retryAfterSeconds?: number } = await response.json();

      if (data.error === "rate_limited") {
        setCooldownUntil(channel.id, rateLimitCooldowns.current);
        const nextStatus = channel.officialEmbedUrl
          ? ({ status: "live-official" as const })
          : ({ status: "error" as const });

        setChannelStatuses((prev) => ({
          ...prev,
          [channel.id]: nextStatus,
        }));

        if (channel.id === selectedChannelRef.current.id) {
          syncSelectedChannelView(channel, nextStatus);
        }
        return;
      }

      if (data.live && data.videoId) {
        const nextStatus = {
          status: "live-youtube" as const,
          videoId: data.videoId ?? undefined,
          title: data.title ?? channel.name,
        };
        setChannelStatuses((prev) => ({
          ...prev,
          [channel.id]: nextStatus,
        }));

        if (channel.id === selectedChannelRef.current.id) {
          syncSelectedChannelView(channel, nextStatus);
        }
        return;
      }

      if (channel.officialEmbedUrl) {
        const nextStatus = { status: "live-official" as const };
        setChannelStatuses((prev) => ({
          ...prev,
          [channel.id]: nextStatus,
        }));

        if (channel.id === selectedChannelRef.current.id) {
          syncSelectedChannelView(channel, nextStatus);
        }
        return;
      }

      const nextStatus = { status: "offline" as const };
      setChannelStatuses((prev) => ({
        ...prev,
        [channel.id]: nextStatus,
      }));

      if (channel.id === selectedChannelRef.current.id) {
        syncSelectedChannelView(channel, nextStatus);
      }
    } catch {
      const nextStatus = channel.officialEmbedUrl
        ? ({ status: "live-official" as const })
        : ({ status: "error" as const });
      setChannelStatuses((prev) => ({
        ...prev,
        [channel.id]: nextStatus,
      }));

      if (channel.id === selectedChannelRef.current.id) {
        syncSelectedChannelView(channel, nextStatus);
      }
    } finally {
      requestCooldowns.current[channel.id] = true;

      const existingTimer = requestCooldownTimers.current[channel.id];
      if (existingTimer) {
        clearTimeout(existingTimer);
      }

      requestCooldownTimers.current[channel.id] = setTimeout(() => {
        requestCooldowns.current[channel.id] = false;
        delete requestCooldownTimers.current[channel.id];
      }, REQUEST_COOLDOWN_MS);

      inFlightChannelChecks.current.delete(channel.id);
    }
  };

  const updateRecentHistory = (channel: Channel) => {
    setRecentHistory((previous) => {
      const next = previous.filter((entry) => entry.channelId !== channel.id);
      next.unshift({ channelId: channel.id, timestamp: Date.now() });
      return next.slice(0, MAX_RECENT_ITEMS);
    });
  };

  const clearRecentHistory = () => {
    setRecentHistory([]);
  };

  const toggleFavorite = (channel: Channel, event?: React.MouseEvent<HTMLButtonElement>) => {
    event?.stopPropagation();
    setFavorites((previous) =>
      previous.includes(channel.id)
        ? previous.filter((entry) => entry !== channel.id)
        : [...previous, channel.id]
    );
  };

  const handleOpenChannel = async (channel: Channel) => {
    setHasUserSelectedChannel(true);
    setUserRequestedPlayback(true);
    setPlayWithSound(false);
    selectedChannelRef.current = channel;
    setSelectedChannel(channel);
    updateRecentHistory(channel);
    syncSelectedChannelView(channel, channelStatuses[channel.id] ?? { status: "ready" });

    if (isRateLimited(channel.id, rateLimitCooldowns.current)) {
      setUserRequestedPlayback(false);
      const nextStatus = channel.officialEmbedUrl
        ? ({ status: "live-official" as const })
        : ({ status: "error" as const });
      setChannelStatuses((prev) => ({ ...prev, [channel.id]: nextStatus }));
      syncSelectedChannelView(channel, nextStatus);
      return;
    }

    const cachedStatus = channelStatusesRef.current[channel.id];

    if (
      requestCooldowns.current[channel.id] &&
      cachedStatus &&
      cachedStatus.status !== "loading"
    ) {
      setUserRequestedPlayback(false);
      syncSelectedChannelView(channel, cachedStatus);

      setTimeout(() => {
        playerRef.current?.scrollIntoView({
          behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches
            ? "auto"
            : "smooth",
          block: "center",
        });
      }, 100);

      return;
    }

    try {
      await fetchChannelStatus(channel, true);
    } finally {
      setUserRequestedPlayback(false);
    }

    setTimeout(() => {
      playerRef.current?.scrollIntoView({
        behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth",
        block: "center",
      });
    }, 100);
  };

  const selectChannel = (channel: Channel) => {
    handleOpenChannel(channel);
  };

  const selectedHasSource = Boolean(
    selectedChannel.youtubeChannelId || selectedChannel.youtubeHandle
  );
  const selectedStatus = channelStatuses[selectedChannel.id]?.status ?? (
    selectedHasSource ? "ready" : "coming-soon"
  );
  const selectedStatusLabel = {
    ready: "READY",
    loading: "CHECKING",
    "live-youtube": "LIVE",
    "live-official": "LIVE",
    offline: "OFFLINE",
    error: "TEMPORARILY UNAVAILABLE",
    "coming-soon": "COMING SOON",
  }[selectedStatus];

  const heroHeading =
    siteSettings.heroHeading.trim() || "Television, Reimagined.";
  const commaIndex = heroHeading.indexOf(",");
  const heroFirstLine =
    commaIndex >= 0
      ? heroHeading.slice(0, commaIndex + 1).trim()
      : heroHeading;
  const heroSecondLine =
    commaIndex >= 0
      ? heroHeading.slice(commaIndex + 1).trim()
      : "";

  if (settingsLoaded && siteSettings.maintenanceMode) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#050505] px-4 py-8 text-white sm:px-6">
        <div className="w-full max-w-2xl rounded-2xl border border-white/10 bg-[radial-gradient(circle_at_top_right,rgba(220,38,38,0.14),transparent_45%),#0a0a0a] p-6 text-center shadow-[0_25px_80px_rgba(0,0,0,0.45)] sm:rounded-3xl sm:p-12">
          <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-2xl border border-red-500/20 bg-red-600/10 text-2xl">
            ◈
          </div>
          <p className="text-xs font-bold uppercase tracking-[0.28em] text-red-400">
            {siteSettings.siteTitle}
          </p>
          <h1 className="mt-4 text-4xl font-black tracking-tight sm:text-5xl">
            We&apos;ll be right back.
          </h1>
          <p className="mx-auto mt-5 max-w-lg text-sm leading-7 text-white/55 sm:text-base">
            {siteSettings.globalNoticeEnabled && siteSettings.globalNotice
              ? siteSettings.globalNotice
              : "VELORA is temporarily undergoing maintenance. Please check back shortly."}
          </p>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#050505] text-white [button]:touch-manipulation [a]:touch-manipulation">
      <header className="sticky top-0 z-50 border-b border-white/10 bg-black/80 backdrop-blur-xl">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3.5 sm:px-5 sm:py-4 md:px-6">
          <a href="#" className="flex items-center">
            <div className="relative h-9 w-24 overflow-hidden rounded-md sm:h-10 sm:w-28 md:h-12 md:w-32">
              <div className="absolute inset-0 bg-gradient-to-r from-red-600/10 via-transparent to-transparent" />
              <Image
                src="/velora-logo.png"
                alt={siteSettings.siteTitle || "VELORA"}
                width={128}
                height={48}
                priority
                className="h-full w-full object-contain object-left scale-[1.18]"
              />
            </div>
          </a>

          <nav className="hidden items-center gap-8 text-sm font-medium text-white/60 md:flex">
            <a href="#" className="text-white transition duration-300 hover:text-red-500">
              Home
            </a>

            <a href="#live" className="transition duration-300 hover:text-red-500">
              Live TV
            </a>

            <a href="#categories" className="transition duration-300 hover:text-red-500">
              Categories
            </a>

            <a href="#about" className="transition duration-300 hover:text-red-500">
              About
            </a>
          </nav>

          <a
            href="#player"
            className="hidden rounded-full bg-red-600 px-5 py-2.5 text-sm font-bold transition duration-300 hover:scale-105 hover:bg-red-500 md:block"
          >
            Watch Live
          </a>

          <button
            type="button"
            aria-label={isMobileMenuOpen ? "Close menu" : "Open menu"}
            aria-expanded={isMobileMenuOpen}
            onClick={() => setIsMobileMenuOpen((current) => !current)}
            className="flex h-10 w-10 items-center justify-center rounded-lg border border-white/10 bg-white/[0.04] text-white/75 transition hover:border-white/20 hover:bg-white/[0.08] hover:text-white focus:outline-none focus:ring-2 focus:ring-red-500/50 md:hidden"
          >
            <span className="sr-only">Menu</span>
            <span className="flex w-5 flex-col gap-1.5" aria-hidden="true">
              <span className="h-0.5 w-full bg-current" />
              <span className="h-0.5 w-full bg-current" />
              <span className="h-0.5 w-full bg-current" />
            </span>
          </button>
        </div>

        {isMobileMenuOpen ? (
          <nav className="border-t border-white/10 bg-[#090909]/95 px-4 py-3 shadow-2xl backdrop-blur-xl sm:px-5 md:hidden" aria-label="Mobile navigation">
            {[
              ["Home", "#"],
              ["Live TV", "#live"],
              ["Categories", "#categories"],
              ["About", "#about"],
              ["Watch Live", "#player"],
            ].map(([label, href]) => (
              <a
                key={label}
                href={href}
                onClick={() => setIsMobileMenuOpen(false)}
                className="block min-h-12 border-b border-white/5 px-2 py-3.5 text-sm font-semibold text-white/75 transition last:border-b-0 hover:text-white focus:outline-none focus:ring-2 focus:ring-red-500/50"
              >
                {label}
              </a>
            ))}
          </nav>
        ) : null}
      </header>

      {siteSettings.globalNoticeEnabled && siteSettings.globalNotice ? (
        <div className="border-b border-red-500/20 bg-red-600/10">
          <div className="mx-auto flex max-w-7xl items-start gap-3 px-4 py-3 text-xs leading-5 text-red-100/85 sm:px-5 sm:text-sm md:px-6">
            <span
              className="mt-1 h-2 w-2 shrink-0 rounded-full bg-red-400"
              aria-hidden="true"
            />
            <p className="leading-6">{siteSettings.globalNotice}</p>
          </div>
        </div>
      ) : null}

      <section className="relative overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(220,38,38,0.18),transparent_35%),radial-gradient(circle_at_bottom_left,rgba(255,255,255,0.04),transparent_35%)]" />

        <div className="relative mx-auto grid min-h-0 max-w-7xl items-center gap-6 px-4 pb-8 pt-5 sm:gap-8 sm:px-5 sm:pb-12 sm:pt-10 md:px-6 lg:min-h-[82vh] lg:grid-cols-[1.05fr_1.2fr] lg:gap-12 lg:pt-16 xl:pt-20">
          <div className="order-2 lg:order-1">
            <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-red-500/30 bg-red-500/10 px-3 py-2 text-[10px] font-semibold uppercase tracking-[0.22em] text-red-300 sm:mb-7 sm:px-4 sm:text-xs sm:tracking-[0.28em]">
              <span className="h-2.5 w-2.5 animate-pulse rounded-full bg-red-500" />
              Live TV Experience
            </div>

            <h1 className="max-w-3xl text-[2.35rem] font-black leading-[1.01] tracking-[-0.045em] min-[390px]:text-[2.7rem] sm:text-5xl md:text-6xl xl:text-7xl">
              {heroFirstLine}
              {heroSecondLine ? (
                <span className="mt-2 block bg-gradient-to-r from-white via-white to-red-500 bg-clip-text text-transparent">
                  {heroSecondLine}
                </span>
              ) : null}
            </h1>

            <p className="mt-4 max-w-xl text-[14px] leading-6 text-white/60 sm:mt-6 sm:text-lg sm:leading-8">
              {siteSettings.heroSubheading}
            </p>

            <div className="mt-5 grid grid-cols-2 gap-2.5 sm:mt-8 sm:flex sm:flex-row sm:flex-wrap sm:gap-4">
              <a
                href="#player"
                className="flex min-h-11 items-center justify-center gap-2 rounded-full bg-red-600 px-4 py-3 text-xs font-bold tracking-[0.02em] transition duration-300 hover:bg-red-500 sm:min-h-12 sm:inline-flex sm:px-7 sm:py-3.5 sm:text-sm"
              >
                <span>▶</span>
                Watch Live
              </a>

              <a
                href="#categories"
                className="flex min-h-11 items-center justify-center rounded-full border border-white/10 bg-white/5 px-4 py-3 text-center text-xs font-semibold text-white/90 transition duration-300 hover:border-white/20 hover:bg-white/10 sm:min-h-12 sm:px-7 sm:py-3.5 sm:text-sm"
              >
                Browse Channels
              </a>
            </div>
          </div>

          <div
            id="player"
            ref={playerRef}
            className={`relative order-1 scroll-mt-20 transition duration-500 sm:scroll-mt-28 lg:order-2 ${
              hasUserSelectedChannel ? "rounded-3xl ring-1 ring-red-500/30" : ""
            }`}
          >
            <div className="absolute -inset-4 rounded-full bg-red-600/10 blur-3xl sm:-inset-8" />

            <div className="relative overflow-hidden rounded-[1.35rem] border border-white/10 bg-[#090909] p-2 shadow-[0_18px_45px_rgba(0,0,0,0.45)] sm:rounded-3xl sm:p-3">
              <div className="mb-2 flex min-w-0 items-center justify-between gap-2 rounded-xl border border-white/10 bg-white/[0.02] px-2.5 py-2 sm:mb-3 sm:rounded-2xl sm:px-3 sm:py-2.5">
                <div className="flex min-w-0 items-center gap-3">
                  <ChannelIdentity channel={selectedChannel} compact />
                  <div className="min-w-0">
                    {hasUserSelectedChannel ? (
                      <div className="mb-1 text-[9px] font-bold uppercase tracking-[0.22em] text-red-400/80">
                        Now Watching
                      </div>
                    ) : null}
                    <div className="truncate text-sm font-semibold text-white">{selectedChannel.name}</div>
                    <div className="text-[10px] uppercase tracking-[0.22em] text-white/45">
                      {selectedChannel.category}
                    </div>
                  </div>
                </div>

                <div className="shrink-0">
                  <span
                    className={`rounded-full border px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] ${
                      selectedStatus === "live-youtube" || selectedStatus === "live-official"
                        ? "border-red-500/30 bg-red-600/10 text-red-200"
                        : selectedStatus === "error"
                          ? "border-amber-400/20 bg-amber-400/5 text-amber-200/75"
                          : "border-white/10 bg-white/[0.03] text-white/55"
                    }`}
                  >
                    {selectedStatusLabel}
                  </span>
                </div>
              </div>

              <div className="relative aspect-video min-h-[180px] overflow-hidden rounded-xl bg-black sm:min-h-0 sm:rounded-2xl">
                {liveVideoId ? (
                  playWithSound ? (
                    <iframe
                      key={`${liveVideoId}-sound`}
                      className="h-full w-full"
                      src={`https://www.youtube.com/embed/${liveVideoId}?autoplay=1&mute=0&controls=1&rel=0&playsinline=1`}
                      title={`${selectedChannel.name} Live`}
                      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                      allowFullScreen
                    />
                  ) : (
                    <button
                      type="button"
                      onClick={() => setPlayWithSound(true)}
                      className="absolute inset-0 z-20 flex h-full w-full flex-col items-center justify-center bg-[radial-gradient(circle_at_center,rgba(220,38,38,0.14),transparent_50%),linear-gradient(145deg,#111,#050505)] px-5 text-center transition hover:bg-[#0c0c0c] focus:outline-none focus:ring-2 focus:ring-inset focus:ring-red-500/50"
                      aria-label={`Play ${selectedChannel.name} with sound`}
                    >
                      <span className="flex h-16 w-16 items-center justify-center rounded-full border border-red-400/30 bg-red-600 text-2xl text-white shadow-[0_12px_30px_rgba(220,38,38,0.28)] sm:h-20 sm:w-20 sm:text-3xl">
                        ▶
                      </span>
                      <span className="mt-4 text-lg font-black tracking-tight text-white sm:text-2xl">
                        Tap to play with sound
                      </span>
                      <span className="mt-1.5 max-w-sm text-xs leading-5 text-white/50 sm:text-sm">
                        Audio starts after your tap so mobile browsers allow sound.
                      </span>
                    </button>
                  )
                ) : officialEmbedUrl ? (
                  <iframe
                    key={officialEmbedUrl}
                    className="h-full w-full"
                    src={officialEmbedUrl}
                    title={`${selectedChannel.name} Official Live`}
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share; fullscreen"
                    allowFullScreen
                    referrerPolicy="strict-origin-when-cross-origin"
                  />
                ) : !hasUserSelectedChannel && !isLoading && !error ? (
                  <PlayerPlaceholder
                    title="Choose a channel to start watching"
                    subtitle="Select from live Pakistani television channels below."
                    icon="▶"
                  />
                ) : isLoading ? (
                  <PlayerPlaceholder
                    title="Checking live broadcast..."
                    subtitle="Please wait while we verify the current stream status."
                    icon="…"
                  />
                ) : error ? (
                  <PlayerPlaceholder
                    title={selectedStatus === "coming-soon" ? selectedChannel.name : "Live status is temporarily unavailable."}
                    subtitle={
                      selectedStatus === "coming-soon"
                        ? "Live streaming support is coming soon."
                        : "Please try again shortly."
                    }
                    icon="!"
                  />
                ) : (
                  <PlayerPlaceholder
                    title={selectedStatus === "offline" ? "This channel is not live right now." : selectedChannel.name}
                    subtitle={
                      selectedStatus === "offline"
                        ? "Please check again later."
                        : selectedStatus === "coming-soon"
                          ? "Live streaming support is coming soon."
                          : "Preparing live stream..."
                    }
                    icon={selectedStatus === "offline" ? "◌" : "▶"}
                  />
                )}
              </div>

              <div className="flex items-center justify-between gap-4 px-1.5 pb-1 pt-2.5 sm:pt-4">
                <div>
                  <h2 className="text-base font-bold tracking-tight sm:text-xl">{selectedChannel.name}</h2>

                  <p className="mt-1 text-sm text-white/40">
                    {selectedChannel.category} • Pakistan
                  </p>

                  {liveTitle && !isLoading && (
                    <p className="mt-1 max-w-[20rem] truncate text-xs text-white/50">
                      {liveTitle}
                    </p>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section id="categories" className="mx-auto max-w-7xl scroll-mt-20 px-4 py-8 sm:px-5 sm:py-14 md:px-6 md:scroll-mt-28">
        <div className="mb-5 flex flex-col justify-between gap-2.5 sm:mb-9 sm:gap-4 md:flex-row md:items-end md:gap-5">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.28em] text-red-500 sm:text-sm sm:tracking-[0.3em]">
              Live Television
            </p>

            <h2 className="mt-2 text-[2rem] font-black tracking-tight sm:mt-3 sm:text-3xl md:text-4xl">
              Explore Channels
            </h2>
          </div>

          <p className="max-w-md text-sm leading-6 text-white/50 sm:leading-7">
            Pakistan&apos;s leading television channels in one premium viewing experience.
          </p>
        </div>

        <div className="mb-5 flex flex-col gap-2.5 rounded-2xl border border-white/10 bg-[#0b0b0b] p-2.5 sm:mb-6 sm:gap-3 sm:p-3.5 lg:flex-row lg:items-center lg:justify-between">
          <label className="relative block w-full lg:max-w-md">
            <span className="sr-only">Search channels</span>
            <svg
              aria-hidden="true"
              viewBox="0 0 24 24"
              className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-white/45"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <circle cx="11" cy="11" r="6" />
              <path d="M16 16L21 21" />
            </svg>
            <input
              type="search"
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
              placeholder="Search channels..."
              aria-label="Search channels"
              className="h-12 w-full rounded-xl border border-white/10 bg-[#151515] pl-11 pr-11 text-sm text-white placeholder:text-white/40 shadow-inner shadow-black/20 transition focus:border-red-500/60 focus:outline-none focus:ring-2 focus:ring-red-500/20"
            />
            {searchTerm ? (
              <button
                type="button"
                onClick={() => setSearchTerm("")}
                aria-label="Clear search"
                className="absolute right-2 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full border border-white/10 bg-white/5 text-lg text-white/65 transition hover:border-white/20 hover:bg-white/10 hover:text-white focus:outline-none focus:ring-2 focus:ring-red-500/30"
              >
                ×
              </button>
            ) : null}
          </label>

          <div className="-mx-1 flex snap-x snap-mandatory gap-2 overflow-x-auto px-1 pb-1 pr-6 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden lg:mx-0 lg:flex-wrap lg:overflow-visible lg:px-0 lg:pb-0 lg:pr-0">
            {categories.map((category) => {
              const count =
                category === "All"
                  ? channels.length
                  : categoryCounts[category] ?? 0;

              return (
                <button
                  key={category}
                  type="button"
                  onClick={() => setActiveCategory(category)}
                  aria-pressed={effectiveActiveCategory === category}
                  className={`inline-flex h-11 shrink-0 snap-start items-center gap-2 rounded-full border px-4 text-sm font-semibold transition duration-300 ${
                    effectiveActiveCategory === category
                      ? "border-red-500/30 bg-red-600 text-white shadow-[0_10px_25px_rgba(220,38,38,0.18)]"
                      : "border-white/10 bg-white/[0.03] text-white/60 hover:border-white/20 hover:bg-white/[0.06] hover:text-white"
                  }`}
                >
                  <span>{category}</span>
                  <span
                    className={
                      effectiveActiveCategory === category
                        ? "text-white/75"
                        : "text-white/30"
                    }
                  >
                    {count}
                  </span>
                </button>
              );
            })}
            <button
              type="button"
              onClick={() => setFavoriteFilter((current) => !current)}
              className={`inline-flex h-11 shrink-0 snap-start items-center gap-2 rounded-full border px-4 text-sm font-semibold transition duration-300 ${
                favoriteFilter
                  ? "border-red-500/30 bg-red-600 text-white shadow-[0_10px_25px_rgba(220,38,38,0.18)]"
                  : "border-white/10 bg-white/[0.03] text-white/60 hover:border-white/20 hover:bg-white/[0.06] hover:text-white"
              }`}
              aria-pressed={favoriteFilter}
            >
              <svg
                aria-hidden="true"
                viewBox="0 0 24 24"
                fill={favoriteFilter ? "currentColor" : "none"}
                stroke="currentColor"
                strokeWidth="1.8"
                className="h-4 w-4"
              >
                <path d="M12 20.25s-7.5-4.35-9.25-8.49C1.29 9.15 3.02 5.25 6.74 5.25c2.17 0 3.39 1.06 4.05 2.07.66-.99 1.88-2.07 4.05-2.07 3.72 0 5.45 3.9 4 6.51-1.75 4.14-9.25 8.49-9.25 8.49Z" />
              </svg>
              <span>Favorites</span>
              <span className={favoriteFilter ? "text-white/75" : "text-white/35"}>{favorites.length}</span>
            </button>
          </div>
        </div>

        {favoriteFilter && favorites.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-white/15 bg-[#0a0a0a] px-4 py-11 text-center sm:px-6 sm:py-14">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full border border-red-500/20 bg-red-600/10 text-red-300">
              <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-5 w-5">
                <path d="M12 20.25s-7.5-4.35-9.25-8.49C1.29 9.15 3.02 5.25 6.74 5.25c2.17 0 3.39 1.06 4.05 2.07.66-.99 1.88-2.07 4.05-2.07 3.72 0 5.45 3.9 4 6.51-1.75 4.14-9.25 8.49-9.25 8.49Z" />
              </svg>
            </div>
            <p className="mt-4 text-2xl font-bold tracking-tight text-white">No favorites yet</p>
            <p className="mt-3 text-sm text-white/55">Save channels you watch often for quick access.</p>
            <button
              type="button"
              onClick={() => setFavoriteFilter(false)}
              className="mt-6 rounded-full border border-white/10 bg-white/[0.03] px-4 py-2 text-sm font-semibold text-white/70 transition hover:border-white/20 hover:bg-white/[0.06] hover:text-white focus:outline-none focus:ring-2 focus:ring-red-500/30"
            >
              Browse all channels
            </button>
          </div>
        ) : filteredChannels.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-white/15 bg-[#0a0a0a] px-4 py-12 text-center sm:px-6 sm:py-16">
            <p className="text-2xl font-bold tracking-tight text-white">No channels found</p>
            <p className="mt-3 text-sm text-white/55">Try another search or category.</p>
          </div>
        ) : null}
      </section>

      {recentChannels.length > 0 ? (
        <section className="mx-auto max-w-7xl px-4 pb-8 sm:px-5 md:px-6">
          <div className="mb-4 flex items-end justify-between gap-3">
            <div className="min-w-0">
              <p className="text-xs font-bold uppercase tracking-[0.28em] text-red-500 sm:text-sm sm:tracking-[0.3em]">
                Recently Watched
              </p>
              <h2 className="mt-1.5 text-2xl font-black tracking-tight md:text-3xl">
                Continue Watching
              </h2>
            </div>
            <button
              type="button"
              onClick={clearRecentHistory}
              className="shrink-0 rounded-full border border-white/10 bg-transparent px-3 py-2 text-[9px] font-semibold uppercase tracking-[0.16em] text-white/45 transition hover:border-white/20 hover:bg-white/[0.04] hover:text-white focus:outline-none focus:ring-2 focus:ring-red-500/30 sm:text-[10px] sm:tracking-[0.2em]"
            >
              Clear history
            </button>
          </div>

          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
            {recentChannels.map((channel) => (
              <button
                key={channel.id}
                type="button"
                onClick={() => handleOpenChannel(channel)}
                className="group flex min-h-[76px] items-center gap-3 rounded-xl border border-white/10 bg-[#0a0a0a] p-3 text-left transition hover:-translate-y-0.5 hover:border-red-500/40 hover:bg-[#0d0d0d] focus:outline-none focus:ring-2 focus:ring-red-500/30"
              >
                <div className="relative shrink-0">
                  <ChannelIdentity channel={channel} compact />
                </div>

                <div className="min-w-0 flex-1">
                  <div className="text-sm font-semibold leading-5 text-white sm:truncate">{channel.name}</div>
                  <div className="mt-1 truncate text-[10px] uppercase tracking-[0.18em] text-white/40">
                    {channel.category}
                  </div>
                </div>

                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-white/10 bg-white/[0.03] text-sm text-white/55 transition group-hover:border-red-500/30 group-hover:bg-red-600/10 group-hover:text-red-200">
                  ▶
                </span>
              </button>
            ))}
          </div>
        </section>
      ) : null}

      <section id="live" className="mx-auto max-w-7xl scroll-mt-24 px-4 pb-20 pt-4 sm:px-5 sm:pb-24 md:px-6 md:scroll-mt-28">
        <div className="mb-7 flex items-end justify-between gap-4 sm:mb-9">
          <div>
            <p className="text-sm font-bold uppercase tracking-[0.3em] text-red-500">
              Live Channels
            </p>

            <h2 className="mt-2.5 text-3xl font-black tracking-tight sm:mt-3 md:text-4xl">
              Watch What&apos;s Live
            </h2>
          </div>

          <p className="hidden text-sm text-white/45 sm:block">
            {filteredChannels.length} {filteredChannels.length === 1 ? "channel" : "channels"}
          </p>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 sm:gap-5 lg:grid-cols-3 xl:grid-cols-4">
          {filteredChannels.map((channel) => {
            const hasSource = Boolean(channel.youtubeChannelId || channel.youtubeHandle);
            const status = channelStatuses[channel.id] ?? {
              status: hasSource ? "ready" : "coming-soon",
            };

            const buttonText =
              status.status === "loading" ? "Checking Channel" : "Watch Live";
            const isFavorited = favorites.includes(channel.id);

            return (
              <article
                key={channel.id}
                className={`group overflow-hidden rounded-2xl border bg-[#090909] transition-all duration-300 hover:border-white/20 motion-safe:hover:-translate-y-1 ${
                  selectedChannel.id === channel.id
                    ? "border-red-500/50 bg-[#0d0d0d] shadow-[0_12px_30px_rgba(220,38,38,0.12)]"
                    : "border-white/10"
                }`}
              >
                <div className="relative aspect-video overflow-hidden bg-gradient-to-br from-[#161616] via-[#090909] to-black">
                  <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(239,68,68,0.08),transparent_45%)]" />

                  <div className="absolute left-3 top-3 z-20 sm:left-4 sm:top-4">
                    <StatusBadge status={status.status} />
                  </div>

                  <button
                    type="button"
                    onClick={(event) => toggleFavorite(channel, event)}
                    aria-label={
                      isFavorited
                        ? `Remove ${channel.name} from favorites`
                        : `Add ${channel.name} to favorites`
                    }
                    className={`absolute right-3 top-3 z-30 flex h-11 w-11 items-center justify-center rounded-full border bg-black/45 text-lg transition duration-300 focus:outline-none focus:ring-2 focus:ring-red-500/40 sm:right-4 sm:top-4 ${
                      isFavorited
                        ? "border-red-500/50 bg-red-600/15 text-red-300"
                        : "border-white/15 text-white/55 hover:border-red-500/40 hover:bg-red-600/10 hover:text-red-200"
                    }`}
                  >
                    <svg
                      aria-hidden="true"
                      viewBox="0 0 24 24"
                      fill={isFavorited ? "currentColor" : "none"}
                      stroke="currentColor"
                      strokeWidth="1.8"
                      className="h-4 w-4"
                    >
                      <path d="M12 20.25s-7.5-4.35-9.25-8.49C1.29 9.15 3.02 5.25 6.74 5.25c2.17 0 3.39 1.06 4.05 2.07.66-.99 1.88-2.07 4.05-2.07 3.72 0 5.45 3.9 4 6.51-1.75 4.14-9.25 8.49-9.25 8.49Z" />
                    </svg>
                  </button>

                  <div className="absolute inset-0 flex items-center justify-center p-3 sm:p-4">
                    <div className="relative flex h-full w-full items-center justify-center overflow-hidden rounded-[1.05rem] border border-white/5 bg-[radial-gradient(circle_at_center,rgba(239,68,68,0.06),transparent_45%),linear-gradient(180deg,rgba(13,13,13,0.8),rgba(5,5,5,0.98))]">
                      <ChannelIdentity channel={channel} />
                    </div>
                  </div>

                  <div className="pointer-events-none absolute inset-x-0 bottom-0 z-10 h-20 bg-gradient-to-t from-black/70 to-transparent" />

                  <button
                    type="button"
                    onClick={() => selectChannel(channel)}
                    aria-label={`Open ${channel.name}`}
                    className="absolute bottom-3 right-3 z-20 flex h-12 w-12 items-center justify-center rounded-full border border-white/10 bg-black/45 text-lg text-white/70 shadow-lg shadow-black/30 transition duration-300 hover:border-red-400/40 hover:bg-red-600 hover:text-white sm:bottom-4 sm:right-4 sm:h-11 sm:w-11"
                  >
                    ▶
                  </button>
                </div>

                <div className="p-4 sm:p-5">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <h3 className="text-lg font-bold tracking-tight text-white sm:text-xl">{channel.name}</h3>
                      <p className="mt-1 text-xs uppercase tracking-[0.22em] text-white/40">{channel.category}</p>
                    </div>

                    {selectedChannel.id === channel.id && (
                      <span className="rounded-full border border-red-500/30 bg-red-600/10 px-2 py-1 text-[9px] font-semibold uppercase tracking-[0.24em] text-red-200">
                        Selected
                      </span>
                    )}
                  </div>

                  <p className="mt-3 min-h-0 text-sm leading-6 text-white/60 sm:min-h-[3rem]">
                    {channel.description}
                  </p>

                  <button
                    type="button"
                    onClick={() => selectChannel(channel)}
                    className={`mt-5 min-h-12 w-full rounded-xl border px-4 py-3 text-sm font-bold transition duration-300 ${
                      status.status === "live-youtube" || status.status === "live-official"
                        ? "border-red-500/40 bg-red-600 text-white hover:bg-red-500"
                        : "border-white/10 bg-white/[0.03] text-white/70 hover:border-white/20 hover:bg-white/[0.06] hover:text-white"
                    }`}
                  >
                    {buttonText}
                  </button>
                </div>
              </article>
            );
          })}
        </div>
      </section>

      <section id="about" className="border-y border-white/10 bg-[#080808]">
        <div className="mx-auto grid max-w-7xl gap-8 px-4 py-12 sm:px-5 sm:py-14 md:grid-cols-3 md:px-6 md:py-16">
          <div>
            <div className="mb-5 text-3xl text-white/80">◈</div>
            <h3 className="text-xl font-bold text-white">Premium Experience</h3>
            <p className="mt-3 text-sm leading-7 text-white/65">
              A cinematic dark interface designed to feel like a modern
              international streaming platform.
            </p>
          </div>

          <div>
            <div className="mb-5 text-3xl text-white/80">●</div>
            <h3 className="text-xl font-bold text-white">Live Streaming</h3>
            <p className="mt-3 text-sm leading-7 text-white/65">
              VELORA is designed to support official embeddable players and
              authorized live streaming sources.
            </p>
          </div>

          <div>
            <div className="mb-5 text-3xl text-white/80">◇</div>
            <h3 className="text-xl font-bold text-white">Responsive Design</h3>
            <p className="mt-3 text-sm leading-7 text-white/65">
              Built for desktop, tablet and mobile devices using Next.js and
              Tailwind CSS.
            </p>
          </div>
        </div>
      </section>

      <footer className="bg-black">
        <div className="mx-auto flex max-w-7xl flex-col gap-5 px-4 py-9 text-sm text-white/50 sm:flex-row sm:items-center sm:justify-between sm:px-5 md:px-6 md:py-10">
          <div>
            <p className="font-semibold text-white/80">
              {siteSettings.siteTitle || "VELORA"}
            </p>
            <p className="mt-1 text-white/60">
              {siteSettings.footerText || siteSettings.tagline}
            </p>
          </div>

          <div className="flex flex-col gap-1 sm:items-end">
            <p className="text-white/55">Portfolio streaming platform demo.</p>
            <p className="text-white/45">Built with Next.js + Tailwind CSS</p>
          </div>
        </div>
      </footer>
    </main>
  );
}
