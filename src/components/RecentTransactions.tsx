import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { ArrowUpRight, ArrowDownRight, List, Layers } from "lucide-react";
import { formatDateBR } from "@/lib/dateUtils";
import { formatCurrency } from "@/lib/formatters";
import { getPaymentMethodLabel } from "@/lib/constants";
import { EmptyState } from "@/components/EmptyState";
import { memo, useMemo, useState } from "react";

interface Transaction {
  id: string;
  type: "income" | "expense";
  amount: number;
  description: string;
  date: string;
  categories: { name: string; color: string } | null;
  installments?: number;
  installment_number?: number;
  payment_method?: string;
  parent_transaction_id?: string | null;
  bank_id?: string | null;
}

const TransactionSkeleton = () => (
  <div className="space-y-2">
    {[...Array(5)].map((_, i) => (
      <div key={i} className="flex items-center justify-between rounded-xl p-3 sm:p-4">
        <div className="flex items-center gap-2 sm:gap-4 flex-1">
          <Skeleton className="h-10 w-10 sm:h-12 sm:w-12 rounded-full" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-4 w-32 sm:w-48" />
            <Skeleton className="h-3 w-20 sm:w-32" />
          </div>
        </div>
        <Skeleton className="h-5 w-20 sm:w-24" />
      </div>
    ))}
  </div>
);

type GroupItem =
  | { kind: "single"; tx: Transaction; sortDate: string }
  | { kind: "group"; key: string; items: Transaction[]; total: number; sortDate: string };

