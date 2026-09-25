import { supabase } from "../lib/supabase";

export const CARD_IMAGE_BUCKET = "qm-card-images";
const MAX_IMAGE_BYTES = 10 * 1024 * 1024;
const ALLOWED_IMAGE_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
]);

function safeExtension(file: File) {
  const byMime: Record<string, string> = {
    "image/jpeg": "jpg",
    "image/png": "png",
    "image/webp": "webp",
    "image/gif": "gif",
  };
  return byMime[file.type] ?? "img";
}

export async function uploadCardImage(
  userId: string,
  cardId: string,
  file: File,
): Promise<string> {
  if (!supabase) throw new Error("Supabaseに接続されていません。");
  if (!ALLOWED_IMAGE_TYPES.has(file.type)) {
    throw new Error("JPEG / PNG / WebP / GIF の画像を選択してください。");
  }
  if (file.size > MAX_IMAGE_BYTES) {
    throw new Error("画像は1枚10MB以下にしてください。");
  }

  const path = `${userId}/${cardId}/${crypto.randomUUID()}.${safeExtension(file)}`;
  const { error } = await supabase.storage
    .from(CARD_IMAGE_BUCKET)
    .upload(path, file, {
      cacheControl: "3600",
      contentType: file.type,
      upsert: false,
    });

  if (error) throw error;
  return path;
}

export async function createCardImageUrl(path: string): Promise<string> {
  if (!supabase) throw new Error("Supabaseに接続されていません。");
  const { data, error } = await supabase.storage
    .from(CARD_IMAGE_BUCKET)
    .createSignedUrl(path, 60 * 60);

  if (error) throw error;
  return data.signedUrl;
}

export async function deleteCardImages(paths: string[]) {
  if (!supabase || paths.length === 0) return;
  const { error } = await supabase.storage.from(CARD_IMAGE_BUCKET).remove(paths);
  if (error) throw error;
}

export function cardImageMarkdown(path: string, originalName: string) {
  const alt = originalName.replace(/[\]\r\n]/g, " ").trim() || "画像";
  return `![${alt}](qm-image:${path})`;
}
