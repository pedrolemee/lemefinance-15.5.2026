import { supabase } from "@/integrations/supabase/client";

/**
 * Fetch all rows from a table for the given user, paginating around Supabase's
 * default 1000-row limit. Returns aggregated rows for client-side reduce.
 *
 * Use ONLY for small projections (e.g., select "amount, type, date").
 */
export async function fetchAllUserRows<T = any>(
  table: string,
  userId: string,
  columns: string,
  extra?: (q: any) => any,
): Promise<T[]> {
  const PAGE = 1000;
  const all: T[] = [];
  let from = 0;
  // Hard cap to avoid runaway loops (50k rows is plenty for personal finance).
  for (let i = 0; i < 50; i++) {
    let q: any = (supabase.from(table as any) as any).select(columns).eq("user_id", userId);
    if (extra) q = extra(q);
    q = q.range(from, from + PAGE - 1);
    const { data, error } = await q;
    if (error) throw error;
    const rows = (data || []) as T[];
    all.push(...rows);
    if (rows.length < PAGE) break;
    from += PAGE;
  }
  return all;
}