export const RecentTransactions = memo(function RecentTransactions({
  transactions,
  isLoading,
  limit = 10,
}: {
  transactions: Transaction[];
  isLoading?: boolean;
  limit?: number;
}) {
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({});

  const items: GroupItem[] = useMemo(() => {
    const stripSuffix = (s: string) => s.replace(/\s*\(\d+\/\d+\)\s*$/, "").trim();
    const buckets = new Map<string, Transaction[]>();
    const singles: GroupItem[] = [];

    transactions.forEach((t) => {
      if (!t.installments || t.installments <= 1) {
        singles.push({ kind: "single", tx: t, sortDate: t.date });
        return;
      }
      const key = t.parent_transaction_id
        ? `p:${t.parent_transaction_id}`
        : `h:${stripSuffix(t.description)}|${t.installments}|${t.payment_method || ""}|${t.bank_id || ""}|${t.type}`;
      if (!buckets.has(key)) buckets.set(key, []);
      buckets.get(key)!.push(t);
    });

    const groups: GroupItem[] = [];
    buckets.forEach((arr, key) => {
      if (arr.length === 1) {
        singles.push({ kind: "single", tx: arr[0], sortDate: arr[0].date });
        return;
      }
      arr.sort((a, b) => (a.installment_number || 0) - (b.installment_number || 0));
      const total = arr.reduce((s, it) => s + Number(it.amount), 0);
      const sortDate = arr.reduce((m, it) => (it.date > m ? it.date : m), arr[0].date);
      groups.push({ kind: "group", key, items: arr, total, sortDate });
    });

    const all = [...singles, ...groups];
    all.sort((a, b) => b.sortDate.localeCompare(a.sortDate));
    return all.slice(0, limit);
  }, [transactions, limit]);

  const toggle = (key: string) => setOpenGroups((p) => ({ ...p, [key]: !p[key] }));

  return (
    <Card className="border-0 shadow-elegant animate-fade-in-up">
      <CardHeader className="px-4 pt-4 sm:px-6 sm:pt-6">
        <CardTitle className="text-lg sm:text-xl">Transações Recentes</CardTitle>
      </CardHeader>
      <CardContent className="px-3 pb-4 sm:px-6 sm:pb-6">
        {isLoading ? (
          <TransactionSkeleton />
        ) : items.length === 0 ? (
          <EmptyState
            icon={List}
            title="Nenhuma transação"
            description="Comece adicionando sua primeira transação usando o campo acima."
          />
        ) : (
          <div className="space-y-2">
            {items.map((item, index) => {
              if (item.kind === "single") {
                const transaction = item.tx;
                return (
                  <div
                    key={transaction.id}
                    className="flex items-center justify-between rounded-xl p-3 sm:p-4 hover:bg-muted/30 transition-all duration-200 group animate-fade-in"
                    style={{ animationDelay: `${index * 0.05}s` }}
                  >
                    <div className="flex items-center gap-2 sm:gap-4 flex-1 min-w-0">
                      <div
                        className={`flex h-10 w-10 sm:h-12 sm:w-12 items-center justify-center rounded-full transition-transform group-hover:scale-110 flex-shrink-0 ${
                          transaction.type === "income"
                            ? "bg-gradient-to-br from-success/10 to-success/20"
                            : "bg-gradient-to-br from-destructive/10 to-destructive/20"
                        }`}
                      >
                        {transaction.type === "income" ? (
                          <ArrowUpRight className="h-4 w-4 sm:h-5 sm:w-5 text-success" />
                        ) : (
                          <ArrowDownRight className="h-4 w-4 sm:h-5 sm:w-5 text-destructive" />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-sm sm:text-base text-foreground truncate">
                          {transaction.description}
                        </p>
                        <div className="flex items-center gap-1 sm:gap-2 mt-0.5 sm:mt-1 flex-wrap">
                          <p className="text-xs sm:text-sm text-muted-foreground">
                            {formatDateBR(transaction.date)}
                          </p>
                          {transaction.categories && (
                            <Badge
                              variant="secondary"
                              className="text-xs px-1.5 py-0 sm:px-2 sm:py-0.5"
                              style={{
                                backgroundColor: transaction.categories.color + "15",
                                color: transaction.categories.color,
                                borderColor: transaction.categories.color + "30",
                              }}
                            >
                              {transaction.categories.name}
                            </Badge>
                          )}
                          {transaction.payment_method && (
                            <span className="text-[10px] sm:text-xs text-muted-foreground border border-border/60 rounded-full px-2 py-0.5">
                              {getPaymentMethodLabel(transaction.payment_method)}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="text-right flex-shrink-0 ml-2">
                      <p
                        className={`text-sm sm:text-lg font-bold ${
                          transaction.type === "income" ? "text-success" : "text-destructive"
                        }`}
                      >
                        {transaction.type === "income" ? "+" : "-"}R$ {formatCurrency(Number(transaction.amount))}
                      </p>
                    </div>
                  </div>
                );
              }

              // group
              const first = item.items[0];
              const stripSuffix = (s: string) => s.replace(/\s*\(\d+\/\d+\)\s*$/, "").trim();
              const isOpen = !!openGroups[item.key];
              return (
                <div
                  key={item.key}
                  className="rounded-xl border border-border/40 bg-muted/10 animate-fade-in"
                  style={{ animationDelay: `${index * 0.05}s` }}
                >
                  <button
                    type="button"
                    onClick={() => toggle(item.key)}
                    className="w-full flex items-center justify-between p-3 sm:p-4 hover:bg-muted/30 transition-colors rounded-xl text-left"
                  >
                    <div className="flex items-center gap-2 sm:gap-4 flex-1 min-w-0">
                      <div
                        className={`flex h-10 w-10 sm:h-12 sm:w-12 items-center justify-center rounded-full flex-shrink-0 ${
                          first.type === "income"
                            ? "bg-gradient-to-br from-success/10 to-success/20"
                            : "bg-gradient-to-br from-destructive/10 to-destructive/20"
                        }`}
                      >
                        <Layers
                          className={`h-4 w-4 sm:h-5 sm:w-5 ${
                            first.type === "income" ? "text-success" : "text-destructive"
                          }`}
                        />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-sm sm:text-base text-foreground truncate">
                          {stripSuffix(first.description)}
                        </p>
                        <div className="flex items-center gap-1 sm:gap-2 mt-0.5 sm:mt-1 flex-wrap">
                          <Badge variant="secondary" className="text-xs">
                            {first.installments}x parcelas
                          </Badge>
                          {first.categories && (
                            <Badge
                              variant="secondary"
                              className="text-xs px-1.5 py-0 sm:px-2 sm:py-0.5"
                              style={{
                                backgroundColor: first.categories.color + "15",
                                color: first.categories.color,
                                borderColor: first.categories.color + "30",
                              }}
                            >
                              {first.categories.name}
                            </Badge>
                          )}
                          {first.payment_method && (
                            <span className="text-[10px] sm:text-xs text-muted-foreground border border-border/60 rounded-full px-2 py-0.5">
                              {getPaymentMethodLabel(first.payment_method)}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="text-right flex-shrink-0 ml-2">
                      <p
                        className={`text-sm sm:text-lg font-bold ${
                          first.type === "income" ? "text-success" : "text-destructive"
                        }`}
                      >
                        {first.type === "income" ? "+" : "-"}R$ {formatCurrency(item.total)}
                      </p>
                      <p className="text-[10px] sm:text-xs text-muted-foreground">
                        {isOpen ? "ocultar" : "ver parcelas"}
                      </p>
                    </div>
                  </button>
                  {isOpen && (
                    <div className="px-3 pb-3 sm:px-4 sm:pb-4 space-y-1">
                      {item.items.map((tx) => (
                        <div
                          key={tx.id}
                          className="flex items-center justify-between rounded-lg p-2 sm:p-3 bg-background/40"
                        >
                          <div className="flex items-center gap-2 min-w-0">
                            <Badge variant="outline" className="text-[10px] sm:text-xs">
                              {tx.installment_number}/{tx.installments}
                            </Badge>
                            <p className="text-xs sm:text-sm text-muted-foreground">
                              {formatDateBR(tx.date)}
                            </p>
                          </div>
                          <p
                            className={`text-xs sm:text-sm font-semibold ${
                              tx.type === "income" ? "text-success" : "text-destructive"
                            }`}
                          >
                            {tx.type === "income" ? "+" : "-"}R$ {formatCurrency(Number(tx.amount))}
                          </p>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
});
