import { createBrowserClient } from "@supabase/ssr";

function normalizeSupabaseUrl(url?: string): string {
  if (!url) return "https://placeholder.supabase.co";
  const trimmed = url.trim();
  // Extract project ref if a dashboard URL was pasted
  const match = trimmed.match(/project\/([a-z0-9_-]+)/i);
  if (match && match[1]) {
    return `https://${match[1]}.supabase.co`;
  }
  return trimmed;
}

const rawSupabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseUrl = normalizeSupabaseUrl(rawSupabaseUrl);
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim();

export const isSupabaseConfigured = (): boolean => {
  return Boolean(
    supabaseUrl &&
    supabaseAnonKey &&
    supabaseUrl.startsWith("https://") &&
    !supabaseUrl.includes("your-project.supabase.co") &&
    !supabaseUrl.includes("placeholder.supabase.co") &&
    supabaseAnonKey !== "your-anon-key-here" &&
    !supabaseAnonKey.includes("<")
  );
};

export const createClient = () => {
  const url = isSupabaseConfigured() ? supabaseUrl : "https://placeholder.supabase.co";
  const key = supabaseAnonKey || "placeholder-key";

  return createBrowserClient(url, key);
};
