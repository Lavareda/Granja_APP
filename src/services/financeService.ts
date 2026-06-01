import type { DbEggSale } from "../lib/database.types";
import { supabase } from "../lib/supabase";
import type { EggSale } from "../types";

function uuidToLocalId(uuid: string): number {
  return parseInt(uuid.replace(/-/g, "").slice(0, 8), 16);
}

function dbToSale(row: DbEggSale): EggSale {
  return {
    id: uuidToLocalId(row.id),
    supabaseId: row.id,
    dataVenda: row.sale_date,
    cliente: row.customer_name,
    quantidadeDuzias: row.qty_dozens,
    quantidadeCaixas: row.qty_boxes,
    precoPorDuzia: Number(row.price_per_dozen),
    precoPorCaixa: Number(row.price_per_box),
    valorTotal: Number(row.total_amount),
    formaPagamento: row.payment_method,
    status: row.status,
  };
}

export async function fetchEggSales(userId: string): Promise<EggSale[]> {
  if (!supabase) throw new Error("Supabase não configurado.");

  const { data, error } = await supabase
    .from("egg_sales")
    .select("id, user_id, farm_id, sale_date, customer_name, qty_dozens, qty_boxes, price_per_dozen, price_per_box, total_amount, payment_method, status, created_at, updated_at")
    .eq("user_id", userId)
    .order("sale_date", { ascending: false });

  if (error) throw new Error(error.message);
  return ((data ?? []) as DbEggSale[]).map(dbToSale);
}

export async function insertEggSale(sale: Omit<EggSale, "id" | "supabaseId">, userId: string): Promise<EggSale> {
  if (!supabase) throw new Error("Supabase não configurado.");

  const { data, error } = await supabase
    .from("egg_sales")
    .insert({
      user_id: userId,
      farm_id: null,
      sale_date: sale.dataVenda,
      customer_name: sale.cliente,
      qty_dozens: sale.quantidadeDuzias,
      qty_boxes: sale.quantidadeCaixas,
      price_per_dozen: sale.precoPorDuzia,
      price_per_box: sale.precoPorCaixa,
      total_amount: sale.valorTotal,
      payment_method: sale.formaPagamento,
      status: sale.status,
    })
    .select()
    .single();

  if (error) throw new Error(error.message);
  if (!data) throw new Error("Venda não retornada pelo servidor.");
  return dbToSale(data as DbEggSale);
}

export async function resetOperationalData(userId: string): Promise<void> {
  if (!supabase) throw new Error("Supabase não configurado.");

  const tables = ["daily_records", "financial_records", "inventory_items", "health_events", "egg_sales"];
  for (const table of tables) {
    const { error } = await supabase.from(table).delete().eq("user_id", userId);
    if (error) throw new Error(error.message);
  }
}
