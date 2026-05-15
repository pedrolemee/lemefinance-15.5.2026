import { useEffect, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useForecast, emptyAdjustments, type ForecastAdjustments as ForecastAdjustmentsType } from "@/hooks/useForecast";
import { ForecastSummaryCards } from "@/components/ForecastSummaryCards";
import { ForecastChart } from "@/components/ForecastChart";
import { ForecastAlerts } from "@/components/ForecastAlerts";
import { FutureCommitments } from "@/components/FutureCommitments";
import { ForecastAdjustments } from "@/components/ForecastAdjustments";
import { formatCurrency } from "@/lib/formatters";
import { Sparkles, Wallet } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";

const STORAGE_KEY = "forecast_adjustments_v2";

export default function Forecast() {
  const { user } = useAuth();
  const [horizon, setHorizon] = useState<number>(12);
  const [adjustments, setAdjustments] = useState<ForecastAdjustmentsType>(emptyAdjustments);

  // Load adjustments per user
  useEffect(() => {
    if (!user) return;
    try {
      const raw = localStorage.getItem(`${STORAGE_KEY}_${user.id}`);
      if (raw) setAdjustments(JSON.parse(raw));
    } catch {
      // ignore
    }
  }, [user]);

  // Persist adjustments
  useEffect(() => {
    if (!user) return;
    try {
      localStorage.setItem(`${STORAGE_KEY}_${user.id}`, JSON.stringify(adjustments));
    } catch {
      // ignore
    }
  }, [adjustments, user]);

  const { months, commitments, alerts, currentBalance, categoryAverages, recurringList, isLoading } = useForecast(
    horizon,
    adjustments
  );

  return (
    <div className="container mx-auto px-3 sm:px-4 py-4 sm:py-6 space-y-4 sm:space-y-6 max-w-7xl">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-foreground flex items-center gap-2">
            <Sparkles className="h-6 w-6 text-primary" />
            Previsões Financeiras
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Veja como ficará seu saldo nos próximos meses considerando parcelas, recorrências e seus padrões de gasto.
          </p>
        </div>
        <Tabs value={String(horizon)} onValueChange={(v) => setHorizon(Number(v))}>
          <TabsList>
            <TabsTrigger value="3">3 meses</TabsTrigger>
            <TabsTrigger value="6">6 meses</TabsTrigger>
            <TabsTrigger value="12">12 meses</TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      <Card className="border-0 shadow-elegant bg-gradient-to-br from-primary/5 to-accent/5">
        <CardContent className="py-4 px-4 sm:px-6 flex items-center gap-3">
          <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
            <Wallet className="h-5 w-5 text-primary" />
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Saldo atual (ponto de partida)</p>
            <p className={`text-xl sm:text-2xl font-bold ${currentBalance >= 0 ? "text-success" : "text-destructive"}`}>
              R$ {formatCurrency(currentBalance)}
            </p>
          </div>
        </CardContent>
      </Card>

      {isLoading ? (
        <div className="grid gap-3 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {[...Array(8)].map((_, i) => (
            <Skeleton key={i} className="h-44 rounded-lg" />
          ))}
        </div>
      ) : (
        <>
          <ForecastAlerts alerts={alerts} />
          <ForecastChart months={months} />
          <ForecastSummaryCards months={months} />
          <ForecastAdjustments
            months={months}
            categoryAverages={categoryAverages}
            recurringList={recurringList || []}
            adjustments={adjustments}
            onChange={setAdjustments}
          />
          <FutureCommitments months={months} commitments={commitments} />

          <p className="text-[11px] text-muted-foreground text-center pt-2">
            * As estimativas usam a média dos últimos 3 meses para gastos variáveis. Seus ajustes manuais ficam salvos neste navegador.
          </p>
        </>
      )}
    </div>
  );
}
