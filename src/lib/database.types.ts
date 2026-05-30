/**
 * Supabase database types for GranjaApp.
 *
 * To regenerate from a linked project run:
 *   npx supabase gen types typescript --linked > src/lib/database.types.ts
 *
 * SECURITY: These types reflect the public schema only.
 * The anon key (used here) respects RLS — users only see their own rows.
 */

export type DbDailyRecord = {
  id: string;
  user_id: string;
  farm_id: string | null;
  flock_id: string | null;
  lote_name: string;
  record_date: string;       // ISO date YYYY-MM-DD
  eggs_produced: number;
  eggs_broken: number;
  mortality: number;
  culling: number;
  feed_kg: number;
  water_liters: number | null;
  temperature_c: number | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
};

export type DbDailyRecordInsert = Omit<DbDailyRecord, "id" | "created_at" | "updated_at"> & {
  id?: string;
};

export type DbDailyRecordUpdate = Partial<Omit<DbDailyRecord, "id" | "user_id" | "created_at" | "updated_at">>;

export type DbFarm = {
  id: string;
  user_id: string;
  name: string;
  location: string | null;
  capacity: number | null;
  active: boolean;
  created_at: string;
  updated_at: string;
};

export type DbFlock = {
  id: string;
  user_id: string;
  farm_id: string | null;
  name: string;
  breed: string | null;
  housing_date: string;
  initial_birds: number;
  active_birds: number;
  status: "ativo" | "observacao" | "encerrado";
  created_at: string;
  updated_at: string;
};

export type DbInventoryItem = {
  id: string;
  user_id: string;
  farm_id: string | null;
  name: string;
  current_qty: number;
  min_qty: number;
  unit: string;
  created_at: string;
  updated_at: string;
};

export type DbEggSale = {
  id: string;
  user_id: string;
  farm_id: string | null;
  sale_date: string;
  customer_name: string;
  qty_dozens: number;
  qty_boxes: number;
  price_per_dozen: number;
  price_per_box: number;
  total_amount: number;
  payment_method: "pix" | "dinheiro" | "cartao" | "boleto" | "transferencia";
  status: "pago" | "pendente";
  created_at: string;
  updated_at: string;
};

export type DbAlert = {
  id: string;
  user_id: string;
  farm_id: string | null;
  flock_id: string | null;
  title: string;
  detail: string | null;
  status: "normal" | "atencao" | "critico";
  resolved: boolean;
  resolved_at: string | null;
  created_at: string;
  updated_at: string;
};
