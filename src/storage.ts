import { supabase } from "../lib/supabase";

export const CARD_IMAGE_BUCKET = "qm-card-images";
const MAX_IMAGE_BYTES = 10 * 1024 * 1024;
const ALLOWED_IMAGE_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
]);

function extensionFor(file: File) {
  const byType: Record<string, string> = {
    "image/jpeg": "jpg",
    "image/png": "png",
    "image/webp": "webp",
    "image/gif": "gif",
  };
  return byType[file.type] ?? "bin";
}

export async function uploadCardImage(
  userId: string,
  cardId: string,
  file: File,
) {
  if (!ALLOWED_IMAGE_TYPES.has(file.type)) {
    throw new Error("画像はJPEG・PNG・WebP・GIFを選択してください。");
  }
  if (file.size > MAX_IMAGE_BYTES) {
    throw new Error("画像は1枚10MB以下にしてください。");
  }

  const path = `${userId}/${cardId}/${crypto.randomUUID()}.${extensionFor(file)}`;
  const { error } = await supabase!.storage
    .from(CARD_IMAGE_BUCKET)
    .upload(path, file, {
      contentType: file.type,
      cacheControl: "3600",
      upsert: false,
    });
  if (error) throw error;
  return path;
}

export async function deleteCardImages(paths: string[]) {
  if (!paths.length) return;
  const { error } = await supabase!.storage.from(CARD_IMAGE_BUCKET).remove(paths);
  if (error) throw error;
}

export async function createCardImageUrl(path: string) {
  const { data, error } = await supabase!.storage
    .from(CARD_IMAGE_BUCKET)
    .createSignedUrl(path, 60 * 60);
  if (error) throw error;
  return data.signedUrl;
}

export function cardImageMarkdown(path: string, alt: string) {
  const safeAlt = alt.replace(/[\[\]]/g, "").trim() || "画像";
  return `![${safeAlt}](/qm-image/${path})`;
}
