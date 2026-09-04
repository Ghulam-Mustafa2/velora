"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { channels as localChannels, type Channel } from "@/data/channels";
import { createSupabaseAuthBrowserClient } from "@/lib/supabase/auth-client";

type SourceType = "YouTube" | "Official Embed" | "Coming Soon";
type AccessType = "free" | "paid";

type PlanOption = {
  id: string;
  name: string;
  slug: string;
  price: number;
  duration_days: number;
};

type AdminPlan = PlanOption & {
  description: string;
  isActive: boolean;
  sortOrder: number;
};

type PlanDraft = {
  name: string;
  slug: string;
  description: string;
  price: string;
  durationDays: string;
  sortOrder: string;
  isActive: boolean;
};

type AdminPaymentRequest = {
  id: string;
  userId: string;
  userEmail: string;
  displayName: string;
  planId: string;
  planName: string;
  paymentMethodId: string;
  paymentMethodName: string;
  amount: number;
  transactionReference: string | null;
  receiptPath: string | null;
  receiptUrl: string | null;
  status: "pending" | "approved" | "rejected";
  adminNote: string | null;
  submittedAt: string;
  reviewedAt: string | null;
};

type AdminPaymentMethod = {
  id: string;
  name: string;
  slug: string;
  accountTitle: string;
  accountNumber: string;
  iban: string;
  instructions: string;
  isActive: boolean;
  sortOrder: number;
};

type AdminChannel = {
  id: number;
  databaseId: string | null;
  name: string;
  category: string;
  description: string;
  sourceType: SourceType;
  sourceValue: string;
  logoPath: string;
  comingSoon: boolean;
  isActive: boolean;
  updatedAt: string | null;
  accessType: AccessType;
  requiredPlanId: string | null;
};

type ChannelForm = Omit<
  AdminChannel,
  "id" | "databaseId" | "isActive" | "updatedAt"
>;

