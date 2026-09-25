import { createClient } from "@supabase/supabase-js";

const url = import.meta.env.VITE_SUPABASE_URL?.trim();
const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY?.trim();

// Only public browser keys are accepted. Authorization is enforced by RLS.
export const configured = Boolean(
  url &&
  /^https:\/\/[a-z0-9.-]+(?::\d+)?\/?$/i.test(url) &&
  !url.includes("YOUR_PROJECT") &&
  key?.startsWith("sb_publishable_") &&
  !key.includes("REPLACE_ME"),
);

export const supabase = configured
  ? createClient(url!, key!, {
      auth: {
        storageKey: "question-app-auth",
        persistSession: true,
        autoRefreshToken: true,
      },
    })
  : null;
