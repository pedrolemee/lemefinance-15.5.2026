import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Badge } from "@/components/ui/badge";
import { formatCurrency } from "@/lib/formatters";
import { formatDateBR } from "@/lib/dateUtils";
import { Commitment, ForecastMonth } from "@/hooks/useForecast";
import { CreditCard, Repeat, Receipt } from "lucide-react";

export function FutureCommitments({
  months,
  commitments,
}: {
  months: ForecastMonth[];
  commitments: Commitment[];
}) {
  const grouped = months.map((m) => ({
    month: m,
    items: commitments
      .filter((c) => c.monthKey === m.key)
      .sort((a, b) => a.date.localeCompare(b.date)),
  }));

  return (
    <Card className="border-0 shadow-elegant">
      <CardHeader>
        <CardTitle className="text-base sm:text-lg">Compromissos Futuros</CardTitle>
      </CardHeader>
      <CardContent>
        <Accordion type="multiple" className="w-full">
          {grouped.map(({ month, items }) => (
            <AccordionItem key={month.key} value={month.key}>
              <AccordionTrigger className="text-sm">
                <div className="flex items-center justify-between w-full pr-2">
                  <span className="font-medium">{month.label}</span>
                  <span className="text-xs text-muted-foreground">
                    {items.length} {items.length === 1 ? "item" : "itens"} · R$ {formatCurrency(month.committedExpenses)}
                  </span>
                </div>
              </AccordionTrigger>
              <AccordionContent>
                {items.length === 0 ? (
                  <p className="text-xs text-muted-foreground py-2">Sem compromissos registrados.</p>
                ) : (
                  <ul className="space-y-2">
                    {items.map((c) => (
                      <li key={c.id} className="flex items-center justify-between text-xs gap-2 py-1 border-b border-border/30 last:border-0">
                        <div className="flex items-center gap-2 min-w-0 flex-1">
                          {c.source === "installment" ? (
                            <CreditCard className="h-3 w-3 shrink-0 text-primary" />
                          ) : (
                            <Repeat className="h-3 w-3 shrink-0 text-accent-foreground" />
                          )}
                          <span className="truncate">{c.description}</span>
                          {c.installmentInfo && (
                            <Badge variant="outline" className="text-[10px] px-1 py-0">
                              {c.installmentInfo.number}/{c.installmentInfo.total}
                            </Badge>
                          )}
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <span className="text-muted-foreground">{formatDateBR(c.date)}</span>
                          <span className={`font-semibold ${c.type === "income" ? "text-success" : "text-destructive"}`}>
                            R$ {formatCurrency(c.amount)}
                          </span>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      </CardContent>
    </Card>
  );
}
