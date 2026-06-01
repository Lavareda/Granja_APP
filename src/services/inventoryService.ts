import type { DbInventoryItem } from "../lib/database.types";
import { supabase } from "../lib/supabase";
import type { InventoryItem } from "../types";

function uuidToLocalId(uuid: string): number {
  return parseInt(uuid.replace(/-/g, "").slice(0, 8), 16);
}

function dbToInventoryItem(row: DbInventoryItem): InventoryItem {
  return {
    id: uuidToLocalId(row.id),
    supabaseId: row.id,
    nome: row.name,
    quantidadeAtual: row.current_qty,
    estoqueMinimo: row.min_qty,
    unidade: row.unit,
    status: row.current_qty === 0 ? "critico" : row.current_qty <= row.min_qty ? "atencao" : "normal",
  };
}

export async function fetchInventoryItems(userId: string): Promise<InventoryItem[]> {
  if (!supabase) throw new Error("Supabase não configurado.");

  const { data, error } = await supabase
    .from("inventory_items")
    .select("id, user_id, name, current_qty, min_qty, unit, created_at, updated_at")
    .eq("user_id", userId)
    .order("name", { ascending: true });

  if (error) throw new Error(error.message);
  return ((data ?? []) as DbInventoryItem[]).map(dbToInventoryItem);
}

/**
 * Save a batch of inventory items to Supabase.
 *
 * Strategy:
 *  - Items that already have a supabaseId → UPDATE by primary key (no constraint dependency).
 *  - Items without a supabaseId → INSERT and return the new row with its UUID.
 *
 * This avoids relying on a UNIQUE(user_id, name) constraint for conflict resolution,
 * which was the root cause of "Erro ao salvar" errors in production.
 */
export async function upsertInventoryItems(userId: string, items: InventoryItem[]): Promise<InventoryItem[]> {
  if (!supabase) throw new Error("Supabase não configurado.");

  const results: InventoryItem[] = [];
  const toUpdate = items.filter((i) => i.supabaseId);
  const toInsert = items.filter((i) => !i.supabaseId);

  // UPDATE existing rows by primary key — most reliable, no constraint dependency.
  for (const item of toUpdate) {
    const { data, error } = await supabase
      .from("inventory_items")
      .update({
        name: item.nome,
        current_qty: item.quantidadeAtual,
        min_qty: item.estoqueMinimo,
        unit: item.unidade,
      })
      .eq("id", item.supabaseId!)
      .eq("user_id", userId)
      .select()
      .single();

    if (error) throw new Error(error.message);
    if (data) results.push(dbToInventoryItem(data as DbInventoryItem));
  }

  // INSERT new rows (e.g. first-time seed of catalog defaults).
  if (toInsert.length > 0) {
    const payload = toInsert.map((item) => ({
      user_id: userId,
      farm_id: null as string | null,
      name: item.nome,
      current_qty: item.quantidadeAtual,
      min_qty: item.estoqueMinimo,
      unit: item.unidade,
    }));

    const { data, error } = await supabase
      .from("inventory_items")
      .insert(payload)
      .select();

    if (error) throw new Error(error.message);
    results.push(...((data ?? []) as DbInventoryItem[]).map(dbToInventoryItem));
  }

  return results;
}
