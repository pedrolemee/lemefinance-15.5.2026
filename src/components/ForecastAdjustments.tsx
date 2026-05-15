import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import type { CategoryAverage, ForecastAdjustments as ForecastAdjustmentsType, ForecastMonth, RecurringInfo } from "@/hooks/useForecast";
import { formatCurrency } from "@/lib/formatters";
import { RotateCcw, TrendingUp, TrendingDown, Sliders, Plus, Repeat } from "lucide-react";

interface Props {
  months: ForecastMonth[];
  categoryAverages: CategoryAverage[];
  recurringList: RecurringInfo[];
  adjustments: ForecastAdjustmentsType;
  onChange: (next: ForecastAdjustmentsType) => void;
}

export function ForecastAdjustments({ months, categoryAverages, recurringList, adjustments, onChange }: Props) {
  const [activeMonth, setActiveMonth] = useState<string>(months[0]?.key || "");

  if (!months.length) return null;

  const expenseCats = categoryAverages.filter((c) => c.type === "expense");
  const incomeCats = categoryAverages.filter((c) => c.type === "income");

  const setCategoryOverride = (monthKey: string, overrideKey: string, value: string) => {
    const num = value === "" ? undefined : Number(value.replace(",", "."));
    const next: ForecastAdjustmentsType = {
      ...adjustments,
      byCategory: { ...adjustments.byCategory, [monthKey]: { ...(adjustments.byCategory[monthKey] || {}) } },
    };
    if (num === undefined || isNaN(num) || num < 0) delete next.byCategory[monthKey][overrideKey];
    else next.byCategory[monthKey][overrideKey] = num;
    onChange(next);
  };

  const setExtra = (monthKey: string, field: "extraIncome" | "extraExpense", value: string) => {
    const num = value === "" ? 0 : Number(value.replace(",", "."));
    const next: ForecastAdjustmentsType = { ...adjustments, [field]: { ...adjustments[field] } };
    if (!num || isNaN(num) || num < 0) delete next[field][monthKey];
    else next[field][monthKey] = num;
    onChange(next);
  };

  const setRecurringOverride = (recId: string, monthKey: string, value: string) => {
    const num = value === "" ? undefined : Number(value.replace(",", "."));
    const next: ForecastAdjustmentsType = {
      ...adjustments,
      recurringOverrides: {
        ...adjustments.recurringOverrides,
        [recId]: { ...(adjustments.recurringOverrides[recId] || {}) },
      },
    };
    if (num === undefined || isNaN(num) || num < 0) delete next.recurringOverrides[recId][monthKey];
    else next.recurringOverrides[recId][monthKey] = num;
    onChange(next);
  };

  const setRecurringSkip = (recId: string, monthKey: string, skip: boolean) => {
    const next: ForecastAdjustmentsType = {
      ...adjustments,
      recurringOverrides: {
        ...adjustments.recurringOverrides,
        [recId]: { ...(adjustments.recurringOverrides[recId] || {}) },
      },
    };
    if (skip) next.recurringOverrides[recId][monthKey] = null;
    else delete next.recurringOverrides[recId][monthKey];
    onChange(next);
  };

  const applyRecurringToAll = (recId: string, value: number | null | undefined) => {
    const next: ForecastAdjustmentsType = {
      ...adjustments,
      recurringOverrides: { ...adjustments.recurringOverrides, [recId]: {} },
    };
    months.forEach((m) => {
      if (value === undefined) return;
      next.recurringOverrides[recId][m.key] = value;
    });
    onChange(next);
  };

  const resetMonth = (monthKey: string) => {
    const next: ForecastAdjustmentsType = {
      byCategory: { ...adjustments.byCategory },
      extraIncome: { ...adjustments.extraIncome },
      extraExpense: { ...adjustments.extraExpense },
      recurringOverrides: { ...adjustments.recurringOverrides },
    };
    delete next.byCategory[monthKey];
    delete next.extraIncome[monthKey];
    delete next.extraExpense[monthKey];
    Object.keys(next.recurringOverrides).forEach((recId) => {
      const cp = { ...next.recurringOverrides[recId] };
      delete cp[monthKey];
      next.recurringOverrides[recId] = cp;
    });
    onChange(next);
  };

  const resetAll = () => onChange({ byCategory: {}, extraIncome: {}, extraExpense: {}, recurringOverrides: {} });

  const applyToAllMonths = (overrideKey: string, value: number | undefined) => {
    const next: ForecastAdjustmentsType = { ...adjustments, byCategory: { ...adjustments.byCategory } };
    months.forEach((m) => {
      const monthOverrides = { ...(next.byCategory[m.key] || {}) };
      if (value === undefined) delete monthOverrides[overrideKey];
      else monthOverrides[overrideKey] = value;
      next.byCategory[m.key] = monthOverrides;
    });
    onChange(next);
  };

  const monthHasAdjustment = (k: string) =>
    !!(adjustments.byCategory[k] || adjustments.extraIncome[k] || adjustments.extraExpense[k] ||
      Object.values(adjustments.recurringOverrides).some((o) => o && k in o));

  const hasAnyAdjustment =
    Object.keys(adjustments.byCategory).length > 0 ||
    Object.keys(adjustments.extraIncome).length > 0 ||
    Object.keys(adjustments.extraExpense).length > 0 ||
    Object.values(adjustments.recurringOverrides).some((o) => o && Object.keys(o).length > 0);

  return (
    <Card className="border-0 shadow-elegant">
      <CardHeader className="px-3 sm:px-6">
        <div className="flex items-start justify-between gap-2 flex-wrap">
          <div>
            <CardTitle className="text-base sm:text-lg flex items-center gap-2">
              <Sliders className="h-4 w-4 text-primary" />
              Ajustar Projeção Manualmente
            </CardTitle>
            <CardDescription className="text-xs mt-1">
              Edite valores estimados de categorias, recorrentes e extras por mês. A previsão recalcula na hora.
            </CardDescription>
          </div>
          {hasAnyAdjustment && (
            <Button variant="ghost" size="sm" onClick={resetAll} className="text-xs">
              <RotateCcw className="h-3 w-3 mr-1" /> Limpar todos
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent className="px-2 sm:px-6">
        <Tabs value={activeMonth} onValueChange={setActiveMonth}>
          <div className="overflow-x-auto pb-2 -mx-2 px-2">
            <TabsList className="inline-flex w-auto">
              {months.map((m) => (
                <TabsTrigger key={m.key} value={m.key} className="text-xs relative">
                  {m.label}
                  {monthHasAdjustment(m.key) && (
                    <span className="absolute -top-1 -right-1 h-2 w-2 rounded-full bg-primary" />
                  )}
                </TabsTrigger>
              ))}
            </TabsList>
          </div>

          {months.map((m) => (
            <TabsContent key={m.key} value={m.key} className="space-y-4 mt-4">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <div className="text-sm">
                  <span className="font-semibold">{m.label}</span>
                  <span className="text-muted-foreground ml-2">
                    Saldo:{" "}
                    <span className={m.monthBalance >= 0 ? "text-success font-semibold" : "text-destructive font-semibold"}>
                      R$ {formatCurrency(m.monthBalance)}
                    </span>
                  </span>
                </div>
                <Button variant="outline" size="sm" onClick={() => resetMonth(m.key)} className="text-xs h-7">
                  <RotateCcw className="h-3 w-3 mr-1" /> Resetar mês
                </Button>
              </div>

              {recurringList.length > 0 && (
                <div>
                  <div className="flex items-center gap-1 text-xs font-semibold text-muted-foreground mb-2">
                    <Repeat className="h-3.5 w-3.5 text-primary" /> Recorrências
                  </div>
                  <div className="space-y-2">
                    {recurringList.map((r) => {
                      const monthOv = adjustments.recurringOverrides[r.id]?.[m.key];
                      const skipped = monthOv === null;
                      const overridden = typeof monthOv === "number";
                      return (
                        <div key={r.id} className="flex items-center gap-2 p-2 rounded-md bg-muted/30">
                          <div
                            className="h-2 w-2 rounded-full shrink-0"
                            style={{ backgroundColor: r.categoryColor || (r.type === "income" ? "#10b981" : "#ef4444") }}
                          />
                          <div className="flex-1 min-w-0">
                            <div className="text-xs font-medium truncate">{r.description}</div>
                            <div className="text-[10px] text-muted-foreground">
                              {r.type === "income" ? "Receita" : "Despesa"} • Base: R$ {formatCurrency(r.amount)}
                            </div>
                          </div>
                          <div className="flex items-center gap-1">
                            <span className="text-[10px] text-muted-foreground hidden sm:inline">Pular</span>
                            <Switch
                              checked={skipped}
                              onCheckedChange={(c) => setRecurringSkip(r.id, m.key, c)}
                            />
                          </div>
                          <Input
                            type="number"
                            inputMode="decimal"
                            min="0"
                            step="0.01"
                            placeholder={r.amount.toFixed(2)}
                            value={overridden ? String(monthOv) : ""}
                            onChange={(e) => setRecurringOverride(r.id, m.key, e.target.value)}
                            disabled={skipped}
                            className={`h-7 w-20 text-xs ${overridden ? "border-primary" : ""}`}
                          />
                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button
                                  variant="ghost" size="sm" className="h-7 w-7 p-0"
                                  onClick={() => applyRecurringToAll(r.id, overridden ? (monthOv as number) : skipped ? null : undefined)}
                                  disabled={!overridden && !skipped}
                                >
                                  <Badge variant="outline" className="text-[9px] px-1 h-4">∀</Badge>
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent side="left" className="text-xs">Aplicar a todos os meses</TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {expenseCats.length > 0 && (
                <CategoryGroup
                  title="Despesas variáveis por categoria"
                  icon={<TrendingDown className="h-3.5 w-3.5 text-destructive" />}
                  categories={expenseCats} monthKey={m.key}
                  adjustments={adjustments}
                  setCategoryOverride={setCategoryOverride}
                  applyToAllMonths={applyToAllMonths}
                />
              )}

              {incomeCats.length > 0 && (
                <CategoryGroup
                  title="Receitas variáveis por categoria"
                  icon={<TrendingUp className="h-3.5 w-3.5 text-success" />}
                  categories={incomeCats} monthKey={m.key}
                  adjustments={adjustments}
                  setCategoryOverride={setCategoryOverride}
                  applyToAllMonths={applyToAllMonths}
                />
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 border-t border-border/50">
                <div>
                  <label className="text-xs font-medium flex items-center gap-1 mb-1">
                    <Plus className="h-3 w-3 text-success" /> Receita extra única
                  </label>
                  <Input type="number" inputMode="decimal" min="0" step="0.01" placeholder="0,00"
                    value={adjustments.extraIncome[m.key] ?? ""}
                    onChange={(e) => setExtra(m.key, "extraIncome", e.target.value)}
                    className="h-8 text-sm" />
                </div>
                <div>
                  <label className="text-xs font-medium flex items-center gap-1 mb-1">
                    <Plus className="h-3 w-3 text-destructive" /> Despesa extra única
                  </label>
                  <Input type="number" inputMode="decimal" min="0" step="0.01" placeholder="0,00"
                    value={adjustments.extraExpense[m.key] ?? ""}
                    onChange={(e) => setExtra(m.key, "extraExpense", e.target.value)}
                    className="h-8 text-sm" />
                </div>
              </div>
            </TabsContent>
          ))}
        </Tabs>

        {categoryAverages.length === 0 && recurringList.length === 0 && (
          <p className="text-xs text-muted-foreground text-center py-6">
            Sem histórico ou recorrências para ajustar. Adicione transações nos últimos meses ou cadastre recorrentes.
          </p>
        )}
      </CardContent>
    </Card>
  );
}

function CategoryGroup({
  title, icon, categories, monthKey, adjustments, setCategoryOverride, applyToAllMonths,
}: {
  title: string; icon: React.ReactNode; categories: CategoryAverage[]; monthKey: string;
  adjustments: ForecastAdjustmentsType;
  setCategoryOverride: (mk: string, ok: string, v: string) => void;
  applyToAllMonths: (ok: string, v: number | undefined) => void;
}) {
  return (
    <div>
      <div className="flex items-center gap-1 text-xs font-semibold text-muted-foreground mb-2">{icon} {title}</div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        {categories.map((cat) => {
          const overrideKey = `${cat.type}:${cat.categoryId}`;
          const override = adjustments.byCategory[monthKey]?.[overrideKey];
          const isOverridden = override !== undefined;
          return (
            <div key={overrideKey} className="flex items-center gap-2 p-2 rounded-md bg-muted/30">
              <div className="h-2 w-2 rounded-full shrink-0" style={{ backgroundColor: cat.color }} />
              <div className="flex-1 min-w-0">
                <div className="text-xs font-medium truncate">{cat.name}</div>
                <div className="text-[10px] text-muted-foreground">Média: R$ {formatCurrency(cat.avgAmount)}</div>
              </div>
              <Input type="number" inputMode="decimal" min="0" step="0.01"
                placeholder={cat.avgAmount.toFixed(2)} value={override ?? ""}
                onChange={(e) => setCategoryOverride(monthKey, overrideKey, e.target.value)}
                className={`h-7 w-20 text-xs ${isOverridden ? "border-primary" : ""}`} />
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button variant="ghost" size="sm" className="h-7 w-7 p-0"
                      onClick={() => applyToAllMonths(overrideKey, isOverridden ? override : undefined)}
                      disabled={!isOverridden}>
                      <Badge variant="outline" className="text-[9px] px-1 h-4">∀</Badge>
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent side="left" className="text-xs">Aplicar a todos os meses</TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>
          );
        })}
      </div>
    </div>
  );
}
