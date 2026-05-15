import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { CategoryChart } from "@/components/CategoryChart";
import { CashFlowChart } from "@/components/CashFlowChart";
import { RecentTransactions } from "@/components/RecentTransactions";
import { WhatsAppInput } from "@/components/WhatsAppInput";
import PaymentMethodDialog from "@/components/PaymentMethodDialog";
import BankSelectionDialog from "@/components/BankSelectionDialog";
import InstallmentDialog from "@/components/InstallmentDialog";
import { Wallet, TrendingUp, TrendingDown } from "lucide-react";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { getMonthYear, getTodayLocalISO } from "@/lib/dateUtils";
import { fetchAllUserRows } from "@/lib/supabasePagination";
import { formatCurrency } from "@/lib/formatters";
import { useEffect, useMemo } from "react";
import { useDashboardTransactions } from "@/hooks/useDashboardTransactions";

export default function Dashboard() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  // Auto-generate due recurring transactions on mount (idempotent)
  useEffect(() => {
    if (!user) return;
    (async () => {
      try {
        const { error } = await supabase.rpc('run_user_recurring', { _user_id: user.id });
        if (!error) {
          queryClient.invalidateQueries({ queryKey: ['transactions'] });
          queryClient.invalidateQueries({ queryKey: ['transactions-balance'] });
          queryClient.invalidateQueries({ queryKey: ['forecast-data'] });
        }
      } catch { /* silent */ }
    })();
  }, [user, queryClient]);

  const { data: transactions = [], isLoading } = useQuery({
    queryKey: ["transactions", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("transactions")
        .select("id, amount, description, type, date, category_id, installments, installment_number, payment_method, parent_transaction_id, bank_id, categories(name, color)")
        .eq("user_id", user!.id)
        .order("date", { ascending: false });
      if (error) throw error;
      return data as any[];
    },
    enabled: !!user,
  });

  const refetchAll = () => {
    queryClient.invalidateQueries({ queryKey: ["transactions"] });
    queryClient.invalidateQueries({ queryKey: ["transactions-balance"] });
    queryClient.invalidateQueries({ queryKey: ["forecast-data"] });
  };

  // Aggregated balance + month totals: independent of the 500-row list above.
  const { data: aggregates } = useQuery({
    queryKey: ["transactions-balance", user?.id],
    queryFn: async () => {
      const todayStr = getTodayLocalISO();
      const now = new Date();
      const monthStart = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`;
      const nextMonthDate = new Date(now.getFullYear(), now.getMonth() + 1, 1);
      const monthEndExclusive = `${nextMonthDate.getFullYear()}-${String(nextMonthDate.getMonth() + 1).padStart(2, "0")}-01`;

      const data = await fetchAllUserRows<{ amount: number; type: string; date: string }>(
        "transactions",
        user!.id,
        "amount, type, date",
      );

      let bal = 0;
      let mIncome = 0;
      let mExpense = 0;
      (data || []).forEach((t: any) => {
        const amt = Number(t.amount);
        // Saldo atual = só o que já aconteceu (até hoje)
        if (t.date <= todayStr) {
          bal += t.type === "income" ? amt : -amt;
        }
        // Mês = todas as transações do mês corrente (inclui futuras já lançadas)
        if (t.date >= monthStart && t.date < monthEndExclusive) {
          if (t.type === "income") mIncome += amt;
          else mExpense += amt;
        }
      });
      return { balance: bal, monthIncome: mIncome, monthExpense: mExpense };
    },
    enabled: !!user,
  });

  const { monthTransactions, totalIncome, totalExpense, monthBalance, currentBalance } = useMemo(() => {
    const now = new Date();
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();

    const filtered = transactions.filter((t) => {
      const { month, year } = getMonthYear(t.date);
      return month === currentMonth && year === currentYear;
    });

    return {
      monthTransactions: filtered,
      totalIncome: aggregates?.monthIncome ?? 0,
      totalExpense: aggregates?.monthExpense ?? 0,
      monthBalance: (aggregates?.monthIncome ?? 0) - (aggregates?.monthExpense ?? 0),
      currentBalance: aggregates?.balance ?? 0,
    };
  }, [transactions, aggregates]);

  const {
    pendingTransaction,
    showPaymentDialog,
    showInstallmentDialog,
    showBankDialog,
    handleTransactionExtracted,
    handlePaymentMethodSelect,
    handleInstallmentSelect,
    handleInstallmentCancel,
    handleBankSelect,
    handlePaymentDialogCancel,
    handleBankDialogCancel,
  } = useDashboardTransactions(refetchAll);

  return (
    <div className="container mx-auto px-3 sm:px-4 py-4 sm:py-6 space-y-4 sm:space-y-6 max-w-7xl">
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold text-foreground">
          Olá, {user?.user_metadata?.full_name || 'Usuário'}!
        </h1>
      </div>

      <WhatsAppInput onTransactionExtracted={handleTransactionExtracted} />

      <div className="grid gap-3 sm:gap-4 grid-cols-1 sm:grid-cols-3">
        {isLoading ? (
          [...Array(3)].map((_, i) => (
            <Card key={i} className="border-0 shadow-elegant">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 px-4 sm:px-6">
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-10 w-10 rounded-full" />
              </CardHeader>
              <CardContent className="px-4 sm:px-6">
                <Skeleton className="h-8 w-32 mb-2" />
                <Skeleton className="h-3 w-20" />
              </CardContent>
            </Card>
          ))
        ) : (
          <>
            <Card className="relative overflow-hidden border-0 shadow-elegant hover:shadow-elegant-lg transition-all duration-300 animate-fade-in">
              <div className="absolute inset-0 bg-gradient-to-br from-primary/5 to-accent/5" />
              <CardHeader className="relative flex flex-row items-center justify-between space-y-0 pb-2 px-4 sm:px-6">
                <CardTitle className="text-xs sm:text-sm font-medium text-muted-foreground">Saldo Atual</CardTitle>
                <div className="h-8 w-8 sm:h-10 sm:w-10 rounded-full bg-primary/10 flex items-center justify-center">
                  <Wallet className="h-4 w-4 sm:h-5 sm:w-5 text-primary" />
                </div>
              </CardHeader>
              <CardContent className="relative px-4 sm:px-6">
                <div className={`text-xl sm:text-2xl md:text-3xl font-bold ${currentBalance >= 0 ? 'text-success' : 'text-destructive'}`}>
                  R$ {formatCurrency(currentBalance)}
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  Mês: <span className={monthBalance >= 0 ? 'text-success' : 'text-destructive'}>R$ {formatCurrency(monthBalance)}</span>
                </p>
              </CardContent>
            </Card>

            <Card className="relative overflow-hidden border-0 shadow-elegant hover:shadow-elegant-lg transition-all duration-300 animate-fade-in" style={{ animationDelay: '0.1s' }}>
              <div className="absolute inset-0 bg-gradient-to-br from-success/5 to-success/10" />
              <CardHeader className="relative flex flex-row items-center justify-between space-y-0 pb-2 px-4 sm:px-6">
                <CardTitle className="text-xs sm:text-sm font-medium text-muted-foreground">Receitas</CardTitle>
                <div className="h-8 w-8 sm:h-10 sm:w-10 rounded-full bg-success/10 flex items-center justify-center">
                  <TrendingUp className="h-4 w-4 sm:h-5 sm:w-5 text-success" />
                </div>
              </CardHeader>
              <CardContent className="relative px-4 sm:px-6">
                <div className="text-xl sm:text-2xl md:text-3xl font-bold text-success">R$ {formatCurrency(totalIncome)}</div>
                <p className="text-xs text-muted-foreground mt-1">Este mês</p>
              </CardContent>
            </Card>

            <Card className="relative overflow-hidden border-0 shadow-elegant hover:shadow-elegant-lg transition-all duration-300 animate-fade-in" style={{ animationDelay: '0.2s' }}>
              <div className="absolute inset-0 bg-gradient-to-br from-destructive/5 to-destructive/10" />
              <CardHeader className="relative flex flex-row items-center justify-between space-y-0 pb-2 px-4 sm:px-6">
                <CardTitle className="text-xs sm:text-sm font-medium text-muted-foreground">Despesas</CardTitle>
                <div className="h-8 w-8 sm:h-10 sm:w-10 rounded-full bg-destructive/10 flex items-center justify-center">
                  <TrendingDown className="h-4 w-4 sm:h-5 sm:w-5 text-destructive" />
                </div>
              </CardHeader>
              <CardContent className="relative px-4 sm:px-6">
                <div className="text-xl sm:text-2xl md:text-3xl font-bold text-destructive">R$ {formatCurrency(totalExpense)}</div>
                <p className="text-xs text-muted-foreground mt-1">Este mês</p>
              </CardContent>
            </Card>
          </>
        )}
      </div>

      <div className="grid gap-3 sm:gap-4 grid-cols-1 lg:grid-cols-2">
        <CategoryChart transactions={monthTransactions} />
        <CashFlowChart transactions={transactions} />
      </div>

      <RecentTransactions transactions={transactions} isLoading={isLoading} limit={10} />

      <PaymentMethodDialog open={showPaymentDialog} onSelect={handlePaymentMethodSelect} onCancel={handlePaymentDialogCancel} />
      <InstallmentDialog open={showInstallmentDialog} onSelect={handleInstallmentSelect} onCancel={handleInstallmentCancel} amount={pendingTransaction?.amount || 0} />
      <BankSelectionDialog open={showBankDialog} onSelect={handleBankSelect} onCancel={handleBankDialogCancel} />
    </div>
  );
}
