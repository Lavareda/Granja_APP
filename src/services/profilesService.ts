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
  // Log the raw technical detail for developers; never expose it in the UI.
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

export async function ensureOwnProfile(userId: string, email?: string | null): Promise<UserProfile> {
  if (!supabase) throw new Error("Supabase não configurado.");

  const normalizedEmail = normalizeEmail(email);
  const defaultRole = roleForEmail(normalizedEmail, "granjeiro");

  const { data: existing, error: fetchError } = await supabase
    .from("profiles")
    .select(profileSelect())
    .eq("id", userId)
    .maybeSingle();

  if (fetchError) throw new Error(friendlyProfileError(fetchError.message));

  if (!existing) {
    const { data, error } = await supabase
      .from("profiles")
      .insert({ id: userId, email: normalizedEmail, role: defaultRole })
      .select(profileSelect())
      .single();

    if (error) throw new Error(friendlyProfileError(error.message));
    console.debug("profile created");
    return dbToProfile(data as DbProfile);
  }

  const profile = dbToProfile(existing as DbProfile);
  const nextRole = roleForEmail(normalizedEmail || profile.email, profile.role);
  const nextEmail = normalizedEmail || profile.email;
  const needsUpdate = profile.email !== nextEmail || profile.role !== nextRole;

  if (!needsUpdate) {
    console.debug("profile loaded");
    return profile;
  }

  const { data, error } = await supabase
    .from("profiles")
    .update({ email: nextEmail, role: nextRole })
    .eq("id", userId)
    .select(profileSelect())
    .single();

  if (error) throw new Error(friendlyProfileError(error.message));
  console.debug("profile loaded");
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
