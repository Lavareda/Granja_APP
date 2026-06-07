import type { DbProfile } from "../lib/database.types";
import { supabase } from "../lib/supabase";
import type { AccessRole, UserProfile } from "../types";

export const protectedEmpresarioEmails = [
  "amazonidalavareda@gmail.com",
  "phelipelavareda@hotmail.com",
];

export function normalizeEmail(email?: string | null) {
  return (email ?? "").trim().toLowerCase();
}

export function isProtectedEmpresarioEmail(email?: string | null) {
  return protectedEmpresarioEmails.includes(normalizeEmail(email));
}

export function roleForEmail(email?: string | null, fallback: AccessRole = "granjeiro"): AccessRole {
  return isProtectedEmpresarioEmail(email) ? "empresario" : fallback;
}

function profileSelect() {
  return "id, email, full_name, avatar_url, role, created_at, updated_at";
}

function friendlyProfileError(rawMessage: string): string {
  console.error("PROFILE service error:", rawMessage);
  if (rawMessage.includes("network") || rawMessage.includes("fetch")) {
    return "Erro de conexão. Verifique sua internet e tente novamente.";
  }
  return "Não foi possível carregar as permissões. Tente novamente.";
}

function dbToProfile(row: DbProfile): UserProfile {
  const email = normalizeEmail(row.email);
  return {
    id: row.id,
    email,
    fullName: row.full_name,
    role: roleForEmail(email, row.role),
    isProtected: isProtectedEmpresarioEmail(email),
  };
}

/**
 * Creates or updates the profile for the given user.
 *
 * Uses upsert (not plain insert) so concurrent SIGNED_IN / INITIAL_SESSION
 * events and retries never produce a duplicate-key error.
 *
 * Role assignment rules:
 *   1. Protected emails always receive "empresario".
 *   2. Existing "empresario" profiles are never downgraded.
 *   3. All other new users receive "granjeiro".
 */
export async function ensureOwnProfile(userId: string, email?: string | null): Promise<UserProfile> {
  if (!supabase) throw new Error("Supabase não configurado.");

  const normalizedEmail = normalizeEmail(email);

  // Read the current profile (if any) so we never downgrade an existing empresario.
  const { data: existing, error: fetchError } = await supabase
    .from("profiles")
    .select(profileSelect())
    .eq("id", userId)
    .maybeSingle();

  if (fetchError) {
    // Non-fatal on a fresh signup — log and continue to upsert.
    console.warn("PROFILE: fetch before upsert failed:", fetchError.message);
  }

  const existingRole = (existing as DbProfile | null)?.role ?? null;

  // Determine the role to persist:
  //   • Protected email  → always "empresario"
  //   • Already empresario → keep "empresario" (no downgrade)
  //   • Otherwise        → "granjeiro" (default for new users)
  const roleToSet: AccessRole = isProtectedEmpresarioEmail(normalizedEmail)
    ? "empresario"
    : existingRole === "empresario"
    ? "empresario"
    : "granjeiro";

  const { data, error } = await supabase
    .from("profiles")
    .upsert(
      { id: userId, email: normalizedEmail || null, role: roleToSet },
      { onConflict: "id" },
    )
    .select(profileSelect())
    .single();

  if (error) throw new Error(friendlyProfileError(error.message));
  console.debug("PROFILE: upserted", roleToSet);
  return dbToProfile(data as DbProfile);
}

export async function fetchOwnProfile(userId: string, email?: string | null): Promise<UserProfile> {
  return ensureOwnProfile(userId, email);
}

export async function fetchProfiles(): Promise<UserProfile[]> {
  if (!supabase) throw new Error("Supabase não configurado.");

  const { data, error } = await supabase
    .from("profiles")
    .select(profileSelect())
    .order("email", { ascending: true });

  if (error) throw new Error(friendlyProfileError(error.message));
  return ((data ?? []) as DbProfile[]).map(dbToProfile);
}

export async function updateProfileRole(profile: UserProfile, role: AccessRole): Promise<UserProfile> {
  if (!supabase) throw new Error("Supabase não configurado.");
  if (profile.isProtected && role !== "empresario") {
    throw new Error("Este usuário protegido deve permanecer como empresário.");
  }

  const nextRole = roleForEmail(profile.email, role);
  const { data, error } = await supabase
    .from("profiles")
    .update({ role: nextRole })
    .eq("id", profile.id)
    .select(profileSelect())
    .single();

  if (error) throw new Error(friendlyProfileError(error.message));
  return dbToProfile(data as DbProfile);
}
