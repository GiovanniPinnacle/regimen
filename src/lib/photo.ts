// Photo upload helper — client-side only.
// Uploads to user's folder in the appropriate Supabase Storage bucket.

import { createClient } from "@/lib/supabase/client";

export type PhotoBucket = "meal-photos" | "supplement-photos" | "scalp-photos";

export async function uploadPhoto(
  file: File,
  bucket: PhotoBucket,
): Promise<{ path: string; publicUrl: string } | { error: string }> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not signed in" };

  const ext = file.name.split(".").pop()?.toLowerCase() ?? "jpg";
  const path = `${user.id}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;

  const { error } = await supabase.storage
    .from(bucket)
    .upload(path, file, {
      cacheControl: "3600",
      upsert: false,
      contentType: file.type || "image/jpeg",
    });

  if (error) return { error: error.message };

  // Signed URL valid for 1 hour so our server route can fetch the image
  const { data: signed } = await supabase.storage
    .from(bucket)
    .createSignedUrl(path, 3600);

  return { path, publicUrl: signed?.signedUrl ?? "" };
}
