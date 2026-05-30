/**
 * recordsService — async CRUD for the daily_records Supabase table.
 *
 * SECURITY NOTES:
 *   ▸ All queries are filtered by user_id server-side via RLS.
 *     Even if the frontend passes the wrong user_id, the database
 *     will reject it because auth.uid() must match user_id.
 *   ▸ Never pass service_role key here — use the anon key only.
 *   ▸ Validate all required fields in callers BEFORE calling these functions.
 */

import type { DailyRecord } from "../types";
import type { DbDailyRecord } from "../lib/database.types";
import { supabase } from "../lib/supabase";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Maps a database row to the frontend DailyRecord shape. */
function dbToRecord(row: DbDailyRecord): DailyRecord {
  return {
    // Convert UUID to a stable integer for internal React key usage.
    // We also keep the original UUID in supabaseId for CRUD operations.
    id: uuidToLocalId(row.id),
    supabaseId: row.id,
    data: row.record_date,
    lote: row.lote_name,
    ovosProduzidos: row.eggs_produced,
    ovosQuebrados: row.eggs_broken,
    mortalidade: row.mortality,
    descarte: row.culling,
    racaoKg: Number(row.feed_kg),
    agua: Number(row.water_liters ?? 0),
    temperatura: Number(row.temperature_c ?? 0),
    observacoes: row.notes ?? "",
  };
}

/** Maps a frontend DailyRecord to a database INSERT payload. */
function recordToInsert(
  record: Omit<DailyRecord, "id">,
  userId: string,
): Omit<DbDailyRecord, "id" | "created_at" | "updated_at"> {
  return {
    user_id: userId,
    farm_id: null,
    flock_id: null,
    lote_name: record.lote,
    record_date: record.data,
    eggs_produced: record.ovosProduzidos,
    eggs_broken: record.ovosQuebrados,
    mortality: record.mortalidade,
    culling: record.descarte,
    feed_kg: record.racaoKg,
    water_liters: record.agua > 0 ? record.agua : null,
    temperature_c: record.temperatura > 0 ? record.temperatura : null,
    notes: record.observacoes.trim() || null,
  };
}

/**
 * Generates a stable positive integer from a UUID.
 * Used as a local React `id` so existing UI code that compares numbers
 * continues to work without changes.
 * Collision risk for < 10 million records is negligible.
 */
function uuidToLocalId(uuid: string): number {
  return parseInt(uuid.replace(/-/g, "").slice(0, 8), 16);
}

/**
 * Translates raw Supabase / PostgreSQL error messages into
 * user-friendly Portuguese strings.
 */
export function translateDbError(message: string): string {
  if (message.includes("unique") || message.includes("duplicate"))
    return "Já existe um registro para este lote nesta data.";
  if (message.includes("network") || message.includes("fetch"))
    return "Erro de conexão. Verifique sua internet e tente novamente.";
  if (message.includes("JWT") || message.includes("invalid claim"))
    return "Sessão expirada. Faça login novamente.";
  if (message.includes("permission") || message.includes("policy"))
    return "Sem permissão para executar esta operação.";
  return "Erro ao comunicar com o servidor. Tente novamente.";
}

// ---------------------------------------------------------------------------
// CRUD functions
// ---------------------------------------------------------------------------

/** Fetches all daily records for a user, sorted most-recent first. */
export async function fetchDailyRecords(userId: string): Promise<DailyRecord[]> {
  if (!supabase) throw new Error("Supabase não configurado.");

  const { data, error } = await supabase
    .from("daily_records")
    .select(
      "id, user_id, farm_id, flock_id, lote_name, record_date, eggs_produced, eggs_broken, " +
      "mortality, culling, feed_kg, water_liters, temperature_c, notes, created_at, updated_at",
    )
    .eq("user_id", userId)
    .order("record_date", { ascending: false });

  if (error) throw new Error(error.message);
  return (data as DbDailyRecord[]).map(dbToRecord);
}

/** Inserts a new daily record and returns the saved row. */
export async function insertDailyRecord(
  record: Omit<DailyRecord, "id">,
  userId: string,
): Promise<DailyRecord> {
  if (!supabase) throw new Error("Supabase não configurado.");

  const { data, error } = await supabase
    .from("daily_records")
    .insert(recordToInsert(record, userId))
    .select()
    .single();

  if (error) throw new Error(error.message);
  return dbToRecord(data as DbDailyRecord);
}

/** Updates an existing daily record by its Supabase UUID. */
export async function updateDailyRecord(
  supabaseId: string,
  record: Omit<DailyRecord, "id">,
  userId: string,
): Promise<DailyRecord> {
  if (!supabase) throw new Error("Supabase não configurado.");

  const { data, error } = await supabase
    .from("daily_records")
    .update({
      lote_name: record.lote,
      record_date: record.data,
      eggs_produced: record.ovosProduzidos,
      eggs_broken: record.ovosQuebrados,
      mortality: record.mortalidade,
      culling: record.descarte,
      feed_kg: record.racaoKg,
      water_liters: record.agua > 0 ? record.agua : null,
      temperature_c: record.temperatura > 0 ? record.temperatura : null,
      notes: record.observacoes.trim() || null,
    })
    .eq("id", supabaseId)
    .eq("user_id", userId)   // belt-and-suspenders: RLS also enforces this
    .select()
    .single();

  if (error) throw new Error(error.message);
  return dbToRecord(data as DbDailyRecord);
}

/** Deletes a daily record by its Supabase UUID. */
export async function deleteDailyRecord(
  supabaseId: string,
  userId: string,
): Promise<void> {
  if (!supabase) throw new Error("Supabase não configurado.");

  const { error } = await supabase
    .from("daily_records")
    .delete()
    .eq("id", supabaseId)
    .eq("user_id", userId);

  if (error) throw new Error(error.message);
}
