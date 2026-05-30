/**
 * Supabase client for GranjaApp.
 *
 * SECURITY — please read before modifying:
 *   ▸ Only the anon key (VITE_SUPABASE_ANON_KEY) is used here.
 *     The anon key is safe to expose in frontend code because
 *     every table has Row Level Security (RLS) enabled.
 *   ▸ NEVER put the service_role key in frontend code.
 *     The service_role key bypasses RLS and grants full DB access.
 *   ▸ Keep your .env file out of Git (.gitignore already excludes it).
 *     Use .env.example to document required variables.
 *
 * When both env variables are present the app uses Supabase with real auth.
 * When they are absent the app runs in demo mode with localStorage only.
 */

import { createClient, SupabaseClient } from "@supabase/supabase-js";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

/** True when both Supabase env vars are present and non-empty. */
export const isSupabaseConfigured = Boolean(
  supabaseUrl?.trim() && supabaseAnonKey?.trim(),
);

/**
 * Typed Supabase client — null when running in demo mode.
 * Always check `isSupabaseConfigured` before using this.
 */
export const supabase: SupabaseClient | null = isSupabaseConfigured
  ? createClient(supabaseUrl!, supabaseAnonKey!, {
      auth: {
        // Persist the session in localStorage so page refreshes keep the user logged in.
        persistSession: true,
        autoRefreshToken: true,
      },
    })
  : null;
