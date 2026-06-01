import type { Vaccine } from "../types";
import { supabase } from "../lib/supabase";

/**
 * Vaccine service — expects a table `flock_vaccines` with columns:
 * id (uuid), user_id, flock_id, name, recommended_weeks, date_scheduled, date_applied, notes, created_at, updated_at
 * If the table is not present, these functions will throw and callers should fallback to localStorage.
 */

export async function fetchVaccines(flockId: string, userId: string): Promise<Vaccine[]> {
  if (!supabase) throw new Error("Supabase não configurado.");
  const { data, error } = await supabase
    .from("flock_vaccines")
    .select("id, name, recommended_weeks, date_scheduled, date_applied, notes")
    .eq("flock_id", flockId)
    .eq("user_id", userId)
    .order("recommended_weeks", { ascending: true });

  if (error) throw new Error(error.message);
  return (data as any[]).map((row: any, i: number) => ({
    id: i + 1,
    name: row.name,
    recommendedWeeks: row.recommended_weeks,
    dateScheduled: row.date_scheduled,
    dateApplied: row.date_applied,
    status: row.date_applied ? "aplicada" : "prevista",
    notes: row.notes ?? "",
  }));
}

export async function upsertVaccine(
  flockId: string,
  userId: string,
  payload: Partial<Vaccine> & { name: string; recommendedWeeks: number },
) {
  if (!supabase) throw new Error("Supabase não configurado.");
  // Upsert by unique (user_id, flock_id, name)
  const row = {
    user_id: userId,
    flock_id: flockId,
    name: payload.name,
    recommended_weeks: payload.recommendedWeeks,
    date_scheduled: payload.dateScheduled ?? null,
    date_applied: payload.dateApplied ?? null,
    notes: payload.notes ?? null,
  };

  const { data, error } = await supabase.from("flock_vaccines").upsert(row).select();
  if (error) throw new Error(error.message);
  return data;
}

export async function deleteVaccine(flockId: string, userId: string, name: string): Promise<void> {
  if (!supabase) throw new Error("Supabase não configurado.");

  const { error } = await supabase
    .from("flock_vaccines")
    .delete()
    .eq("flock_id", flockId)
    .eq("user_id", userId)
    .eq("name", name);

  if (error) throw new Error(error.message);
}
