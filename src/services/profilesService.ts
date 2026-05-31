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

export async function fetchOwnProfile(userId: string, email?: string | null): Promise<UserProfile> {
  if (!supabase) throw new Error("Supabase não configurado.");

  const { data, error } = await supabase
    .from("profiles")
    .select("id, email, full_name, avatar_url, role, created_at, updated_at")
    .eq("id", userId)
    .maybeSingle();

  if (error) throw new Error(error.message);

  if (!data) {
    return {
      id: userId,
      email: normalizeEmail(email),
      role: roleForEmail(email),
      isProtected: isProtectedEmpresarioEmail(email),
    };
  }

  const profile = dbToProfile(data as DbProfile);
  return {
    ...profile,
    email: profile.email || normalizeEmail(email),
    role: roleForEmail(profile.email || email, profile.role),
    isProtected: isProtectedEmpresarioEmail(profile.email || email),
  };
}

export async function fetchProfiles(): Promise<UserProfile[]> {
  if (!supabase) throw new Error("Supabase não configurado.");

  const { data, error } = await supabase
    .from("profiles")
    .select("id, email, full_name, avatar_url, role, created_at, updated_at")
    .order("email", { ascending: true });

  if (error) throw new Error(error.message);
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
    .select("id, email, full_name, avatar_url, role, created_at, updated_at")
    .single();

  if (error) throw new Error(error.message);
  return dbToProfile(data as DbProfile);
}
