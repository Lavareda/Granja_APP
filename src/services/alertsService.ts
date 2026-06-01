import { supabase } from "../lib/supabase";

/**
 * Alerts service — expects a table `alerts` with columns:
 * id (uuid), user_id, title, message, status, snoozed_until (timestamptz), resolved (boolean), resolved_at (timestamptz), created_at
 * Functions gracefully throw if Supabase isn't configured or table missing.
 */

export async function fetchActiveAlerts(userId: string) {
  if (!supabase) throw new Error("Supabase não configurado.");
  const nowIso = new Date().toISOString();
  const orFilter = `snoozed_until.is.null,snoozed_until.lt.${nowIso}`;
  const { data, error } = await supabase
    .from("alerts")
    .select("id, title, message, status, snoozed_until, resolved, resolved_at, created_at")
    .eq("user_id", userId)
    .eq("resolved", false)
    .or(orFilter)
    .order("created_at", { ascending: false });

  if (error) throw new Error(error.message);
  return data;
}

export async function fetchAllAlerts(userId: string) {
  if (!supabase) throw new Error("Supabase não configurado.");
  const { data, error } = await supabase
    .from("alerts")
    .select("id, title, message, status, snoozed_until, resolved, resolved_at, created_at")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });

  if (error) throw new Error(error.message);
  return data;
}

export async function snoozeAlert(alertId: string, userId: string, untilIso: string) {
  if (!supabase) throw new Error("Supabase não configurado.");
  const { data, error } = await supabase
    .from("alerts")
    .update({ snoozed_until: untilIso })
    .eq("id", alertId)
    .eq("user_id", userId)
    .select();
  if (error) throw new Error(error.message);
  return data;
}

export async function resolveAlert(alertId: string, userId: string) {
  if (!supabase) throw new Error("Supabase não configurado.");
  const nowIso = new Date().toISOString();
  const { data, error } = await supabase
    .from("alerts")
    .update({ resolved: true, resolved_at: nowIso })
    .eq("id", alertId)
    .eq("user_id", userId)
    .select();
  if (error) throw new Error(error.message);
  return data;
}
