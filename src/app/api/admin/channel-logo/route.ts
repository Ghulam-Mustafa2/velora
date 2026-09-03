import { NextResponse } from "next/server";
import { getSupabaseAdminClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/supabase/require-admin";

export const runtime = "nodejs";

const BUCKET_NAME = "channel-logos";
const MAX_FILE_SIZE = 2 * 1024 * 1024;

const ALLOWED_TYPES = new Set([
  "image/png",
  "image/jpeg",
  "image/webp",
  "image/svg+xml",
]);

function getSafeExtension(file: File) {
  const extensionFromName = file.name
    .split(".")
    .pop()
    ?.toLowerCase()
    .replace(/[^a-z0-9]/g, "");

  if (extensionFromName) {
    return extensionFromName;
  }

  switch (file.type) {
    case "image/png":
      return "png";
    case "image/jpeg":
      return "jpg";
    case "image/webp":
      return "webp";
    case "image/svg+xml":
      return "svg";
    default:
      return "bin";
  }
}

export async function POST(request: Request) {
  try {
    const user = await requireAdmin();

    if (!user) {
      return NextResponse.json(
        {
          ok: false,
          error: "Unauthorized",
        },
        { status: 401 }
      );
    }

    const formData = await request.formData();
    const file = formData.get("file");

    if (!(file instanceof File)) {
      return NextResponse.json(
        {
          ok: false,
          error: "Logo file is required.",
        },
        { status: 400 }
      );
    }

    if (!ALLOWED_TYPES.has(file.type)) {
      return NextResponse.json(
        {
          ok: false,
          error: "Only PNG, JPG, WEBP and SVG images are allowed.",
        },
        { status: 400 }
      );
    }

    if (file.size <= 0 || file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        {
          ok: false,
          error: "Logo must be smaller than 2 MB.",
        },
        { status: 400 }
      );
    }

    const supabase = getSupabaseAdminClient();

    const { data: buckets, error: bucketsError } =
      await supabase.storage.listBuckets();

    if (bucketsError) {
      return NextResponse.json(
        {
          ok: false,
          error: bucketsError.message,
        },
        { status: 500 }
      );
    }

    const bucketExists = buckets.some(
      (bucket) => bucket.name === BUCKET_NAME
    );

    if (!bucketExists) {
      const { error: createBucketError } =
        await supabase.storage.createBucket(BUCKET_NAME, {
          public: true,
          fileSizeLimit: MAX_FILE_SIZE,
          allowedMimeTypes: Array.from(ALLOWED_TYPES),
        });

      if (createBucketError) {
        return NextResponse.json(
          {
            ok: false,
            error: createBucketError.message,
          },
          { status: 500 }
        );
      }
    }

    const extension = getSafeExtension(file);
    const storagePath = `${crypto.randomUUID()}.${extension}`;
    const fileBytes = new Uint8Array(await file.arrayBuffer());

    const { error: uploadError } = await supabase.storage
      .from(BUCKET_NAME)
      .upload(storagePath, fileBytes, {
        contentType: file.type,
        cacheControl: "3600",
        upsert: false,
      });

    if (uploadError) {
      return NextResponse.json(
        {
          ok: false,
          error: uploadError.message,
        },
        { status: 500 }
      );
    }

    const { data: publicUrlData } = supabase.storage
      .from(BUCKET_NAME)
      .getPublicUrl(storagePath);

    return NextResponse.json(
      {
        ok: true,
        path: storagePath,
        url: publicUrlData.publicUrl,
      },
      { status: 201 }
    );
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
