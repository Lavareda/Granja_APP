import type { DbFlock } from "../lib/database.types";
import { supabase } from "../lib/supabase";
import type { Flock } from "../types";

function uuidToLocalId(uuid: string): number {
  return parseInt(uuid.replace(/-/g, "").slice(0, 8), 16);
}

function dbToFlock(row: DbFlock): Flock {
  return {
    id: uuidToLocalId(row.id),
    supabaseId: row.id,
    nome: row.name,
    dataAlojamento: row.housing_date,
    linhagem: row.breed ?? "Hy-Line Brown",
    quantidadeInicial: row.initial_birds,
    quantidadeAtual: row.active_birds,
    status: row.status,
  };
}

type FlockPayload = Pick<Flock, "nome" | "dataAlojamento" | "linhagem" | "quantidadeInicial" | "quantidadeAtual" | "status">;

export async function fetchFlocks(userId: string): Promise<Flock[]> {
  if (!supabase) throw new Error("Supabase não configurado.");

  const { data, error } = await supabase
    .from("flocks")
    .select("id, user_id, farm_id, name, breed, housing_date, initial_birds, active_birds, status, created_at, updated_at")
    .eq("user_id", userId)
    .order("housing_date", { ascending: false });

  if (error) throw new Error(error.message);
  return ((data ?? []) as DbFlock[]).map(dbToFlock);
}

export async function insertFlock(userId: string, flock: FlockPayload): Promise<Flock> {
  if (!supabase) throw new Error("Supabase não configurado.");

  const { data, error } = await supabase
    .from("flocks")
    .insert({
      user_id: userId,
      farm_id: null,
      name: flock.nome,
      breed: flock.linhagem || null,
      housing_date: flock.dataAlojamento,
      initial_birds: flock.quantidadeInicial,
      active_birds: flock.quantidadeAtual,
      status: flock.status,
    })
    .select()
    .single();

  if (error) throw new Error(error.message);
  if (!data) throw new Error("Lote não retornado pelo servidor.");
  return dbToFlock(data as DbFlock);
}

export async function updateFlock(supabaseId: string, userId: string, flock: FlockPayload): Promise<void> {
  if (!supabase) throw new Error("Supabase não configurado.");

  const { error } = await supabase
    .from("flocks")
    .update({
      name: flock.nome,
      breed: flock.linhagem || null,
      housing_date: flock.dataAlojamento,
      initial_birds: flock.quantidadeInicial,
      active_birds: flock.quantidadeAtual,
      status: flock.status,
    })
    .eq("id", supabaseId)
    .eq("user_id", userId);

  if (error) throw new Error(error.message);
}

export async function deleteFlock(supabaseId: string, userId: string): Promise<void> {
  if (!supabase) throw new Error("Supabase não configurado.");

  const { error } = await supabase
    .from("flocks")
    .delete()
    .eq("id", supabaseId)
    .eq("user_id", userId);

  if (error) throw new Error(error.message);
}
