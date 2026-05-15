import { memo, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip } from "recharts";
import { Building2 } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

interface Transaction {
  amount: number;
  type: string;
  bank_id?: string | null;
}

interface BankChartProps {
  transactions: Transaction[];
}

const COLORS = ['#14B8A6', '#8B5CF6', '#F59E0B', '#EC4899', '#3B82F6', '#10B981', '#EF4444', '#6366F1'];

function BankChartComponent({ transactions }: BankChartProps) {
  const { data: banks = [] } = useQuery({
    queryKey: ["banks"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("banks")
        .select("*")
        .order("name");
      if (error) throw error;
      return data;
    },
  });

  const chartData = useMemo(() => {
    const expenseTransactions = transactions.filter(t => t.type === 'expense');
    
    const bankTotals: Record<string, number> = {};
    let noBank = 0;

    expenseTransactions.forEach(t => {
      if (t.bank_id) {
        bankTotals[t.bank_id] = (bankTotals[t.bank_id] || 0) + Number(t.amount);
      } else {
        noBank += Number(t.amount);
      }
    });

    const data = banks
      .filter(bank => bank && bank.id && bankTotals[bank.id])
      .map(bank => ({
        name: bank.name,
        value: bankTotals[bank.id],
        color: bank.color,
      }));

    if (noBank > 0) {
      data.push({
        name: 'Não informado',
        value: noBank,
        color: '#9CA3AF',
      });
    }

    return data.sort((a, b) => b.value - a.value);
  }, [transactions, banks]);

  const total = useMemo(() => 
    chartData.reduce((sum, item) => sum + item.value, 0),
    [chartData]
  );

  if (chartData.length === 0) {
    return (
      <Card className="shadow-elegant">
        <CardHeader className="pb-2">
          <CardTitle className="text-base sm:text-lg flex items-center gap-2">
            <Building2 className="h-5 w-5 text-primary" />
            Despesas por Banco
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center h-[200px] text-muted-foreground">
            Nenhuma despesa com banco registrada
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="shadow-elegant">
      <CardHeader className="pb-2">
        <CardTitle className="text-base sm:text-lg flex items-center gap-2">
          <Building2 className="h-5 w-5 text-primary" />
          Despesas por Banco
        </CardTitle>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={250}>
          <PieChart>
            <Pie
              data={chartData}
              cx="50%"
              cy="50%"
              innerRadius={50}
              outerRadius={80}
              paddingAngle={2}
              dataKey="value"
              nameKey="name"
            >
              {chartData.map((entry, index) => (
                <Cell 
                  key={`cell-${index}`} 
                  fill={entry.color || COLORS[index % COLORS.length]} 
                  stroke="transparent"
                />
              ))}
            </Pie>
            <Tooltip 
              formatter={(value: number) => [
                `R$ ${value.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`,
                'Valor'
              ]}
              contentStyle={{
                backgroundColor: 'hsl(var(--popover))',
                borderColor: 'hsl(var(--border))',
                borderRadius: '8px',
                color: 'hsl(var(--foreground))',
              }}
              itemStyle={{ color: 'hsl(var(--foreground))' }}
              labelStyle={{ color: 'hsl(var(--foreground))' }}
            />
            <Legend 
              verticalAlign="bottom"
              formatter={(value, entry: any) => {
                const item = chartData.find(d => d.name === value);
                const percentage = item ? ((item.value / total) * 100).toFixed(0) : 0;
                return <span className="text-xs text-foreground">{value} ({percentage}%)</span>;
              }}
            />
          </PieChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}

export const BankChart = memo(BankChartComponent);
