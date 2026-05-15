import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useMemo } from "react";
import { parseLocalDate, getTodayLocalISO, toLocalISO } from "@/lib/dateUtils";
import { fetchAllUserRows } from "@/lib/supabasePagination";

export interface ForecastMonth {
  key: string;
  label: string;
  monthIndex: number;
  year: number;
  expectedIncome: number;
  committedExpenses: number;
  estimatedVariableExpenses: number;
  totalExpenses: number;
  monthBalance: number;
  cumulativeBalance: number;
  installmentsTotal: number;
  recurringTotal: number;
  creditCardBillTotal: number;
  variableByCategory: Record<string, number>;
}

export interface Commitment {
  id: string;
  monthKey: string;
  description: string;
  amount: number;
  type: "income" | "expense";
  source: "installment" | "recurring" | "credit_card_bill";
  date: string;
  installmentInfo?: { number: number; total: number };
}

export interface ForecastAlert {
  level: "info" | "warning" | "danger" | "success";
  title: string;
  message: string;
}

export interface CategoryAverage {
  categoryId: string;
  name: string;
  color: string;
  type: "income" | "expense";
  avgAmount: number;
}

export interface RecurringInfo {
  id: string;
  description: string;
  amount: number;
  type: "income" | "expense";
  categoryName: string | null;
  categoryColor: string | null;
}

/**
 * Manual adjustments per month.
 * - byCategory[monthKey][categoryId] = override amount
 * - extraIncome/extraExpense[monthKey] = additional amounts
 * - recurringOverrides[recurringId][monthKey] = number (override) | null (skip)
 */
export interface ForecastAdjustments {
  byCategory: Record<string, Record<string, number>>;
  extraIncome: Record<string, number>;
  extraExpense: Record<string, number>;
  recurringOverrides: Record<string, Record<string, number | null>>;
}

export const emptyAdjustments: ForecastAdjustments = {
  byCategory: {},
  extraIncome: {},
  extraExpense: {},
  recurringOverrides: {},
};

const monthNames = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];

const monthKey = (year: number, month: number) =>
  `${year}-${String(month + 1).padStart(2, "0")}`;

const monthLabel = (year: number, month: number) => `${monthNames[month]}/${year}`;

