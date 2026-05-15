import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip } from "recharts";
import { memo, useMemo } from "react";

interface Transaction {
  type: "income" | "expense";
  amount: number;
  categories: { name: string; color: string } | null;
}

export const CategoryChart = memo(function CategoryChart({ transactions }: { transactions: Transaction[] }) {
  const chartData = useMemo(() => {
    const expensesByCategory = transactions
      .filter((t) => t.type === "expense")
      .reduce((acc, t) => {
        const categoryName = t.categories?.name || "Sem categoria";
        const color = t.categories?.color || "#94a3b8";
        if (!acc[categoryName]) {
          acc[categoryName] = { name: categoryName, value: 0, color };
        }
        acc[categoryName].value += Number(t.amount);
        return acc;
      }, {} as Record<string, { name: string; value: number; color: string }>);

    return Object.values(expensesByCategory);
  }, [transactions]);

  if (chartData.length === 0) {
    return (
      <Card className="border-0 shadow-elegant">
        <CardHeader>
          <CardTitle className="text-xl">Despesas por Categoria</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-12">
            <p className="text-muted-foreground">Nenhuma despesa registrada este mês</p>
            <p className="text-sm text-muted-foreground mt-1">Adicione transações para visualizar o gráfico</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-0 shadow-elegant">
      <CardHeader className="px-4 sm:px-6">
        <CardTitle className="text-base sm:text-lg md:text-xl">Despesas por Categoria</CardTitle>
      </CardHeader>
      <CardContent className="px-2 sm:px-6">
        <ResponsiveContainer width="100%" height={280}>
          <PieChart>
            <Pie
              data={chartData}
              cx="50%"
              cy="50%"
              labelLine={false}
              label={({ name, percent, x, y, textAnchor }) => (
                <text x={x} y={y} textAnchor={textAnchor} fill="hsl(var(--foreground))" fontSize={window.innerWidth < 640 ? 10 : 12}>
                  {window.innerWidth < 640 ? `${(percent * 100).toFixed(0)}%` : `${name} ${(percent * 100).toFixed(0)}%`}
                </text>
              )}
              outerRadius={window.innerWidth < 640 ? 70 : 90}
              fill="#8884d8"
              dataKey="value"
            >
              {chartData.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={entry.color} />
              ))}
            </Pie>
            <Legend 
              wrapperStyle={{
                fontSize: window.innerWidth < 640 ? '0.625rem' : '0.75rem',
                paddingTop: '0.5rem'
              }}
              iconSize={window.innerWidth < 640 ? 8 : 10}
            />
            <Tooltip 
              formatter={(value) => `R$ ${Number(value).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`}
              contentStyle={{ 
                fontSize: window.innerWidth < 640 ? '0.625rem' : '0.75rem',
                backgroundColor: 'hsl(var(--card))',
                border: '1px solid hsl(var(--border))',
                borderRadius: '0.5rem',
                color: 'hsl(var(--foreground))',
              }}
              itemStyle={{ color: 'hsl(var(--foreground))' }}
              labelStyle={{ color: 'hsl(var(--foreground))' }}
            />
          </PieChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
});