type SiteSettings = {
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

type SiteSettingsRow = {
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

type AdminChannelRow = {
  id: string;
  key?: string;
  name: string;
  category: string;
  description: string;
  youtube_channel_id: string | null;
  youtube_handle: string | null;
  official_embed_url: string | null;
  logo_local: string | null;
  coming_soon: boolean;
  is_active?: boolean;
  sort_order?: number;
  updated_at?: string | null;
  access_type?: AccessType | null;
  required_plan_id?: string | null;
};

function getSourceType(channel: Channel): SourceType {
  if (channel.comingSoon) return "Coming Soon";
  if (channel.youtubeChannelId || channel.youtubeHandle) return "YouTube";
  if (channel.officialEmbedUrl) return "Official Embed";
  return "Coming Soon";
}

function toAdminChannel(channel: Channel): AdminChannel {
  const sourceType = getSourceType(channel);

  return {
    id: channel.id,
    databaseId: null,
    name: channel.name,
    category: channel.category,
    description: channel.description,
    sourceType,
    sourceValue:
      channel.youtubeChannelId ??
      channel.youtubeHandle ??
      channel.officialEmbedUrl ??
      "",
    logoPath: channel.logoLocal ?? "",
    comingSoon: sourceType === "Coming Soon",
    isActive: true,
    updatedAt: null,
    accessType: "free",
    requiredPlanId: null,
  };
}

function toAdminChannelRow(
  row: AdminChannelRow,
  fallbackId: number
): AdminChannel {
  const sourceType: SourceType = row.coming_soon
    ? "Coming Soon"
    : row.official_embed_url
      ? "Official Embed"
      : "YouTube";

  return {
    id:
      typeof row.sort_order === "number" && Number.isFinite(row.sort_order)
        ? row.sort_order
        : fallbackId,
    databaseId: row.id,
    name: row.name,
    category: row.category,
    description: row.description,
    sourceType,
    sourceValue:
      row.official_embed_url ??
      row.youtube_handle ??
      row.youtube_channel_id ??
      "",
    logoPath: row.logo_local ?? "",
    comingSoon: row.coming_soon,
    isActive: row.is_active ?? true,
    updatedAt: row.updated_at ?? null,
    accessType: row.access_type === "paid" ? "paid" : "free",
    requiredPlanId: row.required_plan_id ?? null,
  };
}

const initialChannels = localChannels.map(toAdminChannel);

const emptyForm: ChannelForm = {
  name: "",
  category: "News",
  description: "",
  sourceType: "YouTube",
  sourceValue: "",
  logoPath: "",
  comingSoon: false,
  accessType: "free",
  requiredPlanId: null,
};

const defaultSiteSettings: SiteSettings = {
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

function ConfigBadge({
  children,
  tone = "neutral",
}: {
  children: string;
  tone?: "neutral" | "red" | "amber";
}) {
  const toneClass =
    tone === "red"
      ? "border-red-500/30 bg-red-600/10 text-red-200"
      : tone === "amber"
        ? "border-amber-400/20 bg-amber-400/5 text-amber-200/80"
        : "border-white/10 bg-white/[0.04] text-white/55";

  return (
    <span
      className={`inline-flex rounded-full border px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] ${toneClass}`}
    >
      {children}
    </span>
  );
}

function StatCard({
  label,
  value,
  detail,
}: {
  label: string;
  value: number;
  detail: string;
}) {
  return (
    <div className="rounded-2xl border border-white/10 bg-[#0b0b0b] p-5 shadow-[0_14px_35px_rgba(0,0,0,0.2)]">
      <p className="text-xs font-semibold uppercase tracking-[0.2em] text-white/40">
        {label}
      </p>
      <div className="mt-4 flex items-end justify-between gap-3">
        <p className="text-3xl font-black tracking-tight text-white">{value}</p>
        <span className="text-xs text-white/35">{detail}</span>
      </div>
    </div>
  );
}

function ChannelFormModal({
  channel,
  onClose,
  onSubmit,
  isSaving,
  saveError,
  isPersistentEdit,
  onLogoUpload,
  isUploadingLogo,
  logoUploadError,
  plans,
}: {
  channel: ChannelForm | null;
  onClose: () => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void | Promise<void>;
  isSaving: boolean;
  saveError: string;
  isPersistentEdit: boolean;
  onLogoUpload: (file: File) => Promise<string | null>;
  isUploadingLogo: boolean;
  logoUploadError: string;
  plans: PlanOption[];
}) {
  const [logoPreview, setLogoPreview] = useState(
    channel?.logoPath ?? ""
  );
  const [accessType, setAccessType] = useState<AccessType>(
    channel?.accessType ?? "free"
  );

  if (!channel) return null;

  const initials = channel.name
    .split(" ")
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/75 p-0 backdrop-blur-sm sm:items-center sm:p-6"
      role="dialog"
      aria-modal="true"
      aria-labelledby="channel-form-title"
    >
      <div className="max-h-[92vh] w-full max-w-2xl overflow-y-auto rounded-t-3xl border border-white/10 bg-[#101010] p-6 shadow-2xl sm:rounded-3xl sm:p-8">
        <div className="flex items-start justify-between gap-5">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.25em] text-red-400">
              Channel workspace
            </p>
            <h2
              id="channel-form-title"
              className="mt-2 text-2xl font-black tracking-tight text-white"
            >
              {isPersistentEdit ? "Edit channel" : "Add channel"}
            </h2>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Close channel form"
            disabled={isSaving}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-white/10 text-xl text-white/55 transition hover:border-white/25 hover:text-white focus:outline-none focus:ring-2 focus:ring-red-500/50 disabled:cursor-not-allowed disabled:opacity-50"
          >
            ×
          </button>
        </div>

        <form className="mt-7 space-y-5" onSubmit={onSubmit}>
          <div className="grid gap-5 sm:grid-cols-2">
            <label className="space-y-2 text-sm text-white/65">
              Channel Name
              <input
                name="name"
                defaultValue={channel.name}
                required
                className="h-11 w-full rounded-xl border border-white/10 bg-[#171717] px-3 text-white outline-none transition focus:border-red-500/60 focus:ring-2 focus:ring-red-500/20"
              />
            </label>

            <label className="space-y-2 text-sm text-white/65">
              Category
              <input
                name="category"
                defaultValue={channel.category}
                required
                className="h-11 w-full rounded-xl border border-white/10 bg-[#171717] px-3 text-white outline-none transition focus:border-red-500/60 focus:ring-2 focus:ring-red-500/20"
              />
            </label>
          </div>

          <label className="block space-y-2 text-sm text-white/65">
            Description
            <textarea
              name="description"
              defaultValue={channel.description}
              rows={3}
              className="w-full resize-y rounded-xl border border-white/10 bg-[#171717] px-3 py-3 text-white outline-none transition focus:border-red-500/60 focus:ring-2 focus:ring-red-500/20"
            />
          </label>

          <div className="rounded-2xl border border-red-500/15 bg-red-600/[0.035] p-4">
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-red-300">
              Channel access
            </p>
            <p className="mt-2 text-xs leading-5 text-white/40">
              Free channels are available to everyone. Paid channels require an active subscription plan.
            </p>

            <div className="mt-4 grid gap-5 sm:grid-cols-2">
              <label className="space-y-2 text-sm text-white/65">
                Access Type
                <select
                  name="accessType"
                  value={accessType}
                  onChange={(event) =>
                    setAccessType(event.target.value as AccessType)
                  }
                  className="h-11 w-full rounded-xl border border-white/10 bg-[#171717] px-3 text-white outline-none transition focus:border-red-500/60 focus:ring-2 focus:ring-red-500/20"
                >
                  <option value="free">Free</option>
                  <option value="paid">Paid / Premium</option>
                </select>
              </label>

              <label className="space-y-2 text-sm text-white/65">
                Required Plan
                <select
                  name="requiredPlanId"
                  defaultValue={channel.requiredPlanId ?? ""}
                  disabled={accessType !== "paid"}
                  required={accessType === "paid"}
                  className="h-11 w-full rounded-xl border border-white/10 bg-[#171717] px-3 text-white outline-none transition focus:border-red-500/60 focus:ring-2 focus:ring-red-500/20 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  <option value="">
                    {accessType === "paid" ? "Select a plan" : "Not required"}
                  </option>
                  {plans.map((plan) => (
                    <option key={plan.id} value={plan.id}>
                      {plan.name} — PKR {plan.price} / {plan.duration_days} days
                    </option>
                  ))}
                </select>
              </label>
            </div>

            {accessType === "paid" && plans.length === 0 ? (
              <p className="mt-3 text-xs text-amber-200/80">
                No active plans were found. Check the plans table in Supabase before saving a paid channel.
              </p>
            ) : null}
          </div>

          <div className="grid gap-5 sm:grid-cols-2">
            <label className="space-y-2 text-sm text-white/65">
              Source Type
              <select
                name="sourceType"
                defaultValue={channel.sourceType}
                className="h-11 w-full rounded-xl border border-white/10 bg-[#171717] px-3 text-white outline-none transition focus:border-red-500/60 focus:ring-2 focus:ring-red-500/20"
              >
                <option>YouTube</option>
                <option>Official Embed</option>
                <option>Coming Soon</option>
              </select>
            </label>

            <label className="space-y-2 text-sm text-white/65">
              YouTube Channel ID / Handle
              <input
                name="sourceValue"
                defaultValue={
                  channel.sourceType === "YouTube" ? channel.sourceValue : ""
                }
                className="h-11 w-full rounded-xl border border-white/10 bg-[#171717] px-3 text-white outline-none transition focus:border-red-500/60 focus:ring-2 focus:ring-red-500/20"
              />
            </label>
          </div>

          <div className="grid gap-5 sm:grid-cols-2">
            <label className="space-y-2 text-sm text-white/65">
              Official Embed URL
              <input
                name="officialEmbedUrl"
                defaultValue={
                  channel.sourceType === "Official Embed"
                    ? channel.sourceValue
                    : ""
                }
                className="h-11 w-full rounded-xl border border-white/10 bg-[#171717] px-3 text-white outline-none transition focus:border-red-500/60 focus:ring-2 focus:ring-red-500/20"
              />
            </label>

            <label className="space-y-2 text-sm text-white/65">
              Logo Path / URL
              <input
                id="channel-logo-path"
                name="logoPath"
                value={logoPreview}
                onChange={(event) => setLogoPreview(event.target.value.trim())}
                placeholder="/channels/example.png or https://..."
                className="h-11 w-full rounded-xl border border-white/10 bg-[#171717] px-3 text-white outline-none transition focus:border-red-500/60 focus:ring-2 focus:ring-red-500/20"
              />
              <span className="block text-xs text-white/35">
                Local public path, direct image URL, or upload a logo below.
              </span>

              <div className="mt-3 rounded-xl border border-dashed border-white/15 bg-white/[0.02] p-3">
                <label className="block text-xs font-semibold uppercase tracking-[0.16em] text-white/45">
                  Upload logo
                  <input
                    type="file"
                    accept="image/png,image/jpeg,image/webp,image/svg+xml"
                    disabled={isUploadingLogo || isSaving}
                    onChange={async (event) => {
                      const input = event.currentTarget;
                      const file = input.files?.[0];

                      if (!file) return;

                      const uploadedUrl = await onLogoUpload(file);

                      if (uploadedUrl) {
                        setLogoPreview(uploadedUrl);
                      }

                      input.value = "";
                    }}
                    className="mt-2 block w-full cursor-pointer rounded-lg border border-white/10 bg-[#111] px-3 py-2 text-xs text-white/60 file:mr-3 file:rounded-md file:border-0 file:bg-red-600 file:px-3 file:py-1.5 file:font-semibold file:text-white hover:file:bg-red-500 disabled:cursor-not-allowed disabled:opacity-50"
                  />
                </label>

                <p className="mt-2 text-xs text-white/35">
                  PNG, JPG, WEBP or SVG. Maximum 2 MB.
                </p>

                {isUploadingLogo ? (
                  <p className="mt-2 text-xs font-semibold text-red-200">
                    Uploading logo...
                  </p>
                ) : null}

                {logoUploadError ? (
                  <p className="mt-2 text-xs text-red-300">
                    {logoUploadError}
                  </p>
                ) : null}
              </div>
            </label>
          </div>

          <div className="rounded-2xl border border-white/10 bg-black/25 p-4">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-white/40">
              Logo preview
            </p>

            <div className="mt-3 flex items-center gap-4">
              <div className="flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-2xl border border-white/10 bg-[#0b0b0b]">
                {logoPreview ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={logoPreview}
                    alt={`${channel.name || "Channel"} logo preview`}
                    className="h-full w-full object-contain p-2"
                    onError={(event) => {
                      event.currentTarget.style.display = "none";
                    }}
                  />
                ) : (
                  <span className="text-lg font-black tracking-[0.12em] text-white/55">
                    {initials || "TV"}
                  </span>
                )}
              </div>

              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-white">
                  {channel.name || "New channel"}
                </p>
                <p className="mt-1 break-all text-xs text-white/35">
                  {logoPreview || "No logo selected — initials will be used."}
                </p>
              </div>
            </div>
          </div>

          <label className="flex items-center gap-3 text-sm text-white/70">
            <input
              type="checkbox"
              name="comingSoon"
              defaultChecked={channel.comingSoon}
              className="h-4 w-4 accent-red-600"
            />
            Coming Soon
          </label>

          {saveError ? (
            <p
              role="alert"
              className="rounded-xl border border-red-500/20 bg-red-600/5 px-4 py-3 text-sm text-red-200"
            >
              {saveError}
            </p>
          ) : null}

          <div className="flex flex-col-reverse justify-between gap-4 border-t border-white/10 pt-5 sm:flex-row sm:items-center">
            <p className="text-xs text-white/40">
              {isPersistentEdit
                ? "Changes are saved securely to Supabase."
                : "New channels are saved securely to Supabase."}
            </p>

            <div className="flex gap-3">
              <button
                type="button"
                onClick={onClose}
                disabled={isSaving}
                className="rounded-full border border-white/10 px-4 py-2.5 text-sm font-semibold text-white/60 transition hover:border-white/20 hover:text-white focus:outline-none focus:ring-2 focus:ring-red-500/40 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Cancel
              </button>

              <button
                type="submit"
                disabled={isSaving || isUploadingLogo}
                className="rounded-full bg-red-600 px-5 py-2.5 text-sm font-bold text-white transition hover:bg-red-500 focus:outline-none focus:ring-2 focus:ring-red-500/50 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {isSaving
                  ? "Saving..."
                  : isPersistentEdit
                    ? "Save Changes"
                    : "Add Channel"}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function AdminPage() {
  const [channels, setChannels] = useState<AdminChannel[]>(initialChannels);
  const [searchTerm, setSearchTerm] = useState("");
  const [activeFilter, setActiveFilter] =
    useState<"All" | SourceType>("All");
  const [statusFilter, setStatusFilter] =
    useState<"All Status" | "Active" | "Archived">("All Status");
  const [activeSection, setActiveSection] = useState("Channels");
  const [isMobileNavOpen, setIsMobileNavOpen] = useState(false);
  const [formChannel, setFormChannel] = useState<ChannelForm | null>(null);
  const [editingDatabaseId, setEditingDatabaseId] = useState<string | null>(
    null
  );
  const [notice, setNotice] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState("");
  const [isUploadingLogo, setIsUploadingLogo] = useState(false);
  const [logoUploadError, setLogoUploadError] = useState("");
  const [statusUpdatingId, setStatusUpdatingId] = useState<string | null>(null);
  const [categoryEditingName, setCategoryEditingName] = useState<string | null>(null);
  const [categoryDraftName, setCategoryDraftName] = useState("");
  const [isSavingCategory, setIsSavingCategory] = useState(false);
  const [categoryError, setCategoryError] = useState("");
  const [streamingSearch, setStreamingSearch] = useState("");
  const [streamingFilter, setStreamingFilter] =
    useState<"All" | "YouTube" | "Official Embed" | "Coming Soon" | "Missing Source">("All");
  const [siteSettings, setSiteSettings] =
    useState<SiteSettings>(defaultSiteSettings);
  const [isLoadingSettings, setIsLoadingSettings] = useState(false);
  const [isSavingSettings, setIsSavingSettings] = useState(false);
  const [settingsError, setSettingsError] = useState("");
  const [settingsNotice, setSettingsNotice] = useState("");
  const [adminEmail, setAdminEmail] = useState("");
  const [isAccountMenuOpen, setIsAccountMenuOpen] = useState(false);
  const [isSigningOut, setIsSigningOut] = useState(false);
  const [accountError, setAccountError] = useState("");
  const [plans, setPlans] = useState<PlanOption[]>([]);
  const [paymentRequests, setPaymentRequests] =
    useState<AdminPaymentRequest[]>([]);
  const [paymentFilter, setPaymentFilter] =
    useState<"All" | "pending" | "approved" | "rejected">("pending");
  const [isLoadingPayments, setIsLoadingPayments] = useState(false);
  const [paymentError, setPaymentError] = useState("");
  const [paymentNotice, setPaymentNotice] = useState("");
  const [reviewingPaymentId, setReviewingPaymentId] = useState<string | null>(
    null
  );
  const [paymentNotes, setPaymentNotes] = useState<Record<string, string>>({});
  const [paymentMethods, setPaymentMethods] = useState<AdminPaymentMethod[]>([]);
  const [isLoadingPaymentMethods, setIsLoadingPaymentMethods] = useState(false);
  const [savingPaymentMethodId, setSavingPaymentMethodId] = useState<string | null>(
    null
  );
  const [paymentMethodError, setPaymentMethodError] = useState("");
  const [paymentMethodNotice, setPaymentMethodNotice] = useState("");

  const [adminPlans, setAdminPlans] = useState<AdminPlan[]>([]);
  const [isLoadingPlans, setIsLoadingPlans] = useState(false);
  const [savingPlanId, setSavingPlanId] = useState<string | null>(null);
  const [planError, setPlanError] = useState("");
  const [planNotice, setPlanNotice] = useState("");
  const [newPlanDraft, setNewPlanDraft] = useState<PlanDraft>({
    name: "",
    slug: "",
    description: "",
    price: "500",
    durationDays: "30",
    sortOrder: "1",
    isActive: true,
  });

  const authClient = useMemo(
    () => createSupabaseAuthBrowserClient(),
    []
  );

  useEffect(() => {
    let cancelled = false;

    async function loadPlans() {
      setIsLoadingPlans(true);
      setPlanError("");

      try {
        const response = await fetch("/api/admin/plans", {
          cache: "no-store",
        });

        const payload = (await response.json()) as {
          ok?: boolean;
          error?: string;
          plans?: AdminPlan[];
        };

        if (!response.ok || !payload.ok) {
          throw new Error(payload.error || "Unable to load subscription plans.");
        }

        if (!cancelled) {
          const loadedPlans = Array.isArray(payload.plans) ? payload.plans : [];

          setAdminPlans(loadedPlans);
          setPlans(
            loadedPlans
              .filter((plan) => plan.isActive)
              .map((plan) => ({
                id: plan.id,
                name: plan.name,
                slug: plan.slug,
                price: plan.price,
                duration_days: plan.duration_days,
              }))
          );
        }
      } catch (error) {
        if (!cancelled) {
          setPlanError(
            error instanceof Error
              ? error.message
              : "Unable to load subscription plans."
          );
        }
      } finally {
        if (!cancelled) {
          setIsLoadingPlans(false);
        }
      }
    }

    void loadPlans();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function loadPayments() {
      setIsLoadingPayments(true);
      setPaymentError("");

      try {
        const response = await fetch("/api/admin/payments", {
          cache: "no-store",
        });

        const payload = (await response.json()) as {
          ok?: boolean;
          error?: string;
          paymentRequests?: AdminPaymentRequest[];
        };

        if (!response.ok || !payload.ok) {
          throw new Error(payload.error || "Unable to load payment requests.");
        }

        if (!cancelled) {
          setPaymentRequests(
            Array.isArray(payload.paymentRequests)
              ? payload.paymentRequests
              : []
          );
        }
      } catch (error) {
        if (!cancelled) {
          setPaymentError(
            error instanceof Error
              ? error.message
              : "Unable to load payment requests."
          );
        }
      } finally {
        if (!cancelled) {
          setIsLoadingPayments(false);
        }
      }
    }

    void loadPayments();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function loadPaymentMethods() {
      setIsLoadingPaymentMethods(true);
      setPaymentMethodError("");

      try {
        const response = await fetch("/api/admin/payment-methods", {
          cache: "no-store",
        });

        const payload = (await response.json()) as {
          ok?: boolean;
          error?: string;
          paymentMethods?: AdminPaymentMethod[];
        };

        if (!response.ok || !payload.ok) {
          throw new Error(payload.error || "Unable to load payment methods.");
        }

        if (!cancelled) {
          setPaymentMethods(
            Array.isArray(payload.paymentMethods)
              ? payload.paymentMethods
              : []
          );
        }
      } catch (error) {
        if (!cancelled) {
          setPaymentMethodError(
            error instanceof Error
              ? error.message
              : "Unable to load payment methods."
          );
        }
      } finally {
        if (!cancelled) {
          setIsLoadingPaymentMethods(false);
        }
      }
    }

    void loadPaymentMethods();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function loadAdminSession() {
      try {
        const {
          data: { user },
          error,
        } = await authClient.auth.getUser();

        if (error) {
          throw error;
        }

        if (!user) {
          window.location.replace("/admin/login");
          return;
        }

        if (!cancelled) {
          setAdminEmail(user.email ?? "");
        }
      } catch (error) {
        if (!cancelled) {
          setAccountError(
            error instanceof Error
              ? error.message
              : "Unable to verify the admin session."
          );
        }
      }
    }

    void loadAdminSession();

    const {
      data: { subscription },
    } = authClient.auth.onAuthStateChange((event, session) => {
      if (event === "SIGNED_OUT" || !session?.user) {
        window.location.replace("/admin/login");
        return;
      }

      setAdminEmail(session.user.email ?? "");
    });

    return () => {
      cancelled = true;
      subscription.unsubscribe();
    };
  }, [authClient]);

  useEffect(() => {
    let cancelled = false;

    async function loadAdminChannels() {
      try {
        const response = await fetch("/api/admin/channels", {
          cache: "no-store",
        });

        if (!response.ok) return;

        const payload = (await response.json()) as {
          ok?: boolean;
          channels?: AdminChannelRow[];
        };

        if (
          !cancelled &&
          payload.ok &&
          Array.isArray(payload.channels) &&
          payload.channels.length > 0
        ) {
          setChannels(
            payload.channels.map((row, index) =>
              toAdminChannelRow(row, index + 1)
            )
          );
        }
      } catch {
        // Keep local configuration as a safe visual fallback.
      }
    }

    void loadAdminChannels();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function loadSiteSettings() {
      setIsLoadingSettings(true);
      setSettingsError("");

      try {
        const response = await fetch("/api/admin/settings", {
          cache: "no-store",
        });

        const payload = (await response.json()) as {
          ok?: boolean;
          error?: string;
          settings?: SiteSettingsRow;
        };

        if (!response.ok || !payload.ok || !payload.settings) {
          throw new Error(payload.error || "Unable to load site settings.");
        }

        if (!cancelled) {
          const row = payload.settings;

          setSiteSettings({
            siteTitle: row.site_title ?? defaultSiteSettings.siteTitle,
            tagline: row.tagline ?? defaultSiteSettings.tagline,
            heroHeading:
              row.hero_heading ?? defaultSiteSettings.heroHeading,
            heroSubheading:
              row.hero_subheading ?? defaultSiteSettings.heroSubheading,
            defaultCategory:
              row.default_category ?? defaultSiteSettings.defaultCategory,
            footerText:
              row.footer_text ?? defaultSiteSettings.footerText,
            maintenanceMode:
              row.maintenance_mode ?? defaultSiteSettings.maintenanceMode,
            globalNoticeEnabled:
              row.global_notice_enabled ??
              defaultSiteSettings.globalNoticeEnabled,
            globalNotice:
              row.global_notice ?? defaultSiteSettings.globalNotice,
          });
        }
      } catch (error) {
        if (!cancelled) {
          setSettingsError(
            error instanceof Error
              ? error.message
              : "Unable to load site settings."
          );
        }
      } finally {
        if (!cancelled) {
          setIsLoadingSettings(false);
        }
      }
    }

    void loadSiteSettings();

    return () => {
      cancelled = true;
    };
  }, []);

  const filteredPaymentRequests = useMemo(() => {
    if (paymentFilter === "All") {
      return paymentRequests;
    }

    return paymentRequests.filter(
      (request) => request.status === paymentFilter
    );
  }, [paymentFilter, paymentRequests]);

  const paymentStats = useMemo(
    () => ({
      total: paymentRequests.length,
      pending: paymentRequests.filter((request) => request.status === "pending")
        .length,
      approved: paymentRequests.filter(
        (request) => request.status === "approved"
      ).length,
      rejected: paymentRequests.filter(
        (request) => request.status === "rejected"
      ).length,
    }),
    [paymentRequests]
  );

  const filteredChannels = useMemo(() => {
    const normalizedSearch = searchTerm.trim().toLowerCase();

    return channels.filter((channel) => {
      const matchesFilter =
        activeFilter === "All" || channel.sourceType === activeFilter;

      const matchesStatus =
        statusFilter === "All Status" ||
        (statusFilter === "Active" && channel.isActive) ||
        (statusFilter === "Archived" && !channel.isActive);

      const matchesSearch =
        !normalizedSearch ||
        `${channel.name} ${channel.category} ${channel.sourceType}`
          .toLowerCase()
          .includes(normalizedSearch);

      return matchesFilter && matchesStatus && matchesSearch;
    });
  }, [activeFilter, channels, searchTerm, statusFilter]);

  const stats = {
    total: channels.length,
    active: channels.filter((channel) => channel.isActive).length,
    archived: channels.filter((channel) => !channel.isActive).length,
    comingSoon: channels.filter(
      (channel) => channel.isActive && channel.comingSoon
    ).length,
  };


  const categorySummaries = useMemo(() => {
    const summaryMap = new Map<
      string,
      {
        name: string;
        total: number;
        active: number;
        archived: number;
        comingSoon: number;
      }
    >();

    channels.forEach((channel) => {
      const categoryName = channel.category.trim() || "Uncategorized";
      const existing = summaryMap.get(categoryName) ?? {
        name: categoryName,
        total: 0,
        active: 0,
        archived: 0,
        comingSoon: 0,
      };

      existing.total += 1;

      if (channel.isActive) {
        existing.active += 1;
      } else {
        existing.archived += 1;
      }

      if (channel.isActive && channel.comingSoon) {
        existing.comingSoon += 1;
      }

      summaryMap.set(categoryName, existing);
    });

    return Array.from(summaryMap.values()).sort((a, b) =>
      a.name.localeCompare(b.name)
    );
  }, [channels]);


  const streamingStats = useMemo(() => {
    const youtube = channels.filter(
      (channel) =>
        channel.sourceType === "YouTube" &&
        channel.sourceValue.trim().length > 0 &&
        !channel.comingSoon
    ).length;

    const officialEmbed = channels.filter(
      (channel) =>
        channel.sourceType === "Official Embed" &&
        channel.sourceValue.trim().length > 0 &&
        !channel.comingSoon
    ).length;

    const comingSoon = channels.filter(
      (channel) => channel.comingSoon || channel.sourceType === "Coming Soon"
    ).length;

    const missing = channels.filter(
      (channel) =>
        !channel.comingSoon &&
        channel.sourceType !== "Coming Soon" &&
        channel.sourceValue.trim().length === 0
    ).length;

    return {
      youtube,
      officialEmbed,
      comingSoon,
      missing,
    };
  }, [channels]);

  const streamingChannels = useMemo(() => {
    const normalizedSearch = streamingSearch.trim().toLowerCase();

    return channels.filter((channel) => {
      const hasSource = channel.sourceValue.trim().length > 0;
      const isMissingSource =
        !channel.comingSoon &&
        channel.sourceType !== "Coming Soon" &&
        !hasSource;

      const matchesFilter =
        streamingFilter === "All" ||
        (streamingFilter === "Missing Source"
          ? isMissingSource
          : channel.sourceType === streamingFilter);

      const matchesSearch =
        !normalizedSearch ||
        `${channel.name} ${channel.category} ${channel.sourceType} ${channel.sourceValue}`
          .toLowerCase()
          .includes(normalizedSearch);

      return matchesFilter && matchesSearch;
    });
  }, [channels, streamingFilter, streamingSearch]);

  const overviewRecentChannels = useMemo(() => {
    return [...channels]
      .filter((channel) => channel.updatedAt)
      .sort((a, b) => {
        const aTime = a.updatedAt ? new Date(a.updatedAt).getTime() : 0;
        const bTime = b.updatedAt ? new Date(b.updatedAt).getTime() : 0;
        return bTime - aTime;
      })
      .slice(0, 5);
  }, [channels]);

  const persistentChannelCount = channels.filter(
    (channel) => channel.databaseId
  ).length;

  const configuredChannelCount = channels.filter(
    (channel) =>
      channel.comingSoon ||
      channel.sourceType === "Coming Soon" ||
      channel.sourceValue.trim().length > 0
  ).length;

  const overviewHealth = {
    databaseConnected:
      channels.length > 0 && persistentChannelCount === channels.length,
    settingsLoaded: !isLoadingSettings && !settingsError,
    sourceCoverage:
      channels.length === 0
        ? 0
        : Math.round((configuredChannelCount / channels.length) * 100),
    activeCoverage:
      channels.length === 0
        ? 0
        : Math.round((stats.active / channels.length) * 100),
  };

  const closeForm = () => {
    if (isSaving) return;

    setFormChannel(null);
    setEditingDatabaseId(null);
    setSaveError("");
    setLogoUploadError("");
  };

  const openAddForm = () => {
    setNotice("");
    setSaveError("");
    setLogoUploadError("");
    setEditingDatabaseId(null);
    setFormChannel(emptyForm);
  };

  const openEditForm = (channel: AdminChannel) => {
    setNotice("");
    setSaveError("");
    setLogoUploadError("");
    setEditingDatabaseId(channel.databaseId);
    setFormChannel({
      name: channel.name,
      category: channel.category,
      description: channel.description,
      sourceType: channel.sourceType,
      sourceValue: channel.sourceValue,
      logoPath: channel.logoPath,
      comingSoon: channel.comingSoon,
      accessType: channel.accessType,
      requiredPlanId: channel.requiredPlanId,
    });
  };

  async function handleLogoUpload(file: File) {
    setIsUploadingLogo(true);
    setLogoUploadError("");

    try {
      const formData = new FormData();
      formData.append("file", file);

      const response = await fetch("/api/admin/channel-logo", {
        method: "POST",
        body: formData,
      });

      const rawResponse = await response.text();

      let payload: {
        ok?: boolean;
        error?: string;
        url?: string;
      } = {};

      if (rawResponse) {
        try {
          payload = JSON.parse(rawResponse) as {
            ok?: boolean;
            error?: string;
            url?: string;
          };
        } catch {
          throw new Error(
            response.ok
              ? "Upload API returned an invalid response."
              : `Upload failed (${response.status}): ${rawResponse.slice(0, 160)}`
          );
        }
      }

      if (!response.ok || !payload.ok || !payload.url) {
        throw new Error(
          payload.error || `Unable to upload logo (${response.status}).`
        );
      }

      return payload.url;
    } catch (error) {
      setLogoUploadError(
        error instanceof Error
          ? error.message
          : "Unable to upload logo."
      );
      return null;
    } finally {
      setIsUploadingLogo(false);
    }
  }

  async function handleChannelSubmit(
    event: FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();

    const formData = new FormData(event.currentTarget);

    const name = String(formData.get("name") ?? "").trim();
    const category = String(formData.get("category") ?? "").trim();
    const description = String(formData.get("description") ?? "").trim();
    const sourceType = String(
      formData.get("sourceType") ?? "YouTube"
    ) as SourceType;
    const sourceValue = String(formData.get("sourceValue") ?? "").trim();
    const officialEmbedUrl = String(
      formData.get("officialEmbedUrl") ?? ""
    ).trim();
    const logoPath = String(formData.get("logoPath") ?? "").trim();
    const comingSoon =
      formData.get("comingSoon") === "on" ||
      sourceType === "Coming Soon";
    const accessType = String(
      formData.get("accessType") ?? "free"
    ) as AccessType;
    const requiredPlanIdValue = String(
      formData.get("requiredPlanId") ?? ""
    ).trim();
    const requiredPlanId =
      accessType === "paid" && requiredPlanIdValue
        ? requiredPlanIdValue
        : null;

    if (accessType === "paid" && !requiredPlanId) {
      setSaveError("Please select a subscription plan for this paid channel.");
      return;
    }

    const isYouTubeHandle =
      sourceType === "YouTube" && sourceValue.startsWith("@");

    const isYouTubeChannelId =
      sourceType === "YouTube" &&
      sourceValue.length > 0 &&
      !sourceValue.startsWith("@");

    const isEditing = Boolean(editingDatabaseId);

    setIsSaving(true);
    setSaveError("");
    setNotice("");

    try {
      const response = await fetch("/api/admin/channels", {
        method: isEditing ? "PATCH" : "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          ...(isEditing ? { id: editingDatabaseId } : {}),
          name,
          category,
          description,
          youtubeChannelId: isYouTubeChannelId ? sourceValue : null,
          youtubeHandle: isYouTubeHandle ? sourceValue : null,
          officialEmbedUrl:
            sourceType === "Official Embed"
              ? officialEmbedUrl || sourceValue || null
              : null,
          logoLocal: logoPath || null,
          comingSoon,
          accessType,
          requiredPlanId,
        }),
      });

      const payload = (await response.json()) as {
        ok?: boolean;
        error?: string;
        channel?: AdminChannelRow;
      };

      if (!response.ok || !payload.ok || !payload.channel) {
        throw new Error(payload.error || "Unable to save channel.");
      }

      const savedRow = payload.channel;

      if (isEditing) {
        setChannels((current) =>
          current.map((channel) =>
            channel.databaseId === savedRow.id
              ? toAdminChannelRow(savedRow, channel.id)
              : channel
          )
        );
      } else {
        setChannels((current) => [
          ...current,
          toAdminChannelRow(savedRow, current.length + 1),
        ]);
      }

      setFormChannel(null);
      setEditingDatabaseId(null);
      setNotice(
        isEditing
          ? `${savedRow.name} was updated successfully.`
          : `${savedRow.name} was added successfully.`
      );
    } catch (error) {
      setSaveError(
        error instanceof Error
          ? error.message
          : "Unable to save channel."
      );
    } finally {
      setIsSaving(false);
    }
  }

  async function handleChannelStatusChange(channel: AdminChannel) {
    if (!channel.databaseId || statusUpdatingId) {
      return;
    }

    const nextIsActive = !channel.isActive;
    setStatusUpdatingId(channel.databaseId);
    setNotice("");

    try {
      const response = await fetch("/api/admin/channels", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          id: channel.databaseId,
          isActive: nextIsActive,
        }),
      });

      const payload = (await response.json()) as {
        ok?: boolean;
        error?: string;
        channel?: AdminChannelRow;
      };

      if (!response.ok || !payload.ok || !payload.channel) {
        throw new Error(
          payload.error ||
            (nextIsActive
              ? "Unable to restore channel."
              : "Unable to archive channel.")
        );
      }

      const savedRow = payload.channel;

      setChannels((current) =>
        current.map((currentChannel) =>
          currentChannel.databaseId === savedRow.id
            ? toAdminChannelRow(savedRow, currentChannel.id)
            : currentChannel
        )
      );

      setNotice(
        nextIsActive
          ? `${savedRow.name} was restored successfully.`
          : `${savedRow.name} was archived successfully and is now hidden from the public channel catalogue.`
      );
    } catch (error) {
      setNotice(
        error instanceof Error
          ? error.message
          : nextIsActive
            ? "Unable to restore channel."
            : "Unable to archive channel."
      );
    } finally {
      setStatusUpdatingId(null);
    }
  }

  function openCategoryRename(categoryName: string) {
    setCategoryEditingName(categoryName);
    setCategoryDraftName(categoryName);
    setCategoryError("");
    setNotice("");
  }

  function closeCategoryRename() {
    if (isSavingCategory) return;

    setCategoryEditingName(null);
    setCategoryDraftName("");
    setCategoryError("");
  }

  async function handleCategoryRename() {
    if (!categoryEditingName || isSavingCategory) {
      return;
    }

    const nextName = categoryDraftName.trim();

    if (!nextName) {
      setCategoryError("Category name is required.");
      return;
    }

    if (nextName === categoryEditingName) {
      closeCategoryRename();
      return;
    }

    const targetChannels = channels.filter(
      (channel) => channel.category === categoryEditingName
    );

    if (targetChannels.length === 0) {
      setCategoryError("No channels were found in this category.");
      return;
    }

    const persistentTargets = targetChannels.filter(
      (channel) => channel.databaseId
    );

    if (persistentTargets.length !== targetChannels.length) {
      setCategoryError(
        "Some channels are still using local fallback data. Refresh the admin page and try again."
      );
      return;
    }

    setIsSavingCategory(true);
    setCategoryError("");
    setNotice("");

    try {
      const updatedRows = await Promise.all(
        persistentTargets.map(async (channel) => {
          const response = await fetch("/api/admin/channels", {
            method: "PATCH",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              id: channel.databaseId,
              category: nextName,
            }),
          });

          const payload = (await response.json()) as {
            ok?: boolean;
            error?: string;
            channel?: AdminChannelRow;
          };

          if (!response.ok || !payload.ok || !payload.channel) {
            throw new Error(
              payload.error ||
                `Unable to update ${channel.name}.`
            );
          }

          return payload.channel;
        })
      );

      const updatedById = new Map(
        updatedRows.map((row) => [row.id, row])
      );

      setChannels((current) =>
        current.map((channel) => {
          if (!channel.databaseId) {
            return channel;
          }

          const updatedRow = updatedById.get(channel.databaseId);

          return updatedRow
            ? toAdminChannelRow(updatedRow, channel.id)
            : channel;
        })
      );

      setNotice(
        `${categoryEditingName} was renamed to ${nextName} across ${updatedRows.length} channel${updatedRows.length === 1 ? "" : "s"}.`
      );
      setCategoryEditingName(null);
      setCategoryDraftName("");
    } catch (error) {
      setCategoryError(
        error instanceof Error
          ? error.message
          : "Unable to rename category."
      );
    } finally {
      setIsSavingCategory(false);
    }
  }

  function syncActivePlanOptions(nextPlans: AdminPlan[]) {
    setPlans(
      nextPlans
        .filter((plan) => plan.isActive)
        .sort((a, b) => a.sortOrder - b.sortOrder)
        .map((plan) => ({
          id: plan.id,
          name: plan.name,
          slug: plan.slug,
          price: plan.price,
          duration_days: plan.duration_days,
        }))
    );
  }

  function updateAdminPlan(
    planId: string,
    updates: Partial<AdminPlan>
  ) {
    setAdminPlans((current) => {
      const next = current.map((plan) =>
        plan.id === planId ? { ...plan, ...updates } : plan
      );

      syncActivePlanOptions(next);
      return next;
    });
  }

  async function handleCreatePlan() {
    if (savingPlanId) {
      return;
    }

    const name = newPlanDraft.name.trim();
    const slug = newPlanDraft.slug.trim();
    const description = newPlanDraft.description.trim();
    const price = Number(newPlanDraft.price);
    const durationDays = Number(newPlanDraft.durationDays);
    const sortOrder = Number(newPlanDraft.sortOrder);

    if (!name) {
      setPlanError("Plan name is required.");
      return;
    }

    if (!Number.isFinite(price) || price < 0) {
      setPlanError("Enter a valid plan amount.");
      return;
    }

    if (
      !Number.isInteger(durationDays) ||
      durationDays <= 0
    ) {
      setPlanError("Plan duration must be at least 1 day.");
      return;
    }

    setSavingPlanId("new");
    setPlanError("");
    setPlanNotice("");

    try {
      const response = await fetch("/api/admin/plans", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name,
          slug: slug || undefined,
          description,
          price,
          durationDays,
          sortOrder: Number.isFinite(sortOrder) ? sortOrder : 0,
          isActive: newPlanDraft.isActive,
        }),
      });

      const payload = (await response.json()) as {
        ok?: boolean;
        error?: string;
        plan?: AdminPlan;
      };

      if (!response.ok || !payload.ok || !payload.plan) {
        throw new Error(payload.error || "Unable to create plan.");
      }

      setAdminPlans((current) => {
        const next = [...current, payload.plan!].sort(
          (a, b) => a.sortOrder - b.sortOrder
        );
        syncActivePlanOptions(next);
        return next;
      });

      setNewPlanDraft({
        name: "",
        slug: "",
        description: "",
        price: "500",
        durationDays: "30",
        sortOrder: String(adminPlans.length + 2),
        isActive: true,
      });

      setPlanNotice(`${payload.plan.name} was created successfully.`);
    } catch (error) {
      setPlanError(
        error instanceof Error
          ? error.message
          : "Unable to create plan."
      );
    } finally {
      setSavingPlanId(null);
    }
  }

  async function handlePlanSave(plan: AdminPlan) {
    if (savingPlanId) {
      return;
    }

    if (!plan.name.trim()) {
      setPlanError("Plan name is required.");
      return;
    }

    if (!Number.isFinite(plan.price) || plan.price < 0) {
      setPlanError("Enter a valid plan amount.");
      return;
    }

    if (!Number.isInteger(plan.duration_days) || plan.duration_days <= 0) {
      setPlanError("Plan duration must be at least 1 day.");
      return;
    }

    setSavingPlanId(plan.id);
    setPlanError("");
    setPlanNotice("");

    try {
      const response = await fetch("/api/admin/plans", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          id: plan.id,
          name: plan.name,
          slug: plan.slug,
          description: plan.description,
          price: plan.price,
          durationDays: plan.duration_days,
          sortOrder: plan.sortOrder,
          isActive: plan.isActive,
        }),
      });

      const payload = (await response.json()) as {
        ok?: boolean;
        error?: string;
        plan?: AdminPlan;
      };

      if (!response.ok || !payload.ok || !payload.plan) {
        throw new Error(payload.error || "Unable to save plan.");
      }

      setAdminPlans((current) => {
        const next = current
          .map((item) =>
            item.id === payload.plan?.id ? payload.plan : item
          )
          .sort((a, b) => a.sortOrder - b.sortOrder);

        syncActivePlanOptions(next);
        return next;
      });

      setPlanNotice(`${payload.plan.name} was saved successfully.`);
    } catch (error) {
      setPlanError(
        error instanceof Error
          ? error.message
          : "Unable to save plan."
      );
    } finally {
      setSavingPlanId(null);
    }
  }

  async function handlePaymentMethodSave(
    method: AdminPaymentMethod
  ) {
    if (savingPaymentMethodId) {
      return;
    }

    setSavingPaymentMethodId(method.id);
    setPaymentMethodError("");
    setPaymentMethodNotice("");

    try {
      const response = await fetch("/api/admin/payment-methods", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          id: method.id,
          accountTitle: method.accountTitle,
          accountNumber: method.accountNumber,
          iban: method.iban,
          instructions: method.instructions,
          isActive: method.isActive,
          sortOrder: method.sortOrder,
        }),
      });

      const payload = (await response.json()) as {
        ok?: boolean;
        error?: string;
        paymentMethod?: AdminPaymentMethod;
      };

      if (!response.ok || !payload.ok || !payload.paymentMethod) {
        throw new Error(payload.error || "Unable to save payment method.");
      }

      setPaymentMethods((current) =>
        current.map((item) =>
          item.id === payload.paymentMethod?.id
            ? payload.paymentMethod
            : item
        )
      );

      setPaymentMethodNotice(
        `${payload.paymentMethod.name} payment details were saved.`
      );
    } catch (error) {
      setPaymentMethodError(
        error instanceof Error
          ? error.message
          : "Unable to save payment method."
      );
    } finally {
      setSavingPaymentMethodId(null);
    }
  }

  async function handlePaymentReview(
    paymentRequestId: string,
    decision: "approved" | "rejected"
  ) {
    if (reviewingPaymentId) {
      return;
    }

    setReviewingPaymentId(paymentRequestId);
    setPaymentError("");
    setPaymentNotice("");

    try {
      const response = await fetch("/api/admin/payments", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          id: paymentRequestId,
          decision,
          adminNote: paymentNotes[paymentRequestId]?.trim() || null,
        }),
      });

      const payload = (await response.json()) as {
        ok?: boolean;
        error?: string;
        paymentRequest?: AdminPaymentRequest;
        message?: string;
      };

      if (!response.ok || !payload.ok || !payload.paymentRequest) {
        throw new Error(payload.error || "Unable to review payment request.");
      }

      setPaymentRequests((current) =>
        current.map((request) =>
          request.id === payload.paymentRequest?.id
            ? payload.paymentRequest
            : request
        )
      );

      setPaymentNotice(
        payload.message ||
          (decision === "approved"
            ? "Payment approved and subscription updated."
            : "Payment request rejected.")
      );
    } catch (error) {
      setPaymentError(
        error instanceof Error
          ? error.message
          : "Unable to review payment request."
      );
    } finally {
      setReviewingPaymentId(null);
    }
  }

  async function handleSettingsSubmit(
    event: FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();

    if (isSavingSettings) {
      return;
    }

    setIsSavingSettings(true);
    setSettingsError("");
    setSettingsNotice("");

    try {
      const response = await fetch("/api/admin/settings", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(siteSettings),
      });

      const payload = (await response.json()) as {
        ok?: boolean;
        error?: string;
        settings?: SiteSettingsRow;
      };

      if (!response.ok || !payload.ok || !payload.settings) {
        throw new Error(payload.error || "Unable to save site settings.");
      }

      const row = payload.settings;

      setSiteSettings({
        siteTitle: row.site_title ?? defaultSiteSettings.siteTitle,
        tagline: row.tagline ?? defaultSiteSettings.tagline,
        heroHeading: row.hero_heading ?? defaultSiteSettings.heroHeading,
        heroSubheading:
          row.hero_subheading ?? defaultSiteSettings.heroSubheading,
        defaultCategory:
          row.default_category ?? defaultSiteSettings.defaultCategory,
        footerText: row.footer_text ?? defaultSiteSettings.footerText,
        maintenanceMode:
          row.maintenance_mode ?? defaultSiteSettings.maintenanceMode,
        globalNoticeEnabled:
          row.global_notice_enabled ??
          defaultSiteSettings.globalNoticeEnabled,
        globalNotice: row.global_notice ?? defaultSiteSettings.globalNotice,
      });

      setSettingsNotice("VELORA settings were saved successfully.");
    } catch (error) {
      setSettingsError(
        error instanceof Error
          ? error.message
          : "Unable to save site settings."
      );
    } finally {
      setIsSavingSettings(false);
    }
  }

  function handleResetSettings() {
    if (isSavingSettings) return;

    setSiteSettings(defaultSiteSettings);
    setSettingsError("");
    setSettingsNotice(
      "Defaults loaded locally. Click Save Settings to persist them."
    );
  }

  async function handleLogout() {
    if (isSigningOut) {
      return;
    }

    setIsSigningOut(true);
    setAccountError("");

    try {
      const { error } = await authClient.auth.signOut();

      if (error) {
        throw error;
      }

      window.location.replace("/admin/login");
    } catch (error) {
      setAccountError(
        error instanceof Error
          ? error.message
          : "Unable to sign out."
      );
      setIsSigningOut(false);
    }
  }

  const adminInitials = adminEmail
    ? adminEmail.slice(0, 2).toUpperCase()
    : "AD";

  return (
    <main className="min-h-screen bg-[#050505] text-white">
      <div className="mx-auto flex min-h-screen max-w-[1600px]">
        <aside className="hidden w-64 shrink-0 border-r border-white/10 bg-[#080808] px-5 py-6 lg:flex lg:flex-col">
          <div className="border-b border-white/10 pb-7">
            <p className="text-lg font-black tracking-tight">VELORA</p>
            <p className="mt-1 text-xs font-semibold uppercase tracking-[0.22em] text-red-400">
              Admin console
            </p>
          </div>

          <nav className="mt-8 space-y-1" aria-label="Admin navigation">
            {[
              "Overview",
              "Channels",
              "Categories",
              "Streaming",
              "Plans",
              "Payments",
              "Settings",
            ].map((item) => (
              <button
                key={item}
                type="button"
                onClick={() => setActiveSection(item)}
                className={`flex w-full items-center rounded-xl px-3 py-3 text-left text-sm font-semibold transition focus:outline-none focus:ring-2 focus:ring-red-500/40 ${
                  activeSection === item
                    ? "bg-red-600/10 text-red-200"
                    : "text-white/50 hover:bg-white/[0.04] hover:text-white"
                }`}
              >
                {item}
              </button>
            ))}
          </nav>

          <div className="mt-auto border-t border-white/10 pt-5">
            <div className="flex items-center gap-3 rounded-xl border border-white/10 bg-white/[0.025] p-3">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-red-500/20 bg-red-600/10 text-xs font-black text-red-100">
                {adminInitials}
              </div>
              <div className="min-w-0">
                <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-white/30">
                  Signed in
                </p>
                <p
                  className="mt-1 truncate text-xs font-semibold text-white/65"
                  title={adminEmail}
                >
                  {adminEmail || "Admin session"}
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={handleLogout}
              disabled={isSigningOut}
              className="mt-3 w-full rounded-xl border border-white/10 px-3 py-2.5 text-sm font-semibold text-white/55 transition hover:border-red-500/25 hover:bg-red-600/[0.04] hover:text-red-100 focus:outline-none focus:ring-2 focus:ring-red-500/40 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isSigningOut ? "Signing out..." : "Logout"}
            </button>
          </div>
        </aside>

        <section className="min-w-0 flex-1">
          <header className="sticky top-0 z-40 border-b border-white/10 bg-[#050505]/90 px-5 py-4 backdrop-blur-xl sm:px-8 lg:px-10">
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.24em] text-red-400">
                  {activeSection}
                </p>
                <h1 className="mt-1 text-2xl font-black tracking-tight sm:text-3xl">
                  {activeSection === "Overview"
                    ? "Dashboard overview"
                    : activeSection === "Channels"
                      ? "Channel management"
                      : activeSection === "Streaming"
                        ? "Streaming sources"
                        : activeSection === "Plans"
                          ? "Subscription plans"
                          : activeSection === "Payments"
                            ? "Payment reviews"
                            : activeSection === "Settings"
                              ? "Site settings"
                              : activeSection}
                </h1>
              </div>

              <div className="flex items-center gap-3">
                {activeSection === "Channels" ? (
                  <button
                    type="button"
                    onClick={openAddForm}
                    className="rounded-full bg-red-600 px-4 py-2.5 text-sm font-bold transition hover:bg-red-500 focus:outline-none focus:ring-2 focus:ring-red-500/50 sm:px-5"
                  >
                    + <span className="hidden sm:inline">Add </span>Channel
                  </button>
                ) : null}

                <div className="relative hidden sm:block">
                  <button
                    type="button"
                    onClick={() =>
                      setIsAccountMenuOpen((current) => !current)
                    }
                    aria-label="Open admin account menu"
                    aria-expanded={isAccountMenuOpen}
                    className="flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.035] py-1.5 pl-1.5 pr-3 text-left transition hover:border-white/20 hover:bg-white/[0.05] focus:outline-none focus:ring-2 focus:ring-red-500/40"
                  >
                    <span className="flex h-8 w-8 items-center justify-center rounded-full border border-red-500/25 bg-red-600/10 text-[11px] font-black text-red-100">
                      {adminInitials}
                    </span>
                    <span className="hidden max-w-40 truncate text-xs font-semibold text-white/65 xl:block">
                      {adminEmail || "Admin"}
                    </span>
                    <span
                      aria-hidden="true"
                      className={`text-xs text-white/35 transition ${
                        isAccountMenuOpen ? "rotate-180" : ""
                      }`}
                    >
                      ▾
                    </span>
                  </button>

                  {isAccountMenuOpen ? (
                    <div className="absolute right-0 top-[calc(100%+10px)] z-50 w-72 overflow-hidden rounded-2xl border border-white/10 bg-[#0d0d0d] shadow-[0_24px_70px_rgba(0,0,0,0.55)]">
                      <div className="border-b border-white/10 p-4">
                        <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-red-400">
                          Admin account
                        </p>
                        <p className="mt-2 truncate text-sm font-semibold text-white">
                          {adminEmail || "Signed-in administrator"}
                        </p>
                        <p className="mt-1 text-xs text-white/35">
                          Protected Supabase session
                        </p>
                      </div>

                      {accountError ? (
                        <p
                          role="alert"
                          className="border-b border-red-500/10 bg-red-600/5 px-4 py-3 text-xs leading-5 text-red-200"
                        >
                          {accountError}
                        </p>
                      ) : null}

                      <div className="p-2">
                        <button
                          type="button"
                          onClick={() => {
                            setActiveSection("Settings");
                            setIsAccountMenuOpen(false);
                          }}
                          className="w-full rounded-xl px-3 py-2.5 text-left text-sm font-semibold text-white/55 transition hover:bg-white/[0.04] hover:text-white"
                        >
                          Account settings
                        </button>
                        <button
                          type="button"
                          onClick={handleLogout}
                          disabled={isSigningOut}
                          className="mt-1 w-full rounded-xl px-3 py-2.5 text-left text-sm font-semibold text-red-300 transition hover:bg-red-600/[0.08] hover:text-red-200 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          {isSigningOut ? "Signing out..." : "Logout"}
                        </button>
                      </div>
                    </div>
                  ) : null}
                </div>

                <button
                  type="button"
                  onClick={() =>
                    setIsMobileNavOpen((current) => !current)
                  }
                  aria-label="Open admin menu"
                  aria-expanded={isMobileNavOpen}
                  className="flex h-10 w-10 items-center justify-center rounded-lg border border-white/10 bg-white/[0.04] text-white/70 transition hover:border-white/20 hover:text-white focus:outline-none focus:ring-2 focus:ring-red-500/50 lg:hidden"
                >
                  <span aria-hidden="true" className="text-lg">
                    ☰
                  </span>
                </button>
              </div>
            </div>

            {isMobileNavOpen ? (
              <nav
                className="mt-4 border-t border-white/10 pt-3 lg:hidden"
                aria-label="Mobile admin navigation"
              >
                {[
                  "Overview",
                  "Channels",
                  "Categories",
                  "Streaming",
                  "Settings",
                ].map((item) => (
                  <button
                    key={item}
                    type="button"
                    onClick={() => {
                      setActiveSection(item);
                      setIsMobileNavOpen(false);
                    }}
                    className={`block w-full rounded-lg px-3 py-3 text-left text-sm font-semibold ${
                      activeSection === item
                        ? "bg-red-600/10 text-red-200"
                        : "text-white/60"
                    }`}
                  >
                    {item}
                  </button>
                ))}

                <div className="mt-3 border-t border-white/10 pt-3">
                  <div className="flex items-center gap-3 rounded-xl bg-white/[0.025] p-3">
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-red-500/20 bg-red-600/10 text-xs font-black text-red-100">
                      {adminInitials}
                    </div>
                    <div className="min-w-0">
                      <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-white/30">
                        Signed in
                      </p>
                      <p className="mt-1 truncate text-xs font-semibold text-white/65">
                        {adminEmail || "Admin session"}
                      </p>
                    </div>
                  </div>

                  {accountError ? (
                    <p
                      role="alert"
                      className="mt-2 rounded-lg border border-red-500/15 bg-red-600/5 px-3 py-2 text-xs text-red-200"
                    >
                      {accountError}
                    </p>
                  ) : null}

                  <button
                    type="button"
                    onClick={handleLogout}
                    disabled={isSigningOut}
                    className="mt-2 w-full rounded-xl border border-white/10 px-3 py-2.5 text-left text-sm font-semibold text-red-300 transition hover:border-red-500/25 hover:bg-red-600/[0.05] disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {isSigningOut ? "Signing out..." : "Logout"}
                  </button>
                </div>
              </nav>
            ) : null}
          </header>

          <div className="px-5 py-7 sm:px-8 sm:py-9 lg:px-10">
            <div className="mb-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              <StatCard
                label="Total channels"
                value={stats.total}
                detail="in database"
              />
              <StatCard
                label="Active"
                value={stats.active}
                detail="public catalogue"
              />
              <StatCard
                label="Archived"
                value={stats.archived}
                detail="hidden safely"
              />
              <StatCard
                label="Coming soon"
                value={stats.comingSoon}
                detail="active previews"
              />
            </div>

            {activeSection === "Overview" ? (
              <div className="space-y-5">
                <section className="overflow-hidden rounded-2xl border border-red-500/15 bg-[radial-gradient(circle_at_top_right,rgba(220,38,38,0.14),transparent_48%),#0a0a0a] p-5 sm:p-6">
                  <div className="flex flex-col gap-5 xl:flex-row xl:items-end xl:justify-between">
                    <div>
                      <p className="text-xs font-bold uppercase tracking-[0.22em] text-red-400">
                        Control centre
                      </p>
                      <h2 className="mt-2 text-2xl font-black tracking-tight text-white sm:text-3xl">
                        VELORA at a glance
                      </h2>
                      <p className="mt-3 max-w-3xl text-sm leading-6 text-white/45">
                        A live snapshot of your catalogue, streaming configuration, categories and public site settings.
                      </p>
                    </div>

                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={openAddForm}
                        className="rounded-full bg-red-600 px-4 py-2.5 text-sm font-bold text-white transition hover:bg-red-500 focus:outline-none focus:ring-2 focus:ring-red-500/50"
                      >
                        + Add Channel
                      </button>
                      <button
                        type="button"
                        onClick={() => setActiveSection("Settings")}
                        className="rounded-full border border-white/10 px-4 py-2.5 text-sm font-semibold text-white/60 transition hover:border-white/20 hover:text-white focus:outline-none focus:ring-2 focus:ring-red-500/40"
                      >
                        Open Settings
                      </button>
                    </div>
                  </div>
                </section>

                <div className="grid gap-5 xl:grid-cols-[1.15fr_0.85fr]">
                  <section className="rounded-2xl border border-white/10 bg-[#0a0a0a] p-5 sm:p-6">
                    <div className="flex items-end justify-between gap-4">
                      <div>
                        <p className="text-xs font-bold uppercase tracking-[0.2em] text-white/35">
                          Source distribution
                        </p>
                        <h3 className="mt-2 text-xl font-black text-white">
                          Streaming mix
                        </h3>
                      </div>
                      <button
                        type="button"
                        onClick={() => setActiveSection("Streaming")}
                        className="text-xs font-semibold text-red-300 transition hover:text-red-200"
                      >
                        Manage sources →
                      </button>
                    </div>

                    <div className="mt-6 space-y-5">
                      {[
                        {
                          label: "YouTube",
                          value: streamingStats.youtube,
                          tone: "bg-red-500",
                        },
                        {
                          label: "Official Embed",
                          value: streamingStats.officialEmbed,
                          tone: "bg-white/55",
                        },
                        {
                          label: "Coming Soon",
                          value: streamingStats.comingSoon,
                          tone: "bg-amber-300/70",
                        },
                        {
                          label: "Missing Source",
                          value: streamingStats.missing,
                          tone: "bg-white/20",
                        },
                      ].map((item) => {
                        const percentage =
                          channels.length === 0
                            ? 0
                            : Math.round((item.value / channels.length) * 100);

                        return (
                          <div key={item.label}>
                            <div className="mb-2 flex items-center justify-between gap-4 text-sm">
                              <span className="font-semibold text-white/65">
                                {item.label}
                              </span>
                              <span className="text-white/35">
                                {item.value} · {percentage}%
                              </span>
                            </div>
                            <div className="h-2 overflow-hidden rounded-full bg-white/[0.05]">
                              <div
                                className={`h-full rounded-full ${item.tone}`}
                                style={{ width: `${percentage}%` }}
                              />
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </section>

                  <section className="rounded-2xl border border-white/10 bg-[#0a0a0a] p-5 sm:p-6">
                    <p className="text-xs font-bold uppercase tracking-[0.2em] text-white/35">
                      System health
                    </p>
                    <h3 className="mt-2 text-xl font-black text-white">
                      Configuration status
                    </h3>

                    <div className="mt-6 space-y-3">
                      <div className="flex items-center justify-between gap-4 rounded-xl border border-white/10 bg-white/[0.02] p-4">
                        <div>
                          <p className="text-sm font-semibold text-white">
                            Supabase catalogue
                          </p>
                          <p className="mt-1 text-xs text-white/35">
                            {persistentChannelCount}/{channels.length} persistent records
                          </p>
                        </div>
                        <ConfigBadge
                          tone={overviewHealth.databaseConnected ? "red" : "amber"}
                        >
                          {overviewHealth.databaseConnected ? "Connected" : "Fallback"}
                        </ConfigBadge>
                      </div>

                      <div className="flex items-center justify-between gap-4 rounded-xl border border-white/10 bg-white/[0.02] p-4">
                        <div>
                          <p className="text-sm font-semibold text-white">
                            Site settings
                          </p>
                          <p className="mt-1 text-xs text-white/35">
                            Global branding and public controls
                          </p>
                        </div>
                        <ConfigBadge
                          tone={overviewHealth.settingsLoaded ? "red" : "amber"}
                        >
                          {overviewHealth.settingsLoaded ? "Ready" : "Check"}
                        </ConfigBadge>
                      </div>

                      <div className="flex items-center justify-between gap-4 rounded-xl border border-white/10 bg-white/[0.02] p-4">
                        <div>
                          <p className="text-sm font-semibold text-white">
                            Source coverage
                          </p>
                          <p className="mt-1 text-xs text-white/35">
                            Channels with configured or planned sources
                          </p>
                        </div>
                        <span className="text-xl font-black text-white">
                          {overviewHealth.sourceCoverage}%
                        </span>
                      </div>

                      <div className="flex items-center justify-between gap-4 rounded-xl border border-white/10 bg-white/[0.02] p-4">
                        <div>
                          <p className="text-sm font-semibold text-white">
                            Public availability
                          </p>
                          <p className="mt-1 text-xs text-white/35">
                            Active channels in the catalogue
                          </p>
                        </div>
                        <span className="text-xl font-black text-white">
                          {overviewHealth.activeCoverage}%
                        </span>
                      </div>
                    </div>
                  </section>
                </div>

                <div className="grid gap-5 xl:grid-cols-[0.9fr_1.1fr]">
                  <section className="rounded-2xl border border-white/10 bg-[#0a0a0a] p-5 sm:p-6">
                    <div className="flex items-end justify-between gap-4">
                      <div>
                        <p className="text-xs font-bold uppercase tracking-[0.2em] text-white/35">
                          Categories
                        </p>
                        <h3 className="mt-2 text-xl font-black text-white">
                          Catalogue breakdown
                        </h3>
                      </div>
                      <button
                        type="button"
                        onClick={() => setActiveSection("Categories")}
                        className="text-xs font-semibold text-red-300 transition hover:text-red-200"
                      >
                        Manage →
                      </button>
                    </div>

                    <div className="mt-6 grid gap-3 sm:grid-cols-2">
                      {categorySummaries.map((category) => (
                        <button
                          key={category.name}
                          type="button"
                          onClick={() => setActiveSection("Categories")}
                          className="rounded-xl border border-white/10 bg-white/[0.02] p-4 text-left transition hover:border-red-500/20 hover:bg-red-600/[0.03]"
                        >
                          <div className="flex items-center justify-between gap-3">
                            <span className="truncate text-sm font-semibold text-white">
                              {category.name}
                            </span>
                            <span className="text-lg font-black text-white">
                              {category.total}
                            </span>
                          </div>
                          <p className="mt-2 text-xs text-white/35">
                            {category.active} active
                            {category.comingSoon
                              ? ` · ${category.comingSoon} coming soon`
                              : ""}
                          </p>
                        </button>
                      ))}
                    </div>
                  </section>

                  <section className="rounded-2xl border border-white/10 bg-[#0a0a0a] p-5 sm:p-6">
                    <div className="flex items-end justify-between gap-4">
                      <div>
                        <p className="text-xs font-bold uppercase tracking-[0.2em] text-white/35">
                          Recent catalogue changes
                        </p>
                        <h3 className="mt-2 text-xl font-black text-white">
                          Recently updated
                        </h3>
                      </div>
                      <button
                        type="button"
                        onClick={() => setActiveSection("Channels")}
                        className="text-xs font-semibold text-red-300 transition hover:text-red-200"
                      >
                        View channels →
                      </button>
                    </div>

                    <div className="mt-6 divide-y divide-white/5 overflow-hidden rounded-xl border border-white/10">
                      {overviewRecentChannels.length > 0 ? (
                        overviewRecentChannels.map((channel) => (
                          <div
                            key={channel.databaseId ?? channel.id}
                            className="flex items-center gap-3 bg-white/[0.015] px-4 py-3"
                          >
                            <div className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-white/10 bg-[#111] text-xs font-black text-white/60">
                              {channel.logoPath ? (
                                // eslint-disable-next-line @next/next/no-img-element
                                <img
                                  src={channel.logoPath}
                                  alt={`${channel.name} logo`}
                                  className="h-full w-full object-contain p-1.5"
                                />
                              ) : (
                                channel.name
                                  .split(" ")
                                  .map((part) => part[0])
                                  .join("")
                                  .slice(0, 2)
                              )}
                            </div>

                            <div className="min-w-0 flex-1">
                              <p className="truncate text-sm font-semibold text-white">
                                {channel.name}
                              </p>
                              <p className="mt-1 text-xs text-white/35">
                                {channel.category} · {channel.sourceType}
                              </p>
                            </div>

                            <div className="shrink-0 text-right">
                              <p className="text-xs text-white/45">
                                {channel.updatedAt
                                  ? new Intl.DateTimeFormat(undefined, {
                                      month: "short",
                                      day: "numeric",
                                    }).format(new Date(channel.updatedAt))
                                  : "—"}
                              </p>
                              <button
                                type="button"
                                onClick={() => openEditForm(channel)}
                                className="mt-1 text-xs font-semibold text-red-300 transition hover:text-red-200"
                              >
                                Edit
                              </button>
                            </div>
                          </div>
                        ))
                      ) : (
                        <div className="px-5 py-10 text-center">
                          <p className="text-sm font-semibold text-white/70">
                            No update timestamps available yet.
                          </p>
                          <p className="mt-2 text-xs text-white/35">
                            Supabase records will appear here as they are edited.
                          </p>
                        </div>
                      )}
                    </div>
                  </section>
                </div>

                <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-6">
                  {[
                    {
                      label: "Manage channels",
                      detail: `${stats.active} active`,
                      section: "Channels",
                    },
                    {
                      label: "Edit categories",
                      detail: `${categorySummaries.length} categories`,
                      section: "Categories",
                    },
                    {
                      label: "Streaming sources",
                      detail: `${streamingStats.missing} need attention`,
                      section: "Streaming",
                    },
                    {
                      label: "Manage plans",
                      detail: `${adminPlans.filter((plan) => plan.isActive).length} active`,
                      section: "Plans",
                    },
                    {
                      label: "Review payments",
                      detail: `${paymentStats.pending} pending`,
                      section: "Payments",
                    },
                    {
                      label: "Site settings",
                      detail: siteSettings.maintenanceMode
                        ? "Maintenance enabled"
                        : "Public site enabled",
                      section: "Settings",
                    },
                  ].map((action) => (
                    <button
                      key={action.section}
                      type="button"
                      onClick={() => setActiveSection(action.section)}
                      className="rounded-2xl border border-white/10 bg-[#0a0a0a] p-5 text-left transition hover:border-red-500/25 hover:bg-red-600/[0.03] focus:outline-none focus:ring-2 focus:ring-red-500/40"
                    >
                      <p className="text-sm font-bold text-white">
                        {action.label}
                      </p>
                      <p className="mt-2 text-xs text-white/35">
                        {action.detail}
                      </p>
                    </button>
                  ))}
                </section>

                <div className="rounded-2xl border border-white/10 bg-[#0a0a0a] px-5 py-4 text-xs leading-5 text-white/40">
                  Overview uses catalogue and settings data already loaded by the admin console. It does not trigger YouTube live discovery, so viewing this dashboard does not consume YouTube search quota.
                </div>
              </div>
            ) : activeSection === "Channels" ? (
              <>
                <div className="mb-5 flex flex-col gap-4 rounded-2xl border border-white/10 bg-[#0b0b0b] p-4 sm:flex-row sm:items-center sm:justify-between">
                  <label className="relative block min-w-0 flex-1">
                    <span className="sr-only">Search admin channels</span>
                    <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-white/35">
                      ⌕
                    </span>
                    <input
                      value={searchTerm}
                      onChange={(event) =>
                        setSearchTerm(event.target.value)
                      }
                      placeholder="Search channels..."
                      aria-label="Search admin channels"
                      className="h-11 w-full rounded-xl border border-white/10 bg-[#151515] pl-9 pr-3 text-sm text-white outline-none transition placeholder:text-white/35 focus:border-red-500/60 focus:ring-2 focus:ring-red-500/20"
                    />
                  </label>

                  <div className="flex flex-wrap gap-2">
                    {(
                      [
                        "All",
                        "YouTube",
                        "Official Embed",
                        "Coming Soon",
                      ] as const
                    ).map((filter) => (
                      <button
                        key={filter}
                        type="button"
                        onClick={() => setActiveFilter(filter)}
                        className={`rounded-full border px-3 py-2 text-xs font-semibold transition focus:outline-none focus:ring-2 focus:ring-red-500/40 ${
                          activeFilter === filter
                            ? "border-red-500/30 bg-red-600 text-white"
                            : "border-white/10 bg-white/[0.03] text-white/55 hover:border-white/20 hover:text-white"
                        }`}
                      >
                        {filter}
                      </button>
                    ))}
                  </div>

                  <div className="flex flex-wrap gap-2 sm:border-l sm:border-white/10 sm:pl-4">
                    {(["All Status", "Active", "Archived"] as const).map(
                      (filter) => (
                        <button
                          key={filter}
                          type="button"
                          onClick={() => setStatusFilter(filter)}
                          className={`rounded-full border px-3 py-2 text-xs font-semibold transition focus:outline-none focus:ring-2 focus:ring-red-500/40 ${
                            statusFilter === filter
                              ? "border-white/25 bg-white/10 text-white"
                              : "border-white/10 bg-white/[0.03] text-white/55 hover:border-white/20 hover:text-white"
                          }`}
                        >
                          {filter}
                        </button>
                      )
                    )}
                  </div>
                </div>

                {notice ? (
                  <div
                    role="status"
                    className="mb-5 rounded-xl border border-red-500/20 bg-red-600/5 px-4 py-3 text-sm text-red-100/80"
                  >
                    {notice}
                  </div>
                ) : null}

                <div className="overflow-hidden rounded-2xl border border-white/10 bg-[#0a0a0a]">
                  <div className="hidden grid-cols-[minmax(210px,1.35fr)_0.8fr_0.8fr_0.9fr_0.9fr_150px] gap-4 border-b border-white/10 px-5 py-3 text-[10px] font-bold uppercase tracking-[0.2em] text-white/35 md:grid">
                    <span>Channel</span>
                    <span>Category</span>
                    <span>Access</span>
                    <span>Source type</span>
                    <span>Status</span>
                    <span>Actions</span>
                  </div>

                  <div className="divide-y divide-white/5">
                    {filteredChannels.map((channel) => (
                      <div
                        key={channel.databaseId ?? channel.id}
                        className="grid gap-4 px-4 py-4 transition hover:bg-white/[0.02] md:grid-cols-[minmax(210px,1.35fr)_0.8fr_0.8fr_0.9fr_0.9fr_150px] md:items-center md:px-5"
                      >
                        <div className="flex min-w-0 items-center gap-3">
                          <div className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-white/10 bg-white/[0.04] text-xs font-black text-white/70">
                            {channel.logoPath ? (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img
                                src={channel.logoPath}
                                alt={`${channel.name} logo`}
                                className="h-full w-full object-contain p-1.5"
                              />
                            ) : (
                              channel.name
                                .split(" ")
                                .map((part) => part[0])
                                .join("")
                                .slice(0, 2)
                            )}
                          </div>

                          <div className="min-w-0">
                            <p className="truncate text-sm font-semibold text-white">
                              {channel.name}
                            </p>
                            <p className="truncate text-xs text-white/35">
                              {channel.description}
                            </p>
                          </div>
                        </div>

                        <div className="text-xs text-white/55">
                          <span className="mr-2 text-white/35 md:hidden">
                            Category
                          </span>
                          {channel.category}
                        </div>

                        <div>
                          <span className="mr-2 text-xs text-white/35 md:hidden">
                            Access
                          </span>
                          <ConfigBadge
                            tone={channel.accessType === "paid" ? "amber" : "neutral"}
                          >
                            {channel.accessType === "paid" ? "Premium" : "Free"}
                          </ConfigBadge>
                        </div>

                        <div>
                          <span className="mr-2 text-xs text-white/35 md:hidden">
                            Source
                          </span>
                          <ConfigBadge
                            tone={
                              channel.sourceType === "YouTube"
                                ? "red"
                                : channel.sourceType === "Coming Soon"
                                  ? "amber"
                                  : "neutral"
                            }
                          >
                            {channel.sourceType}
                          </ConfigBadge>
                        </div>

                        <div>
                          <span className="mr-2 text-xs text-white/35 md:hidden">
                            Status
                          </span>
                          <ConfigBadge
                            tone={
                              !channel.isActive
                                ? "neutral"
                                : channel.comingSoon
                                  ? "amber"
                                  : "red"
                            }
                          >
                            {!channel.isActive
                              ? "Archived"
                              : channel.comingSoon
                                ? "Coming Soon"
                                : "Configured"}
                          </ConfigBadge>
                        </div>

                        <div className="flex gap-2">
                          <button
                            type="button"
                            onClick={() => openEditForm(channel)}
                            disabled={!channel.databaseId}
                            title={
                              channel.databaseId
                                ? "Edit channel"
                                : "Waiting for Supabase channel data"
                            }
                            className="rounded-lg border border-white/10 px-3 py-2 text-xs font-semibold text-white/60 transition hover:border-white/20 hover:text-white focus:outline-none focus:ring-2 focus:ring-red-500/40 disabled:cursor-not-allowed disabled:opacity-40"
                          >
                            Edit
                          </button>

                          <button
                            type="button"
                            onClick={() =>
                              void handleChannelStatusChange(channel)
                            }
                            disabled={
                              !channel.databaseId ||
                              statusUpdatingId === channel.databaseId
                            }
                            className={`rounded-lg border px-3 py-2 text-xs font-semibold transition focus:outline-none focus:ring-2 focus:ring-red-500/40 disabled:cursor-not-allowed disabled:opacity-40 ${
                              channel.isActive
                                ? "border-white/10 text-white/40 hover:border-red-500/30 hover:text-red-200"
                                : "border-emerald-500/20 text-emerald-200/70 hover:border-emerald-400/40 hover:text-emerald-100"
                            }`}
                          >
                            {statusUpdatingId === channel.databaseId
                              ? "Saving..."
                              : channel.isActive
                                ? "Archive"
                                : "Restore"}
                          </button>
                        </div>
                      </div>
                    ))}

                    {filteredChannels.length === 0 ? (
                      <div className="px-5 py-14 text-center">
                        <p className="text-lg font-bold text-white">
                          No channels found
                        </p>
                        <p className="mt-2 text-sm text-white/45">
                          Try another search or source filter.
                        </p>
                      </div>
                    ) : null}
                  </div>
                </div>
              </>
            ) : activeSection === "Categories" ? (
              <>
                <div className="mb-5 rounded-2xl border border-white/10 bg-[#0b0b0b] p-5">
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
                    <div>
                      <p className="text-xs font-bold uppercase tracking-[0.22em] text-red-400">
                        Catalogue structure
                      </p>
                      <h2 className="mt-2 text-2xl font-black tracking-tight text-white">
                        Categories
                      </h2>
                      <p className="mt-2 max-w-2xl text-sm leading-6 text-white/45">
                        Categories are generated from the real channel catalogue. Renaming a category updates every channel assigned to it.
                      </p>
                    </div>

                    <div className="rounded-xl border border-white/10 bg-black/25 px-4 py-3 text-right">
                      <p className="text-2xl font-black text-white">
                        {categorySummaries.length}
                      </p>
                      <p className="text-xs uppercase tracking-[0.16em] text-white/35">
                        categories
                      </p>
                    </div>
                  </div>
                </div>

                {notice ? (
                  <div
                    role="status"
                    className="mb-5 rounded-xl border border-red-500/20 bg-red-600/5 px-4 py-3 text-sm text-red-100/80"
                  >
                    {notice}
                  </div>
                ) : null}

                <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                  {categorySummaries.map((category) => (
                    <article
                      key={category.name}
                      className="rounded-2xl border border-white/10 bg-[#0a0a0a] p-5 shadow-[0_14px_35px_rgba(0,0,0,0.18)]"
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div className="min-w-0">
                          <p className="text-xs font-bold uppercase tracking-[0.2em] text-white/35">
                            Category
                          </p>
                          <h3 className="mt-2 truncate text-xl font-black text-white">
                            {category.name}
                          </h3>
                        </div>

                        <ConfigBadge tone="neutral">
                          {`${category.total} channel${category.total === 1 ? "" : "s"}`}
                        </ConfigBadge>
                      </div>

                      <div className="mt-5 grid grid-cols-3 gap-3">
                        <div className="rounded-xl border border-white/10 bg-white/[0.025] p-3">
                          <p className="text-xl font-black text-white">
                            {category.active}
                          </p>
                          <p className="mt-1 text-[10px] uppercase tracking-[0.16em] text-white/35">
                            Active
                          </p>
                        </div>

                        <div className="rounded-xl border border-white/10 bg-white/[0.025] p-3">
                          <p className="text-xl font-black text-white">
                            {category.archived}
                          </p>
                          <p className="mt-1 text-[10px] uppercase tracking-[0.16em] text-white/35">
                            Archived
                          </p>
                        </div>

                        <div className="rounded-xl border border-white/10 bg-white/[0.025] p-3">
                          <p className="text-xl font-black text-white">
                            {category.comingSoon}
                          </p>
                          <p className="mt-1 text-[10px] uppercase tracking-[0.16em] text-white/35">
                            Soon
                          </p>
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={() => openCategoryRename(category.name)}
                        className="mt-5 w-full rounded-xl border border-white/10 px-4 py-2.5 text-sm font-semibold text-white/60 transition hover:border-red-500/30 hover:text-red-100 focus:outline-none focus:ring-2 focus:ring-red-500/40"
                      >
                        Rename category
                      </button>
                    </article>
                  ))}
                </div>

                {categoryEditingName ? (
                  <div
                    className="fixed inset-0 z-50 flex items-end justify-center bg-black/75 p-0 backdrop-blur-sm sm:items-center sm:p-6"
                    role="dialog"
                    aria-modal="true"
                    aria-labelledby="category-rename-title"
                  >
                    <div className="w-full max-w-md rounded-t-3xl border border-white/10 bg-[#101010] p-6 shadow-2xl sm:rounded-3xl">
                      <div className="flex items-start justify-between gap-4">
                        <div>
                          <p className="text-xs font-bold uppercase tracking-[0.22em] text-red-400">
                            Category tools
                          </p>
                          <h2
                            id="category-rename-title"
                            className="mt-2 text-2xl font-black text-white"
                          >
                            Rename category
                          </h2>
                        </div>

                        <button
                          type="button"
                          onClick={closeCategoryRename}
                          disabled={isSavingCategory}
                          aria-label="Close category rename"
                          className="flex h-9 w-9 items-center justify-center rounded-full border border-white/10 text-xl text-white/55 transition hover:border-white/25 hover:text-white disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          ×
                        </button>
                      </div>

                      <p className="mt-4 text-sm leading-6 text-white/45">
                        Every channel currently assigned to{" "}
                        <span className="font-semibold text-white/75">
                          {categoryEditingName}
                        </span>{" "}
                        will be updated.
                      </p>

                      <label className="mt-5 block space-y-2 text-sm text-white/65">
                        New category name
                        <input
                          value={categoryDraftName}
                          onChange={(event) =>
                            setCategoryDraftName(event.target.value)
                          }
                          disabled={isSavingCategory}
                          autoFocus
                          className="h-11 w-full rounded-xl border border-white/10 bg-[#171717] px-3 text-white outline-none transition focus:border-red-500/60 focus:ring-2 focus:ring-red-500/20 disabled:cursor-not-allowed disabled:opacity-60"
                        />
                      </label>

                      {categoryError ? (
                        <p
                          role="alert"
                          className="mt-4 rounded-xl border border-red-500/20 bg-red-600/5 px-4 py-3 text-sm text-red-200"
                        >
                          {categoryError}
                        </p>
                      ) : null}

                      <div className="mt-6 flex justify-end gap-3 border-t border-white/10 pt-5">
                        <button
                          type="button"
                          onClick={closeCategoryRename}
                          disabled={isSavingCategory}
                          className="rounded-full border border-white/10 px-4 py-2.5 text-sm font-semibold text-white/60 transition hover:border-white/20 hover:text-white disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          Cancel
                        </button>

                        <button
                          type="button"
                          onClick={() => void handleCategoryRename()}
                          disabled={isSavingCategory}
                          className="rounded-full bg-red-600 px-5 py-2.5 text-sm font-bold text-white transition hover:bg-red-500 focus:outline-none focus:ring-2 focus:ring-red-500/50 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          {isSavingCategory ? "Saving..." : "Rename"}
                        </button>
                      </div>
                    </div>
                  </div>
                ) : null}
              </>
            ) : activeSection === "Streaming" ? (
              <>
                <div className="mb-5 rounded-2xl border border-white/10 bg-[#0b0b0b] p-5">
                  <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
                    <div>
                      <p className="text-xs font-bold uppercase tracking-[0.22em] text-red-400">
                        Source configuration
                      </p>
                      <h2 className="mt-2 text-2xl font-black tracking-tight text-white">
                        Streaming sources
                      </h2>
                      <p className="mt-2 max-w-3xl text-sm leading-6 text-white/45">
                        Review the configured source for every channel. YouTube channels use an official channel ID or handle, while official embeds use an authorized embed URL.
                      </p>
                    </div>

                    <div className="rounded-xl border border-white/10 bg-black/25 px-4 py-3 text-right">
                      <p className="text-2xl font-black text-white">
                        {channels.length}
                      </p>
                      <p className="text-xs uppercase tracking-[0.16em] text-white/35">
                        catalogue sources
                      </p>
                    </div>
                  </div>
                </div>

                <div className="mb-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                  <StatCard
                    label="YouTube"
                    value={streamingStats.youtube}
                    detail="configured"
                  />
                  <StatCard
                    label="Official embed"
                    value={streamingStats.officialEmbed}
                    detail="configured"
                  />
                  <StatCard
                    label="Coming soon"
                    value={streamingStats.comingSoon}
                    detail="not live yet"
                  />
                  <StatCard
                    label="Missing source"
                    value={streamingStats.missing}
                    detail="needs attention"
                  />
                </div>

                <div className="mb-5 flex flex-col gap-4 rounded-2xl border border-white/10 bg-[#0b0b0b] p-4 xl:flex-row xl:items-center xl:justify-between">
                  <label className="relative block min-w-0 flex-1">
                    <span className="sr-only">Search streaming sources</span>
                    <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-white/35">
                      ⌕
                    </span>
                    <input
                      value={streamingSearch}
                      onChange={(event) =>
                        setStreamingSearch(event.target.value)
                      }
                      placeholder="Search channel or source..."
                      aria-label="Search streaming sources"
                      className="h-11 w-full rounded-xl border border-white/10 bg-[#151515] pl-9 pr-3 text-sm text-white outline-none transition placeholder:text-white/35 focus:border-red-500/60 focus:ring-2 focus:ring-red-500/20"
                    />
                  </label>

                  <div className="flex flex-wrap gap-2">
                    {(
                      [
                        "All",
                        "YouTube",
                        "Official Embed",
                        "Coming Soon",
                        "Missing Source",
                      ] as const
                    ).map((filter) => (
                      <button
                        key={filter}
                        type="button"
                        onClick={() => setStreamingFilter(filter)}
                        className={`rounded-full border px-3 py-2 text-xs font-semibold transition focus:outline-none focus:ring-2 focus:ring-red-500/40 ${
                          streamingFilter === filter
                            ? "border-red-500/30 bg-red-600 text-white"
                            : "border-white/10 bg-white/[0.03] text-white/55 hover:border-white/20 hover:text-white"
                        }`}
                      >
                        {filter}
                      </button>
                    ))}
                  </div>
                </div>

                {notice ? (
                  <div
                    role="status"
                    className="mb-5 rounded-xl border border-red-500/20 bg-red-600/5 px-4 py-3 text-sm text-red-100/80"
                  >
                    {notice}
                  </div>
                ) : null}

                <div className="overflow-hidden rounded-2xl border border-white/10 bg-[#0a0a0a]">
                  <div className="hidden grid-cols-[minmax(220px,1.15fr)_160px_minmax(260px,1.6fr)_130px_110px] gap-4 border-b border-white/10 px-5 py-3 text-[10px] font-bold uppercase tracking-[0.2em] text-white/35 lg:grid">
                    <span>Channel</span>
                    <span>Source type</span>
                    <span>Source value</span>
                    <span>Health</span>
                    <span>Action</span>
                  </div>

                  <div className="divide-y divide-white/5">
                    {streamingChannels.map((channel) => {
                      const hasSource = channel.sourceValue.trim().length > 0;
                      const isMissingSource =
                        !channel.comingSoon &&
                        channel.sourceType !== "Coming Soon" &&
                        !hasSource;

                      const healthLabel = !channel.isActive
                        ? "Archived"
                        : channel.comingSoon ||
                            channel.sourceType === "Coming Soon"
                          ? "Coming Soon"
                          : isMissingSource
                            ? "Missing"
                            : "Configured";

                      const healthTone:
                        | "neutral"
                        | "red"
                        | "amber" = !channel.isActive
                        ? "neutral"
                        : channel.comingSoon ||
                            channel.sourceType === "Coming Soon" ||
                            isMissingSource
                          ? "amber"
                          : "red";

                      return (
                        <div
                          key={channel.databaseId ?? channel.id}
                          className="grid gap-4 px-4 py-4 transition hover:bg-white/[0.02] lg:grid-cols-[minmax(220px,1.15fr)_160px_minmax(260px,1.6fr)_130px_110px] lg:items-center lg:px-5"
                        >
                          <div className="flex min-w-0 items-center gap-3">
                            <div className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-white/10 bg-white/[0.04] text-xs font-black text-white/70">
                              {channel.logoPath ? (
                                // eslint-disable-next-line @next/next/no-img-element
                                <img
                                  src={channel.logoPath}
                                  alt={`${channel.name} logo`}
                                  className="h-full w-full object-contain p-1.5"
                                />
                              ) : (
                                channel.name
                                  .split(" ")
                                  .map((part) => part[0])
                                  .join("")
                                  .slice(0, 2)
                              )}
                            </div>

                            <div className="min-w-0">
                              <p className="truncate text-sm font-semibold text-white">
                                {channel.name}
                              </p>
                              <p className="truncate text-xs text-white/35">
                                {channel.category}
                              </p>
                            </div>
                          </div>

                          <div>
                            <span className="mr-2 text-xs text-white/35 lg:hidden">
                              Type
                            </span>
                            <ConfigBadge
                              tone={
                                channel.sourceType === "YouTube"
                                  ? "red"
                                  : channel.sourceType === "Coming Soon"
                                    ? "amber"
                                    : "neutral"
                              }
                            >
                              {channel.sourceType}
                            </ConfigBadge>
                          </div>

                          <div className="min-w-0">
                            <span className="mr-2 text-xs text-white/35 lg:hidden">
                              Source
                            </span>
                            {hasSource ? (
                              <p
                                className="break-all font-mono text-xs leading-5 text-white/55"
                                title={channel.sourceValue}
                              >
                                {channel.sourceValue}
                              </p>
                            ) : (
                              <p className="text-xs text-white/30">
                                No source configured
                              </p>
                            )}
                          </div>

                          <div>
                            <span className="mr-2 text-xs text-white/35 lg:hidden">
                              Health
                            </span>
                            <ConfigBadge tone={healthTone}>
                              {healthLabel}
                            </ConfigBadge>
                          </div>

                          <div>
                            <button
                              type="button"
                              onClick={() => openEditForm(channel)}
                              disabled={!channel.databaseId}
                              className="rounded-lg border border-white/10 px-3 py-2 text-xs font-semibold text-white/60 transition hover:border-red-500/30 hover:text-red-100 focus:outline-none focus:ring-2 focus:ring-red-500/40 disabled:cursor-not-allowed disabled:opacity-40"
                            >
                              Edit source
                            </button>
                          </div>
                        </div>
                      );
                    })}

                    {streamingChannels.length === 0 ? (
                      <div className="px-5 py-14 text-center">
                        <p className="text-lg font-bold text-white">
                          No streaming sources found
                        </p>
                        <p className="mt-2 text-sm text-white/45">
                          Try another source filter or search term.
                        </p>
                      </div>
                    ) : null}
                  </div>
                </div>

                <div className="mt-5 rounded-2xl border border-amber-400/10 bg-amber-400/[0.025] p-5">
                  <p className="text-sm font-semibold text-amber-100/80">
                    Source health here means configuration health only.
                  </p>
                  <p className="mt-2 text-xs leading-5 text-white/40">
                    This screen does not auto-check YouTube live status, so opening the Streaming workspace will not consume YouTube discovery quota.
                  </p>
                </div>
              </>
            ) : activeSection === "Plans" ? (
              <div className="space-y-5">
                <section className="rounded-2xl border border-white/10 bg-[#0b0b0b] p-5 sm:p-6">
                  <p className="text-xs font-bold uppercase tracking-[0.22em] text-red-400">
                    Subscription catalogue
                  </p>
                  <h2 className="mt-2 text-2xl font-black tracking-tight text-white">
                    Plans management
                  </h2>
                  <p className="mt-2 max-w-3xl text-sm leading-6 text-white/45">
                    Create your own plans with any price and duration. For
                    example PKR 500 for 30 days, PKR 1200 for 90 days, or any
                    combination you want.
                  </p>
                </section>

                {planNotice ? (
                  <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 px-4 py-3 text-sm text-emerald-100/80">
                    {planNotice}
                  </div>
                ) : null}

                {planError ? (
                  <div className="rounded-xl border border-red-500/20 bg-red-600/5 px-4 py-3 text-sm text-red-200">
                    {planError}
                  </div>
                ) : null}

                <section className="rounded-2xl border border-red-500/15 bg-red-600/[0.025] p-5 sm:p-6">
                  <div className="flex flex-col gap-2">
                    <p className="text-xs font-bold uppercase tracking-[0.2em] text-red-300">
                      New plan
                    </p>
                    <h3 className="text-xl font-black text-white">
                      Create subscription plan
                    </h3>
                  </div>

                  <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                    <label className="space-y-2 text-sm text-white/60">
                      Plan name
                      <input
                        value={newPlanDraft.name}
                        onChange={(event) =>
                          setNewPlanDraft((current) => ({
                            ...current,
                            name: event.target.value,
                          }))
                        }
                        placeholder="Premium Quarterly"
                        className="h-11 w-full rounded-xl border border-white/10 bg-[#151515] px-3 text-white outline-none transition placeholder:text-white/25 focus:border-red-500/60 focus:ring-2 focus:ring-red-500/20"
                      />
                    </label>

                    <label className="space-y-2 text-sm text-white/60">
                      Slug
                      <input
                        value={newPlanDraft.slug}
                        onChange={(event) =>
                          setNewPlanDraft((current) => ({
                            ...current,
                            slug: event.target.value,
                          }))
                        }
                        placeholder="premium-quarterly (optional)"
                        className="h-11 w-full rounded-xl border border-white/10 bg-[#151515] px-3 text-white outline-none transition placeholder:text-white/25 focus:border-red-500/60 focus:ring-2 focus:ring-red-500/20"
                      />
                    </label>

                    <label className="space-y-2 text-sm text-white/60">
                      Amount (PKR)
                      <input
                        type="number"
                        min="0"
                        step="1"
                        value={newPlanDraft.price}
                        onChange={(event) =>
                          setNewPlanDraft((current) => ({
                            ...current,
                            price: event.target.value,
                          }))
                        }
                        placeholder="1200"
                        className="h-11 w-full rounded-xl border border-white/10 bg-[#151515] px-3 text-white outline-none transition focus:border-red-500/60 focus:ring-2 focus:ring-red-500/20"
                      />
                    </label>

                    <label className="space-y-2 text-sm text-white/60">
                      Duration (days)
                      <input
                        type="number"
                        min="1"
                        step="1"
                        value={newPlanDraft.durationDays}
                        onChange={(event) =>
                          setNewPlanDraft((current) => ({
                            ...current,
                            durationDays: event.target.value,
                          }))
                        }
                        placeholder="90"
                        className="h-11 w-full rounded-xl border border-white/10 bg-[#151515] px-3 text-white outline-none transition focus:border-red-500/60 focus:ring-2 focus:ring-red-500/20"
                      />
                    </label>

                    <label className="space-y-2 text-sm text-white/60">
                      Sort order
                      <input
                        type="number"
                        value={newPlanDraft.sortOrder}
                        onChange={(event) =>
                          setNewPlanDraft((current) => ({
                            ...current,
                            sortOrder: event.target.value,
                          }))
                        }
                        className="h-11 w-full rounded-xl border border-white/10 bg-[#151515] px-3 text-white outline-none transition focus:border-red-500/60 focus:ring-2 focus:ring-red-500/20"
                      />
                    </label>

                    <label className="flex items-end">
                      <span className="flex h-11 w-full items-center gap-3 rounded-xl border border-white/10 bg-[#151515] px-3 text-sm text-white/60">
                        <input
                          type="checkbox"
                          checked={newPlanDraft.isActive}
                          onChange={(event) =>
                            setNewPlanDraft((current) => ({
                              ...current,
                              isActive: event.target.checked,
                            }))
                          }
                          className="h-4 w-4 accent-red-600"
                        />
                        Active immediately
                      </span>
                    </label>
                  </div>

                  <label className="mt-4 block space-y-2 text-sm text-white/60">
                    Description
                    <textarea
                      rows={3}
                      value={newPlanDraft.description}
                      onChange={(event) =>
                        setNewPlanDraft((current) => ({
                          ...current,
                          description: event.target.value,
                        }))
                      }
                      placeholder="90 days of premium VELORA channel access."
                      className="w-full resize-y rounded-xl border border-white/10 bg-[#151515] px-3 py-3 text-white outline-none transition placeholder:text-white/25 focus:border-red-500/60 focus:ring-2 focus:ring-red-500/20"
                    />
                  </label>

                  <button
                    type="button"
                    onClick={() => void handleCreatePlan()}
                    disabled={Boolean(savingPlanId)}
                    className="mt-5 rounded-xl bg-red-600 px-5 py-3 text-sm font-bold text-white transition hover:bg-red-500 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {savingPlanId === "new" ? "Creating..." : "Create Plan"}
                  </button>
                </section>

                <section className="rounded-2xl border border-white/10 bg-[#0a0a0a] p-5 sm:p-6">
                  <div className="flex items-end justify-between gap-4">
                    <div>
                      <p className="text-xs font-bold uppercase tracking-[0.2em] text-white/35">
                        Existing plans
                      </p>
                      <h3 className="mt-2 text-xl font-black text-white">
                        Edit price and duration anytime
                      </h3>
                    </div>

                    <span className="rounded-full border border-white/10 bg-white/[0.03] px-3 py-2 text-xs font-bold text-white/45">
                      {adminPlans.length} plans
                    </span>
                  </div>

                  {isLoadingPlans ? (
                    <div className="mt-6 rounded-xl border border-dashed border-white/10 px-5 py-10 text-center text-sm text-white/40">
                      Loading plans...
                    </div>
                  ) : adminPlans.length === 0 ? (
                    <div className="mt-6 rounded-xl border border-dashed border-white/10 px-5 py-10 text-center text-sm text-white/40">
                      No plans yet. Create your first plan above.
                    </div>
                  ) : (
                    <div className="mt-6 grid gap-4 xl:grid-cols-2">
                      {adminPlans.map((plan) => (
                        <article
                          key={plan.id}
                          className="rounded-2xl border border-white/10 bg-white/[0.02] p-5"
                        >
                          <div className="flex flex-wrap items-center justify-between gap-3">
                            <div>
                              <p className="text-lg font-black text-white">
                                {plan.name || "Untitled plan"}
                              </p>
                              <p className="mt-1 text-xs text-white/35">
                                {plan.slug}
                              </p>
                            </div>

                            <label className="flex items-center gap-2 text-xs font-semibold text-white/55">
                              <input
                                type="checkbox"
                                checked={plan.isActive}
                                onChange={(event) =>
                                  updateAdminPlan(plan.id, {
                                    isActive: event.target.checked,
                                  })
                                }
                                className="h-4 w-4 accent-red-600"
                              />
                              Active
                            </label>
                          </div>

                          <div className="mt-5 grid gap-4 sm:grid-cols-2">
                            <label className="space-y-2 text-sm text-white/60">
                              Plan name
                              <input
                                value={plan.name}
                                onChange={(event) =>
                                  updateAdminPlan(plan.id, {
                                    name: event.target.value,
                                  })
                                }
                                className="h-11 w-full rounded-xl border border-white/10 bg-[#151515] px-3 text-white outline-none transition focus:border-red-500/60 focus:ring-2 focus:ring-red-500/20"
                              />
                            </label>

                            <label className="space-y-2 text-sm text-white/60">
                              Slug
                              <input
                                value={plan.slug}
                                onChange={(event) =>
                                  updateAdminPlan(plan.id, {
                                    slug: event.target.value,
                                  })
                                }
                                className="h-11 w-full rounded-xl border border-white/10 bg-[#151515] px-3 text-white outline-none transition focus:border-red-500/60 focus:ring-2 focus:ring-red-500/20"
                              />
                            </label>

                            <label className="space-y-2 text-sm text-white/60">
                              Amount (PKR)
                              <input
                                type="number"
                                min="0"
                                step="1"
                                value={plan.price}
                                onChange={(event) =>
                                  updateAdminPlan(plan.id, {
                                    price: Number(event.target.value) || 0,
                                  })
                                }
                                className="h-11 w-full rounded-xl border border-white/10 bg-[#151515] px-3 text-white outline-none transition focus:border-red-500/60 focus:ring-2 focus:ring-red-500/20"
                              />
                            </label>

                            <label className="space-y-2 text-sm text-white/60">
                              Duration (days)
                              <input
                                type="number"
                                min="1"
                                step="1"
                                value={plan.duration_days}
                                onChange={(event) =>
                                  updateAdminPlan(plan.id, {
                                    duration_days:
                                      Number(event.target.value) || 1,
                                  })
                                }
                                className="h-11 w-full rounded-xl border border-white/10 bg-[#151515] px-3 text-white outline-none transition focus:border-red-500/60 focus:ring-2 focus:ring-red-500/20"
                              />
                            </label>

                            <label className="space-y-2 text-sm text-white/60">
                              Sort order
                              <input
                                type="number"
                                value={plan.sortOrder}
                                onChange={(event) =>
                                  updateAdminPlan(plan.id, {
                                    sortOrder:
                                      Number(event.target.value) || 0,
                                  })
                                }
                                className="h-11 w-full rounded-xl border border-white/10 bg-[#151515] px-3 text-white outline-none transition focus:border-red-500/60 focus:ring-2 focus:ring-red-500/20"
                              />
                            </label>

                            <div className="rounded-xl border border-red-500/15 bg-red-600/[0.035] p-3">
                              <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-red-300">
                                Viewer price
                              </p>
                              <p className="mt-2 text-xl font-black text-white">
                                PKR {plan.price}
                              </p>
                              <p className="mt-1 text-xs text-white/45">
                                {plan.duration_days} days access
                              </p>
                            </div>
                          </div>

                          <label className="mt-4 block space-y-2 text-sm text-white/60">
                            Description
                            <textarea
                              rows={3}
                              value={plan.description}
                              onChange={(event) =>
                                updateAdminPlan(plan.id, {
                                  description: event.target.value,
                                })
                              }
                              className="w-full resize-y rounded-xl border border-white/10 bg-[#151515] px-3 py-3 text-white outline-none transition focus:border-red-500/60 focus:ring-2 focus:ring-red-500/20"
                            />
                          </label>

                          <button
                            type="button"
                            onClick={() => void handlePlanSave(plan)}
                            disabled={Boolean(savingPlanId)}
                            className="mt-5 w-full rounded-xl bg-red-600 px-4 py-3 text-sm font-bold text-white transition hover:bg-red-500 disabled:cursor-not-allowed disabled:opacity-50"
                          >
                            {savingPlanId === plan.id
                              ? "Saving..."
                              : `Save ${plan.name || "Plan"}`}
                          </button>
                        </article>
                      ))}
                    </div>
                  )}
                </section>

                <div className="rounded-2xl border border-amber-400/15 bg-amber-400/[0.035] px-5 py-4 text-xs leading-5 text-amber-100/65">
                  Deactivating a plan hides it from new purchases. Existing
                  subscriptions and historical payment requests are kept
                  safely, so referenced plans are not deleted.
                </div>
              </div>
            ) : activeSection === "Payments" ? (
              <div className="space-y-5">
                <div className="rounded-2xl border border-white/10 bg-[#0b0b0b] p-5">
                  <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
                    <div>
                      <p className="text-xs font-bold uppercase tracking-[0.22em] text-red-400">
                        Manual payments
                      </p>
                      <h2 className="mt-2 text-2xl font-black tracking-tight text-white">
                        Payment review queue
                      </h2>
                      <p className="mt-2 max-w-3xl text-sm leading-6 text-white/45">
                        Review user receipts, transaction references and plan
                        details. Approving a request activates or extends the
                        matching premium subscription.
                      </p>
                    </div>

                    <div className="flex flex-wrap gap-2">
                      {(["All", "pending", "approved", "rejected"] as const).map(
                        (filter) => (
                          <button
                            key={filter}
                            type="button"
                            onClick={() => setPaymentFilter(filter)}
                            className={`rounded-full border px-3 py-2 text-xs font-semibold capitalize transition ${
                              paymentFilter === filter
                                ? "border-red-500/30 bg-red-600 text-white"
                                : "border-white/10 bg-white/[0.03] text-white/55 hover:border-white/20 hover:text-white"
                            }`}
                          >
                            {filter}
                          </button>
                        )
                      )}
                    </div>
                  </div>
                </div>

                <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                  <StatCard
                    label="Total requests"
                    value={paymentStats.total}
                    detail="all time"
                  />
                  <StatCard
                    label="Pending"
                    value={paymentStats.pending}
                    detail="needs review"
                  />
                  <StatCard
                    label="Approved"
                    value={paymentStats.approved}
                    detail="accepted"
                  />
                  <StatCard
                    label="Rejected"
                    value={paymentStats.rejected}
                    detail="declined"
                  />
                </div>

                {paymentNotice ? (
                  <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 px-4 py-3 text-sm text-emerald-100/80">
                    {paymentNotice}
                  </div>
                ) : null}

                {paymentError ? (
                  <div className="rounded-xl border border-red-500/20 bg-red-600/5 px-4 py-3 text-sm text-red-200">
                    {paymentError}
                  </div>
                ) : null}

                <div className="overflow-hidden rounded-2xl border border-white/10 bg-[#0a0a0a]">
                  {isLoadingPayments ? (
                    <div className="px-5 py-14 text-center text-sm text-white/45">
                      Loading payment requests...
                    </div>
                  ) : filteredPaymentRequests.length === 0 ? (
                    <div className="px-5 py-14 text-center">
                      <p className="text-lg font-bold text-white">
                        No payment requests found
                      </p>
                      <p className="mt-2 text-sm text-white/45">
                        New user submissions will appear here for review.
                      </p>
                    </div>
                  ) : (
                    <div className="divide-y divide-white/10">
                      {filteredPaymentRequests.map((request) => {
                        const statusClass =
                          request.status === "approved"
                            ? "border-emerald-500/20 bg-emerald-500/10 text-emerald-300"
                            : request.status === "rejected"
                              ? "border-red-500/20 bg-red-500/10 text-red-300"
                              : "border-amber-500/20 bg-amber-500/10 text-amber-200";

                        return (
                          <article key={request.id} className="p-5 sm:p-6">
                            <div className="flex flex-col gap-5 xl:flex-row xl:items-start xl:justify-between">
                              <div className="min-w-0">
                                <div className="flex flex-wrap items-center gap-2">
                                  <h3 className="text-lg font-black text-white">
                                    {request.displayName || "VELORA Viewer"}
                                  </h3>
                                  <span
                                    className={`rounded-full border px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.16em] ${statusClass}`}
                                  >
                                    {request.status}
                                  </span>
                                </div>

                                <p className="mt-1 break-all text-sm text-white/45">
                                  {request.userEmail || "No email"}
                                </p>

                                <div className="mt-5 grid gap-3 text-sm sm:grid-cols-2 xl:grid-cols-4">
                                  <div className="rounded-xl border border-white/10 bg-white/[0.02] p-3">
                                    <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-white/30">
                                      Plan
                                    </p>
                                    <p className="mt-2 font-semibold text-white/80">
                                      {request.planName}
                                    </p>
                                  </div>
                                  <div className="rounded-xl border border-white/10 bg-white/[0.02] p-3">
                                    <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-white/30">
                                      Method
                                    </p>
                                    <p className="mt-2 font-semibold text-white/80">
                                      {request.paymentMethodName}
                                    </p>
                                  </div>
                                  <div className="rounded-xl border border-white/10 bg-white/[0.02] p-3">
                                    <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-white/30">
                                      Amount
                                    </p>
                                    <p className="mt-2 font-semibold text-white/80">
                                      PKR {request.amount}
                                    </p>
                                  </div>
                                  <div className="rounded-xl border border-white/10 bg-white/[0.02] p-3">
                                    <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-white/30">
                                      Reference
                                    </p>
                                    <p className="mt-2 break-all font-semibold text-white/80">
                                      {request.transactionReference || "—"}
                                    </p>
                                  </div>
                                </div>

                                <p className="mt-4 text-xs text-white/35">
                                  Submitted:{" "}
                                  {new Date(request.submittedAt).toLocaleString(
                                    "en-PK"
                                  )}
                                </p>
                              </div>

                              <div className="w-full shrink-0 xl:w-80">
                                {request.receiptUrl ? (
                                  <a
                                    href={request.receiptUrl}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="block overflow-hidden rounded-2xl border border-white/10 bg-black/30"
                                  >
                                    {/* eslint-disable-next-line @next/next/no-img-element */}
                                    <img
                                      src={request.receiptUrl}
                                      alt="Payment receipt"
                                      className="h-44 w-full object-contain"
                                    />
                                    <div className="border-t border-white/10 px-4 py-3 text-center text-xs font-semibold text-white/60">
                                      Open private receipt
                                    </div>
                                  </a>
                                ) : (
                                  <div className="rounded-2xl border border-dashed border-white/10 bg-black/20 px-4 py-10 text-center text-sm text-white/35">
                                    Receipt unavailable
                                  </div>
                                )}

                                {request.status === "pending" ? (
                                  <div className="mt-4 space-y-3">
                                    <textarea
                                      value={paymentNotes[request.id] ?? ""}
                                      onChange={(event) =>
                                        setPaymentNotes((current) => ({
                                          ...current,
                                          [request.id]: event.target.value,
                                        }))
                                      }
                                      rows={3}
                                      maxLength={500}
                                      placeholder="Optional admin note..."
                                      className="w-full resize-y rounded-xl border border-white/10 bg-[#151515] px-3 py-3 text-sm text-white outline-none transition placeholder:text-white/25 focus:border-red-500/60 focus:ring-2 focus:ring-red-500/20"
                                    />

                                    <div className="grid grid-cols-2 gap-2">
                                      <button
                                        type="button"
                                        onClick={() =>
                                          void handlePaymentReview(
                                            request.id,
                                            "rejected"
                                          )
                                        }
                                        disabled={Boolean(reviewingPaymentId)}
                                        className="rounded-xl border border-red-500/20 bg-red-600/[0.06] px-3 py-2.5 text-sm font-bold text-red-200 transition hover:bg-red-600/10 disabled:cursor-not-allowed disabled:opacity-50"
                                      >
                                        {reviewingPaymentId === request.id
                                          ? "Saving..."
                                          : "Reject"}
                                      </button>

                                      <button
                                        type="button"
                                        onClick={() =>
                                          void handlePaymentReview(
                                            request.id,
                                            "approved"
                                          )
                                        }
                                        disabled={Boolean(reviewingPaymentId)}
                                        className="rounded-xl bg-emerald-600 px-3 py-2.5 text-sm font-bold text-white transition hover:bg-emerald-500 disabled:cursor-not-allowed disabled:opacity-50"
                                      >
                                        {reviewingPaymentId === request.id
                                          ? "Saving..."
                                          : "Approve"}
                                      </button>
                                    </div>
                                  </div>
                                ) : (
                                  <div className="mt-4 rounded-xl border border-white/10 bg-white/[0.02] p-4 text-sm text-white/45">
                                    {request.adminNote
                                      ? `Admin note: ${request.adminNote}`
                                      : request.status === "approved"
                                        ? "This payment has been approved."
                                        : "This payment has been rejected."}
                                  </div>
                                )}
                              </div>
                            </div>
                          </article>
                        );
                      })}
                    </div>
                  )}
                </div>

                <section className="rounded-2xl border border-white/10 bg-[#0a0a0a] p-5 sm:p-6">
                  <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
                    <div>
                      <p className="text-xs font-bold uppercase tracking-[0.22em] text-red-400">
                        Payment methods
                      </p>
                      <h3 className="mt-2 text-xl font-black text-white">
                        Manage Easypaisa, JazzCash and bank details
                      </h3>
                      <p className="mt-2 max-w-3xl text-sm leading-6 text-white/45">
                        These details are shown to viewers on the account payment form.
                        Inactive methods disappear from the public payment selector.
                      </p>
                    </div>
                  </div>

                  {paymentMethodNotice ? (
                    <div className="mt-5 rounded-xl border border-emerald-500/20 bg-emerald-500/5 px-4 py-3 text-sm text-emerald-100/80">
                      {paymentMethodNotice}
                    </div>
                  ) : null}

                  {paymentMethodError ? (
                    <div className="mt-5 rounded-xl border border-red-500/20 bg-red-600/5 px-4 py-3 text-sm text-red-200">
                      {paymentMethodError}
                    </div>
                  ) : null}

                  {isLoadingPaymentMethods ? (
                    <div className="mt-6 rounded-xl border border-dashed border-white/10 px-5 py-10 text-center text-sm text-white/40">
                      Loading payment methods...
                    </div>
                  ) : (
                    <div className="mt-6 grid gap-4 xl:grid-cols-3">
                      {paymentMethods.map((method) => (
                        <div
                          key={method.id}
                          className="rounded-2xl border border-white/10 bg-white/[0.02] p-5"
                        >
                          <div className="flex items-start justify-between gap-4">
                            <div>
                              <p className="text-lg font-black text-white">
                                {method.name}
                              </p>
                              <p className="mt-1 text-xs text-white/35">
                                {method.slug}
                              </p>
                            </div>

                            <label className="flex items-center gap-2 text-xs font-semibold text-white/55">
                              <input
                                type="checkbox"
                                checked={method.isActive}
                                onChange={(event) =>
                                  setPaymentMethods((current) =>
                                    current.map((item) =>
                                      item.id === method.id
                                        ? {
                                            ...item,
                                            isActive: event.target.checked,
                                          }
                                        : item
                                    )
                                  )
                                }
                                className="h-4 w-4 accent-red-600"
                              />
                              Active
                            </label>
                          </div>

                          <div className="mt-5 space-y-4">
                            <label className="block space-y-2 text-sm text-white/60">
                              Account title
                              <input
                                value={method.accountTitle}
                                onChange={(event) =>
                                  setPaymentMethods((current) =>
                                    current.map((item) =>
                                      item.id === method.id
                                        ? {
                                            ...item,
                                            accountTitle: event.target.value,
                                          }
                                        : item
                                    )
                                  )
                                }
                                placeholder="Example: Ghulam Mustafa"
                                className="h-11 w-full rounded-xl border border-white/10 bg-[#151515] px-3 text-white outline-none transition placeholder:text-white/25 focus:border-red-500/60 focus:ring-2 focus:ring-red-500/20"
                              />
                            </label>

                            <label className="block space-y-2 text-sm text-white/60">
                              Account number
                              <input
                                value={method.accountNumber}
                                onChange={(event) =>
                                  setPaymentMethods((current) =>
                                    current.map((item) =>
                                      item.id === method.id
                                        ? {
                                            ...item,
                                            accountNumber: event.target.value,
                                          }
                                        : item
                                    )
                                  )
                                }
                                placeholder="Mobile wallet or bank account number"
                                className="h-11 w-full rounded-xl border border-white/10 bg-[#151515] px-3 text-white outline-none transition placeholder:text-white/25 focus:border-red-500/60 focus:ring-2 focus:ring-red-500/20"
                              />
                            </label>

                            <label className="block space-y-2 text-sm text-white/60">
                              IBAN
                              <input
                                value={method.iban}
                                onChange={(event) =>
                                  setPaymentMethods((current) =>
                                    current.map((item) =>
                                      item.id === method.id
                                        ? {
                                            ...item,
                                            iban: event.target.value,
                                          }
                                        : item
                                    )
                                  )
                                }
                                placeholder="Optional — mainly for bank transfer"
                                className="h-11 w-full rounded-xl border border-white/10 bg-[#151515] px-3 text-white outline-none transition placeholder:text-white/25 focus:border-red-500/60 focus:ring-2 focus:ring-red-500/20"
                              />
                            </label>

                            <label className="block space-y-2 text-sm text-white/60">
                              Instructions
                              <textarea
                                value={method.instructions}
                                onChange={(event) =>
                                  setPaymentMethods((current) =>
                                    current.map((item) =>
                                      item.id === method.id
                                        ? {
                                            ...item,
                                            instructions: event.target.value,
                                          }
                                        : item
                                    )
                                  )
                                }
                                rows={4}
                                maxLength={500}
                                placeholder="Tell the viewer how to send payment."
                                className="w-full resize-y rounded-xl border border-white/10 bg-[#151515] px-3 py-3 text-white outline-none transition placeholder:text-white/25 focus:border-red-500/60 focus:ring-2 focus:ring-red-500/20"
                              />
                            </label>

                            <label className="block space-y-2 text-sm text-white/60">
                              Sort order
                              <input
                                type="number"
                                value={method.sortOrder}
                                onChange={(event) =>
                                  setPaymentMethods((current) =>
                                    current.map((item) =>
                                      item.id === method.id
                                        ? {
                                            ...item,
                                            sortOrder:
                                              Number(event.target.value) || 0,
                                          }
                                        : item
                                    )
                                  )
                                }
                                className="h-11 w-full rounded-xl border border-white/10 bg-[#151515] px-3 text-white outline-none transition focus:border-red-500/60 focus:ring-2 focus:ring-red-500/20"
                              />
                            </label>

                            <button
                              type="button"
                              onClick={() => void handlePaymentMethodSave(method)}
                              disabled={Boolean(savingPaymentMethodId)}
                              className="w-full rounded-xl bg-red-600 px-4 py-3 text-sm font-bold text-white transition hover:bg-red-500 disabled:cursor-not-allowed disabled:opacity-50"
                            >
                              {savingPaymentMethodId === method.id
                                ? "Saving..."
                                : `Save ${method.name}`}
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </section>

                <div className="rounded-2xl border border-white/10 bg-[#0a0a0a] px-5 py-4 text-xs leading-5 text-white/40">
                  Receipt links are temporary signed URLs generated by the
                  protected admin API. The payment-receipts bucket remains
                  private.
                </div>
              </div>
            ) : activeSection === "Settings" ? (
              <form onSubmit={handleSettingsSubmit} className="space-y-5">
                <div className="rounded-2xl border border-white/10 bg-[#0b0b0b] p-5">
                  <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
                    <div>
                      <p className="text-xs font-bold uppercase tracking-[0.22em] text-red-400">
                        Global configuration
                      </p>
                      <h2 className="mt-2 text-2xl font-black tracking-tight text-white">
                        VELORA settings
                      </h2>
                      <p className="mt-2 max-w-3xl text-sm leading-6 text-white/45">
                        Manage the public-facing brand copy and global catalogue behavior from one place.
                      </p>
                    </div>

                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={handleResetSettings}
                        disabled={isSavingSettings || isLoadingSettings}
                        className="rounded-full border border-white/10 px-4 py-2.5 text-sm font-semibold text-white/55 transition hover:border-white/20 hover:text-white disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        Load defaults
                      </button>

                      <button
                        type="submit"
                        disabled={isSavingSettings || isLoadingSettings}
                        className="rounded-full bg-red-600 px-5 py-2.5 text-sm font-bold text-white transition hover:bg-red-500 focus:outline-none focus:ring-2 focus:ring-red-500/50 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        {isSavingSettings ? "Saving..." : "Save Settings"}
                      </button>
                    </div>
                  </div>
                </div>

                {settingsNotice ? (
                  <div
                    role="status"
                    className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 px-4 py-3 text-sm text-emerald-100/80"
                  >
                    {settingsNotice}
                  </div>
                ) : null}

                {settingsError ? (
                  <div
                    role="alert"
                    className="rounded-xl border border-red-500/20 bg-red-600/5 px-4 py-3 text-sm text-red-200"
                  >
                    {settingsError}
                  </div>
                ) : null}

                <div className="grid gap-5 xl:grid-cols-[1.15fr_0.85fr]">
                  <section className="rounded-2xl border border-white/10 bg-[#0a0a0a] p-5 sm:p-6">
                    <p className="text-xs font-bold uppercase tracking-[0.2em] text-white/35">
                      Branding & copy
                    </p>
                    <h3 className="mt-2 text-xl font-black text-white">
                      Public identity
                    </h3>

                    <div className="mt-6 grid gap-5 sm:grid-cols-2">
                      <label className="space-y-2 text-sm text-white/65">
                        Site title
                        <input
                          value={siteSettings.siteTitle}
                          onChange={(event) =>
                            setSiteSettings((current) => ({
                              ...current,
                              siteTitle: event.target.value,
                            }))
                          }
                          disabled={isLoadingSettings || isSavingSettings}
                          maxLength={60}
                          className="h-11 w-full rounded-xl border border-white/10 bg-[#171717] px-3 text-white outline-none transition focus:border-red-500/60 focus:ring-2 focus:ring-red-500/20 disabled:opacity-60"
                        />
                      </label>

                      <label className="space-y-2 text-sm text-white/65">
                        Default category
                        <select
                          value={siteSettings.defaultCategory}
                          onChange={(event) =>
                            setSiteSettings((current) => ({
                              ...current,
                              defaultCategory: event.target.value,
                            }))
                          }
                          disabled={isLoadingSettings || isSavingSettings}
                          className="h-11 w-full rounded-xl border border-white/10 bg-[#171717] px-3 text-white outline-none transition focus:border-red-500/60 focus:ring-2 focus:ring-red-500/20 disabled:opacity-60"
                        >
                          <option value="All">All</option>
                          {categorySummaries.map((category) => (
                            <option key={category.name} value={category.name}>
                              {category.name}
                            </option>
                          ))}
                        </select>
                      </label>
                    </div>

                    <label className="mt-5 block space-y-2 text-sm text-white/65">
                      Tagline
                      <input
                        value={siteSettings.tagline}
                        onChange={(event) =>
                          setSiteSettings((current) => ({
                            ...current,
                            tagline: event.target.value,
                          }))
                        }
                        disabled={isLoadingSettings || isSavingSettings}
                        maxLength={140}
                        className="h-11 w-full rounded-xl border border-white/10 bg-[#171717] px-3 text-white outline-none transition focus:border-red-500/60 focus:ring-2 focus:ring-red-500/20 disabled:opacity-60"
                      />
                    </label>

                    <label className="mt-5 block space-y-2 text-sm text-white/65">
                      Hero heading
                      <input
                        value={siteSettings.heroHeading}
                        onChange={(event) =>
                          setSiteSettings((current) => ({
                            ...current,
                            heroHeading: event.target.value,
                          }))
                        }
                        disabled={isLoadingSettings || isSavingSettings}
                        maxLength={100}
                        className="h-11 w-full rounded-xl border border-white/10 bg-[#171717] px-3 text-white outline-none transition focus:border-red-500/60 focus:ring-2 focus:ring-red-500/20 disabled:opacity-60"
                      />
                    </label>

                    <label className="mt-5 block space-y-2 text-sm text-white/65">
                      Hero subheading
                      <textarea
                        value={siteSettings.heroSubheading}
                        onChange={(event) =>
                          setSiteSettings((current) => ({
                            ...current,
                            heroSubheading: event.target.value,
                          }))
                        }
                        disabled={isLoadingSettings || isSavingSettings}
                        rows={3}
                        maxLength={260}
                        className="w-full resize-y rounded-xl border border-white/10 bg-[#171717] px-3 py-3 text-white outline-none transition focus:border-red-500/60 focus:ring-2 focus:ring-red-500/20 disabled:opacity-60"
                      />
                    </label>

                    <label className="mt-5 block space-y-2 text-sm text-white/65">
                      Footer text
                      <input
                        value={siteSettings.footerText}
                        onChange={(event) =>
                          setSiteSettings((current) => ({
                            ...current,
                            footerText: event.target.value,
                          }))
                        }
                        disabled={isLoadingSettings || isSavingSettings}
                        maxLength={160}
                        className="h-11 w-full rounded-xl border border-white/10 bg-[#171717] px-3 text-white outline-none transition focus:border-red-500/60 focus:ring-2 focus:ring-red-500/20 disabled:opacity-60"
                      />
                    </label>
                  </section>

                  <div className="space-y-5">
                    <section className="rounded-2xl border border-white/10 bg-[#0a0a0a] p-5 sm:p-6">
                      <p className="text-xs font-bold uppercase tracking-[0.2em] text-white/35">
                        Site state
                      </p>
                      <h3 className="mt-2 text-xl font-black text-white">
                        Global controls
                      </h3>

                      <label className="mt-6 flex items-start justify-between gap-5 rounded-xl border border-white/10 bg-white/[0.02] p-4">
                        <div>
                          <p className="text-sm font-semibold text-white">Maintenance mode</p>
                          <p className="mt-1 text-xs leading-5 text-white/40">Prepared for a future public maintenance screen.</p>
                        </div>
                        <input
                          type="checkbox"
                          checked={siteSettings.maintenanceMode}
                          onChange={(event) =>
                            setSiteSettings((current) => ({
                              ...current,
                              maintenanceMode: event.target.checked,
                            }))
                          }
                          disabled={isLoadingSettings || isSavingSettings}
                          className="mt-1 h-5 w-5 shrink-0 accent-red-600"
                        />
                      </label>

                      <label className="mt-3 flex items-start justify-between gap-5 rounded-xl border border-white/10 bg-white/[0.02] p-4">
                        <div>
                          <p className="text-sm font-semibold text-white">Global notice</p>
                          <p className="mt-1 text-xs leading-5 text-white/40">Enable a homepage-wide announcement banner.</p>
                        </div>
                        <input
                          type="checkbox"
                          checked={siteSettings.globalNoticeEnabled}
                          onChange={(event) =>
                            setSiteSettings((current) => ({
                              ...current,
                              globalNoticeEnabled: event.target.checked,
                            }))
                          }
                          disabled={isLoadingSettings || isSavingSettings}
                          className="mt-1 h-5 w-5 shrink-0 accent-red-600"
                        />
                      </label>

                      <label className="mt-4 block space-y-2 text-sm text-white/65">
                        Notice message
                        <textarea
                          value={siteSettings.globalNotice}
                          onChange={(event) =>
                            setSiteSettings((current) => ({
                              ...current,
                              globalNotice: event.target.value,
                            }))
                          }
                          disabled={
                            isLoadingSettings ||
                            isSavingSettings ||
                            !siteSettings.globalNoticeEnabled
                          }
                          rows={4}
                          maxLength={240}
                          placeholder="Example: New channels are being added this week."
                          className="w-full resize-y rounded-xl border border-white/10 bg-[#171717] px-3 py-3 text-white outline-none transition placeholder:text-white/25 focus:border-red-500/60 focus:ring-2 focus:ring-red-500/20 disabled:cursor-not-allowed disabled:opacity-45"
                        />
                      </label>
                    </section>

                    <section className="rounded-2xl border border-red-500/15 bg-[radial-gradient(circle_at_top_right,rgba(220,38,38,0.12),transparent_50%),#0a0a0a] p-5 sm:p-6">
                      <p className="text-xs font-bold uppercase tracking-[0.2em] text-red-400">Live preview</p>
                      <h3 className="mt-4 text-3xl font-black tracking-tight text-white">
                        {siteSettings.siteTitle || "VELORA"}
                      </h3>
                      <p className="mt-2 text-sm text-white/50">
                        {siteSettings.tagline || "Your tagline will appear here."}
                      </p>
                      <div className="mt-6 border-t border-white/10 pt-5">
                        <p className="text-xs font-bold uppercase tracking-[0.18em] text-white/30">Hero</p>
                        <p className="mt-3 text-2xl font-black text-white">
                          {siteSettings.heroHeading || "Hero heading"}
                        </p>
                        <p className="mt-2 text-sm leading-6 text-white/45">
                          {siteSettings.heroSubheading || "Hero subheading preview."}
                        </p>
                      </div>
                      {siteSettings.globalNoticeEnabled && siteSettings.globalNotice ? (
                        <div className="mt-5 rounded-xl border border-red-500/20 bg-red-600/5 px-4 py-3 text-xs leading-5 text-red-100/75">
                          {siteSettings.globalNotice}
                        </div>
                      ) : null}
                    </section>
                  </div>
                </div>

                <div className="rounded-2xl border border-white/10 bg-[#0a0a0a] p-5 text-sm text-white/45">
                  <p className="font-semibold text-white/70">Settings are stored in Supabase.</p>
                  <p className="mt-2 leading-6">
                    Saving here does not consume YouTube API quota. The public homepage can read these values through a lightweight settings endpoint in the next step.
                  </p>
                </div>
              </form>
            ) : (
              <div className="rounded-2xl border border-dashed border-white/15 bg-[#0a0a0a] px-6 py-20 text-center">
                <p className="text-2xl font-black text-white">
                  {activeSection} workspace
                </p>
                <p className="mt-3 text-sm text-white/45">
                  This section is reserved for a future VELORA admin phase.
                </p>
              </div>
            )}
          </div>
        </section>
      </div>

      <ChannelFormModal
        key={editingDatabaseId ?? (formChannel ? "new-channel" : "closed")}
        channel={formChannel}
        onClose={closeForm}
        onSubmit={handleChannelSubmit}
        isSaving={isSaving}
        saveError={saveError}
        isPersistentEdit={Boolean(editingDatabaseId)}
        onLogoUpload={handleLogoUpload}
        isUploadingLogo={isUploadingLogo}
        logoUploadError={logoUploadError}
        plans={plans}
      />
    </main>
  );
}