export function useForecast(
  horizonMonths: number = 12,
  adjustments: ForecastAdjustments = emptyAdjustments
) {
  const { user } = useAuth();

  const { data, isLoading } = useQuery({
    queryKey: ["forecast-data", user?.id],
    queryFn: async () => {
      const today = new Date();
      const sixMonthsAgo = new Date(today.getFullYear(), today.getMonth() - 6, 1);
      const startStr = toLocalISO(sixMonthsAgo);

      const todayStrLocal = getTodayLocalISO();

      const [txRes, recRes, catRes, balRows] = await Promise.all([
        supabase
          .from("transactions")
          .select("id, amount, description, type, date, category_id, installments, installment_number")
          .eq("user_id", user!.id)
          .gte("date", startStr)
          .order("date", { ascending: true }),
        supabase
          .from("recurring_transactions")
          .select("*, categories(name, color)")
          .eq("user_id", user!.id)
          .eq("active", true),
        supabase
          .from("categories")
          .select("id, name, color, type")
          .eq("user_id", user!.id),
        // Full-history aggregated balance, paginated to bypass the 1000-row
        // default limit so users with many transactions get the correct saldo.
        fetchAllUserRows<{ amount: number; type: string }>(
          "transactions",
          user!.id,
          "amount, type",
          (q) => q.lte("date", todayStrLocal),
        ),
      ]);

      if (txRes.error) throw txRes.error;
      if (recRes.error) throw recRes.error;
      if (catRes.error) throw catRes.error;

      let fullBalance = 0;
      (balRows || []).forEach((t: any) => {
        const amt = Number(t.amount);
        fullBalance += t.type === "income" ? amt : -amt;
      });

      return {
        transactions: txRes.data || [],
        recurring: recRes.data || [],
        categories: catRes.data || [],
        fullBalance,
      };
    },
    enabled: !!user,
    staleTime: 1000 * 60 * 2,
  });

  const safeAdjustments: ForecastAdjustments = {
    byCategory: adjustments.byCategory || {},
    extraIncome: adjustments.extraIncome || {},
    extraExpense: adjustments.extraExpense || {},
    recurringOverrides: adjustments.recurringOverrides || {},
  };

  const forecast = useMemo(() => {
    if (!data) {
      return {
        months: [] as ForecastMonth[],
        commitments: [] as Commitment[],
        alerts: [] as ForecastAlert[],
        currentBalance: 0,
        categoryAverages: [] as CategoryAverage[],
        recurringList: [] as RecurringInfo[],
      };
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayStr = getTodayLocalISO();

    const { transactions, recurring, categories, fullBalance } = data as any;

    // Use the full-history aggregated balance as the starting point.
    const currentBalance = Number(fullBalance) || 0;

    const futureTx = transactions.filter((t) => t.date > todayStr);

    // Historical: last 3 months window, but divide by actual months covered (min 1)
    const threeMonthsAgo = new Date(today.getFullYear(), today.getMonth() - 3, 1);
    const threeMonthsAgoStr = toLocalISO(threeMonthsAgo);

    const recentTx = transactions.filter(
      (t) => t.date >= threeMonthsAgoStr && t.date <= todayStr
    );

    const monthsCovered = Math.max(1, new Set(recentTx.map((t) => t.date.slice(0, 7))).size);

    // Build a signature set of active recurrences so we can exclude their materialized
    // copies from the historical "variable expenses" averages (avoids double-counting).
    const recurringSignatures = new Set<string>(
      (recurring || []).map((r: any) => {
        const desc = String(r.description || "").trim().toLowerCase();
        const cat = r.category_id || "__nocat__";
        const amt = Number(r.amount).toFixed(2);
        return `${r.type}|${desc}|${cat}|${amt}`;
      })
    );

    const categorySums: Record<string, { expense: number; income: number }> = {};
    recentTx.forEach((t) => {
      if (t.installments && t.installments > 1) return;
      const sig = `${t.type}|${String(t.description || "").trim().toLowerCase()}|${t.category_id || "__nocat__"}|${Number(t.amount).toFixed(2)}`;
      if (recurringSignatures.has(sig)) return; // already counted as a committed recurring expense
      const catId = t.category_id || "__uncategorized__";
      if (!categorySums[catId]) categorySums[catId] = { expense: 0, income: 0 };
      const amt = Number(t.amount);
      if (t.type === "expense") categorySums[catId].expense += amt;
      else categorySums[catId].income += amt;
    });

    const categoryAverages: CategoryAverage[] = [];
    const catMap = new Map<string, any>((categories as any[]).map((c: any) => [c.id, c]));

    Object.entries(categorySums).forEach(([catId, sums]) => {
      const cat = catMap.get(catId);
      const name = cat?.name || (catId === "__uncategorized__" ? "Sem categoria" : "Categoria removida");
      const color = cat?.color || "#94a3b8";
      if (sums.expense > 0) {
        categoryAverages.push({
          categoryId: catId, name, color, type: "expense",
          avgAmount: sums.expense / monthsCovered,
        });
      }
      if (sums.income > 0) {
        categoryAverages.push({
          categoryId: catId, name, color, type: "income",
          avgAmount: sums.income / monthsCovered,
        });
      }
    });
    categoryAverages.sort((a, b) => b.avgAmount - a.avgAmount);

    const recurringList: RecurringInfo[] = recurring.map((r: any) => ({
      id: r.id,
      description: r.description,
      amount: Number(r.amount),
      type: r.type as "income" | "expense",
      categoryName: r.categories?.name || null,
      categoryColor: r.categories?.color || null,
    }));

    const months: ForecastMonth[] = [];
    const commitments: Commitment[] = [];

    for (let i = 1; i <= horizonMonths; i++) {
      const d = new Date(today.getFullYear(), today.getMonth() + i, 1);
      const year = d.getFullYear();
      const month = d.getMonth();
      months.push({
        key: monthKey(year, month),
        label: monthLabel(year, month),
        monthIndex: month, year,
        expectedIncome: 0, committedExpenses: 0,
        estimatedVariableExpenses: 0, totalExpenses: 0,
        monthBalance: 0, cumulativeBalance: 0,
        installmentsTotal: 0, recurringTotal: 0,
        variableByCategory: {},
      });
    }

    const monthMap = new Map(months.map((m) => [m.key, m]));

    futureTx.forEach((t) => {
      const d = parseLocalDate(t.date);
      const key = monthKey(d.getFullYear(), d.getMonth());
      const bucket = monthMap.get(key);
      if (!bucket) return;

      const amt = Number(t.amount);
      const isInstallment = !!(t.installments && t.installments > 1);
      if (t.type === "income") bucket.expectedIncome += amt;
      else {
        bucket.committedExpenses += amt;
        if (isInstallment) bucket.installmentsTotal += amt;
      }

      commitments.push({
        id: t.id, monthKey: key, description: t.description, amount: amt,
        type: t.type as "income" | "expense", source: "installment", date: t.date,
        installmentInfo: t.installments && t.installments > 1
          ? { number: t.installment_number || 1, total: t.installments } : undefined,
      });
    });

    recurring.forEach((r: any) => {
      const startDate = parseLocalDate(r.start_date);
      const endDate = r.end_date ? parseLocalDate(r.end_date) : null;
      const baseAmt = Number(r.amount);

      months.forEach((bucket) => {
        const lastDay = new Date(bucket.year, bucket.monthIndex + 1, 0).getDate();
        const monthStart = new Date(bucket.year, bucket.monthIndex, 1);
        const monthEnd = new Date(bucket.year, bucket.monthIndex, lastDay);

        // If the recurrence hasn't started yet or already ended for this whole month, skip
        if (endDate && endDate < monthStart) return;
        if (startDate > monthEnd) return;

        const override = safeAdjustments.recurringOverrides[r.id]?.[bucket.key];
        if (override === null) return; // skip month
        const amt = (override !== undefined && override !== null) ? override : baseAmt;

        if (r.frequency === "monthly") {
          const day = r.day_of_month || 1;
          const safeDay = Math.min(day, lastDay);
          const occDate = new Date(bucket.year, bucket.monthIndex, safeDay);
          if (occDate < startDate) return;
          if (endDate && occDate > endDate) return;

          if (r.type === "income") bucket.expectedIncome += amt;
          else {
            bucket.committedExpenses += amt;
            bucket.recurringTotal += amt;
          }
          commitments.push({
            id: `${r.id}-${bucket.key}`, monthKey: bucket.key,
            description: r.description, amount: amt,
            type: r.type as "income" | "expense", source: "recurring",
            date: `${bucket.year}-${String(bucket.monthIndex + 1).padStart(2, "0")}-${String(safeDay).padStart(2, "0")}`,
          });
        } else if (r.frequency === "daily") {
          const fromDate = startDate > monthStart ? startDate : monthStart;
          const toDate = endDate && endDate < monthEnd ? endDate : monthEnd;
          const days = Math.max(
            0,
            Math.floor((toDate.getTime() - fromDate.getTime()) / (1000 * 60 * 60 * 24)) + 1
          );
          if (days === 0) return;
          const totalAmt = amt * days;
          if (r.type === "income") bucket.expectedIncome += totalAmt;
          else {
            bucket.committedExpenses += totalAmt;
            bucket.recurringTotal += totalAmt;
          }
          commitments.push({
            id: `${r.id}-${bucket.key}`, monthKey: bucket.key,
            description: `${r.description} (${days}x diário)`, amount: totalAmt,
            type: r.type as "income" | "expense", source: "recurring",
            date: `${bucket.year}-${String(bucket.monthIndex + 1).padStart(2, "0")}-01`,
          });
        }
      });
    });

    let cumulative = currentBalance;
    months.forEach((m) => {
      const monthOverrides = safeAdjustments.byCategory[m.key] || {};
      let variableExpense = 0;
      let variableIncome = 0;

      categoryAverages.forEach((cat) => {
        const overrideKey = `${cat.type}:${cat.categoryId}`;
        const override = monthOverrides[overrideKey];
        const value = override !== undefined ? override : cat.avgAmount;
        m.variableByCategory[overrideKey] = value;
        if (cat.type === "expense") variableExpense += value;
        else variableIncome += value;
      });

      const extraIncome = safeAdjustments.extraIncome[m.key] || 0;
      const extraExpense = safeAdjustments.extraExpense[m.key] || 0;

      m.estimatedVariableExpenses = variableExpense + extraExpense;
      m.expectedIncome += variableIncome + extraIncome;
      m.totalExpenses = m.committedExpenses + m.estimatedVariableExpenses;
      m.monthBalance = m.expectedIncome - m.totalExpenses;
      cumulative += m.monthBalance;
      m.cumulativeBalance = cumulative;
    });

    const alerts: ForecastAlert[] = [];
    const negativeMonth = months.find((m) => m.cumulativeBalance < 0);
    if (negativeMonth) {
      alerts.push({
        level: "danger",
        title: "Saldo previsto fica negativo",
        message: `Em ${negativeMonth.label}, seu saldo acumulado projetado fica abaixo de zero. Considere reduzir despesas variáveis ou rever parcelamentos.`,
      });
    }

    const heaviestMonth = [...months].sort((a, b) => b.installmentsTotal - a.installmentsTotal)[0];
    if (heaviestMonth && heaviestMonth.installmentsTotal > 0) {
      const ratio = heaviestMonth.expectedIncome > 0
        ? (heaviestMonth.installmentsTotal / heaviestMonth.expectedIncome) * 100 : 0;
      if (ratio > 40) {
        alerts.push({
          level: "warning",
          title: `Mês com maior peso de parcelas: ${heaviestMonth.label}`,
          message: `Suas parcelas somam R$ ${heaviestMonth.installmentsTotal.toFixed(2)} (${ratio.toFixed(0)}% da receita prevista).`,
        });
      }
    }

    const lastInstallmentMonth = [...months].reverse().find((m) => m.installmentsTotal > 0);
    if (lastInstallmentMonth) {
      const idx = months.indexOf(lastInstallmentMonth);
      const nextMonth = months[idx + 1];
      if (nextMonth && nextMonth.installmentsTotal === 0) {
        alerts.push({
          level: "success",
          title: "Fim de parcelamentos à vista",
          message: `Suas parcelas atuais terminam em ${lastInstallmentMonth.label}. A partir de ${nextMonth.label} você terá mais folga no orçamento.`,
        });
      }
    }

    if (alerts.length === 0 && months.some((m) => m.monthBalance > 0)) {
      alerts.push({
        level: "info",
        title: "Tudo sob controle",
        message: "Sua projeção está saudável para o horizonte selecionado. Continue acompanhando suas transações.",
      });
    }

    return { months, commitments, alerts, currentBalance, categoryAverages, recurringList };
  }, [data, horizonMonths, adjustments]);

  return { ...forecast, isLoading };
}
