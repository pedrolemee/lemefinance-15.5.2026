import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { TrendingUp, TrendingDown, Wallet } from "lucide-react";
import { formatCurrency } from "@/lib/formatters";
import { ForecastMonth } from "@/hooks/useForecast";

export function ForecastSummaryCards({ months }: { months: ForecastMonth[] }) {
  return (
    <div className="grid gap-3 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      {months.map((m, i) => {
        const positive = m.monthBalance >= 0;
        const cumulativePositive = m.cumulativeBalance >= 0;
        return (
          <Card
            key={m.key}
            className="border-0 shadow-elegant hover:shadow-elegant-lg transition-all duration-300 animate-fade-in"
            style={{ animationDelay: `${Math.min(i * 0.04, 0.4)}s` }}
          >
            <CardHeader className="pb-2 px-4">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-semibold">{m.label}</CardTitle>
                <Wallet className={`h-4 w-4 ${cumulativePositive ? "text-success" : "text-destructive"}`} />
              </div>
            </CardHeader>
            <CardContent className="px-4 space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground flex items-center gap-1">
                  <TrendingUp className="h-3 w-3 text-success" /> Receita
                </span>
                <span className="font-medium text-success">R$ {formatCurrency(m.expectedIncome)}</span>
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground flex items-center gap-1">
                  <TrendingDown className="h-3 w-3 text-destructive" /> Despesas
                </span>
                <span className="font-medium text-destructive">R$ {formatCurrency(m.totalExpenses)}</span>
              </div>
              {m.installmentsTotal > 0 && (
                <div className="flex items-center justify-between text-[11px] text-muted-foreground pl-4">
                  <span>↳ Parcelas</span>
                  <span>R$ {formatCurrency(m.installmentsTotal)}</span>
                </div>
              )}
              {m.recurringTotal > 0 && (
                <div className="flex items-center justify-between text-[11px] text-muted-foreground pl-4">
                  <span>↳ Recorrentes</span>
                  <span>R$ {formatCurrency(m.recurringTotal)}</span>
                </div>
              )}
              <div className="border-t border-border/50 pt-2 mt-2 space-y-1">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-muted-foreground">Saldo do mês</span>
                  <span className={`font-semibold ${positive ? "text-success" : "text-destructive"}`}>
                    R$ {formatCurrency(m.monthBalance)}
                  </span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="font-medium">Acumulado</span>
                  <span className={`font-bold ${cumulativePositive ? "text-success" : "text-destructive"}`}>
                    R$ {formatCurrency(m.cumulativeBalance)}
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
