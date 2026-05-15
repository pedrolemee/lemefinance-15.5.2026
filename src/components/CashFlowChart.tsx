import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from "recharts";
import { format, subDays } from "date-fns";
import { ptBR } from "date-fns/locale";
import { isSameDay } from "@/lib/dateUtils";
import { memo, useMemo } from "react";

interface Transaction {
  type: "income" | "expense";
  amount: number;
  date: string;
}

const tooltipStyle = {
  backgroundColor: 'hsl(var(--card))',
  border: '1px solid hsl(var(--border))',
  borderRadius: '0.5rem',
  boxShadow: 'var(--shadow-md)',
  fontSize: '0.75rem',
  color: 'hsl(var(--foreground))',
};

export const CashFlowChart = memo(function CashFlowChart({ transactions }: { transactions: Transaction[] }) {
  const dataWithBalance = useMemo(() => {
    const last30Days = Array.from({ length: 30 }, (_, i) => subDays(new Date(), 29 - i));

    const chartData = last30Days.map((day) => {
      const dayTransactions = transactions.filter((t) => isSameDay(t.date, day));
      const income = dayTransactions.filter((t) => t.type === "income").reduce((sum, t) => sum + Number(t.amount), 0);
      const expense = dayTransactions.filter((t) => t.type === "expense").reduce((sum, t) => sum + Number(t.amount), 0);
      return { date: format(day, "dd/MM", { locale: ptBR }), receitas: income, despesas: expense, saldo: income - expense };
    });

    let cumulativeBalance = 0;
    return chartData.map((item) => {
      cumulativeBalance += item.saldo;
      return { ...item, saldoAcumulado: cumulativeBalance };
    });
  }, [transactions]);

  return (
    <Card className="border-0 shadow-elegant">
      <CardHeader className="px-4 sm:px-6">
        <CardTitle className="text-base sm:text-lg md:text-xl">Fluxo de Caixa (30 dias)</CardTitle>
      </CardHeader>
      <CardContent className="px-1 sm:px-6">
        <ResponsiveContainer width="100%" height={280}>
          <LineChart data={dataWithBalance}>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.3} />
            <XAxis dataKey="date" stroke="hsl(var(--muted-foreground))" fontSize={10} angle={-45} textAnchor="end" height={60} />
            <YAxis stroke="hsl(var(--muted-foreground))" fontSize={10} width={45} />
            <Tooltip
              formatter={(value) => `R$ ${Number(value).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`}
              contentStyle={tooltipStyle}
              itemStyle={{ color: 'hsl(var(--foreground))' }}
              labelStyle={{ color: 'hsl(var(--foreground))' }}
            />
            <Legend wrapperStyle={{ paddingTop: '0.5rem', fontSize: '0.75rem' }} />
            <Line type="monotone" dataKey="receitas" stroke="hsl(var(--success))" name="Receitas" strokeWidth={2} dot={{ r: 2 }} activeDot={{ r: 4 }} />
            <Line type="monotone" dataKey="despesas" stroke="hsl(var(--destructive))" name="Despesas" strokeWidth={2} dot={{ r: 2 }} activeDot={{ r: 4 }} />
            <Line type="monotone" dataKey="saldoAcumulado" stroke="hsl(var(--primary))" name="Saldo" strokeWidth={2} dot={{ r: 2 }} activeDot={{ r: 4 }} />
          </LineChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
});
