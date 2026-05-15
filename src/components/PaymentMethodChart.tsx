import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PieChart, Pie, Cell, Legend, Tooltip, ResponsiveContainer } from "recharts";
import { memo, useMemo } from "react";

interface Transaction {
  type: "income" | "expense";
  amount: number;
  payment_method?: string | null;
}

const METHOD_CONFIG: Record<string, { label: string; color: string }> = {
  credit_card: { label: "Cartão de Crédito", color: "hsl(var(--primary))" },
  debit_card: { label: "Cartão de Débito", color: "hsl(var(--accent))" },
  pix: { label: "PIX", color: "hsl(var(--success))" },
  cash: { label: "Dinheiro", color: "hsl(var(--secondary))" },
  other: { label: "Outro", color: "hsl(var(--muted-foreground))" },
  unknown: { label: "Não informado", color: "hsl(var(--muted-foreground))" },
};

export const PaymentMethodChart = memo(function PaymentMethodChart({
  transactions,
}: {
  transactions: Transaction[];
}) {
  const chartData = useMemo(() => {
    const expenses = transactions.filter((t) => t.type === "expense");

    const aggregated = expenses.reduce((acc, t) => {
      const key = (t.payment_method as string) || "unknown";
      const config = METHOD_CONFIG[key] ?? METHOD_CONFIG.unknown;

      if (!acc[key]) {
        acc[key] = { name: config.label, value: 0, color: config.color };
      }

      acc[key].value += Number(t.amount);
      return acc;
    }, {} as Record<string, { name: string; value: number; color: string }>);

    return Object.values(aggregated).filter((item) => item.value > 0);
  }, [transactions]);

  if (chartData.length === 0) {
    return (
      <Card className="border-0 shadow-elegant">
        <CardHeader>
          <CardTitle className="text-xl">Despesas por Método de Pagamento</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-12">
            <p className="text-muted-foreground">Nenhuma despesa registrada com método definido este mês</p>
            <p className="text-sm text-muted-foreground mt-1">Adicione transações para visualizar o gráfico</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-0 shadow-elegant">
      <CardHeader className="px-4 sm:px-6">
        <CardTitle className="text-base sm:text-lg md:text-xl">Despesas por Método de Pagamento</CardTitle>
      </CardHeader>
      <CardContent className="px-2 sm:px-6">
        <div className="h-[280px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={chartData}
                cx="50%"
                cy="50%"
                labelLine={false}
                label={({ name, percent, x, y, textAnchor }) => (
                  <text x={x} y={y} textAnchor={textAnchor} fill="hsl(var(--foreground))" fontSize={12}>
                    {`${name} ${(percent * 100).toFixed(0)}%`}
                  </text>
                )}
                outerRadius={90}
                dataKey="value"
              >
                {chartData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color} />
                ))}
              </Pie>
              <Legend
                wrapperStyle={{
                  fontSize: "0.75rem",
                  paddingTop: "0.5rem",
                }}
              />
              <Tooltip
                formatter={(value) =>
                  `R$ ${Number(value).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`
                }
                contentStyle={{
                  fontSize: "0.75rem",
                  backgroundColor: "hsl(var(--card))",
                  border: "1px solid hsl(var(--border))",
                  borderRadius: "0.5rem",
                  color: "hsl(var(--foreground))",
                }}
                itemStyle={{ color: "hsl(var(--foreground))" }}
                labelStyle={{ color: "hsl(var(--foreground))" }}
              />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
});
