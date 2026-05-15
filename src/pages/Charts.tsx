import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useState, useMemo } from "react";
import { 
  PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip,
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
  LineChart, Line, AreaChart, Area
} from "recharts";
import { format, subMonths, startOfMonth, endOfMonth } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Skeleton } from "@/components/ui/skeleton";
import { parseLocalDate } from "@/lib/dateUtils";
import { PaymentMethodChart } from "@/components/PaymentMethodChart";
import { BankChart } from "@/components/BankChart";
import { getMonthYear } from "@/lib/dateUtils";

export default function Charts() {
  const { user } = useAuth();
  const [selectedMonth, setSelectedMonth] = useState<number>(0);
  const [selectedPeriod, setSelectedPeriod] = useState<"6" | "12">("6");

  const { data: transactions = [], isLoading } = useQuery({
    queryKey: ["transactions", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("transactions")
        .select("id, amount, description, type, date, payment_method, categories(name, color), banks(name, color)")
        .eq("user_id", user!.id)
        .order("date", { ascending: false });
      if (error) throw error;
      return data as any[];
    },
    enabled: !!user,
  });

  const { data: goals = [] } = useQuery({
    queryKey: ["goals", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase.from("financial_goals").select("*").eq("user_id", user!.id);
      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });

  const filteredTransactions = useMemo(() => {
    const targetDate = subMonths(new Date(), selectedMonth);
    const start = startOfMonth(targetDate);
    const end = endOfMonth(targetDate);
    return transactions.filter(t => { const d = parseLocalDate(t.date); return d >= start && d <= end; });
  }, [transactions, selectedMonth]);

  const categoryData = useMemo(() => {
    const map: Record<string, { name: string; value: number; color: string }> = {};
    filteredTransactions.filter(t => t.type === "expense").forEach(t => {
      const name = t.categories?.name || "Sem categoria";
      const color = t.categories?.color || "#94a3b8";
      if (!map[name]) map[name] = { name, value: 0, color };
      map[name].value += Number(t.amount);
    });
    return Object.values(map);
  }, [filteredTransactions]);

  const categoryIncomeData = useMemo(() => {
    const map: Record<string, { name: string; value: number; color: string }> = {};
    filteredTransactions.filter(t => t.type === "income").forEach(t => {
      const name = t.categories?.name || "Sem categoria";
      const color = t.categories?.color || "#94a3b8";
      if (!map[name]) map[name] = { name, value: 0, color };
      map[name].value += Number(t.amount);
    });
    return Object.values(map);
  }, [filteredTransactions]);

  const monthlyData = useMemo(() => {
    const months = parseInt(selectedPeriod);
    return Array.from({ length: months }, (_, i) => {
      const date = subMonths(new Date(), months - 1 - i);
      const start = startOfMonth(date);
      const end = endOfMonth(date);
      const mt = transactions.filter(t => { const d = parseLocalDate(t.date); return d >= start && d <= end; });
      const income = mt.filter(t => t.type === "income").reduce((s, t) => s + Number(t.amount), 0);
      const expense = mt.filter(t => t.type === "expense").reduce((s, t) => s + Number(t.amount), 0);
      return { month: format(date, "MMM/yy", { locale: ptBR }), receitas: income, despesas: expense, saldo: income - expense };
    });
  }, [transactions, selectedPeriod]);

  const goalsData = useMemo(() => {
    return goals.map(g => ({ name: g.title, atual: Number(g.current_amount), meta: Number(g.target_amount), progresso: (Number(g.current_amount) / Number(g.target_amount)) * 100 }));
  }, [goals]);


  const fmt = (value: any) => `R$ ${Number(value).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`;
  const ttStyle = { backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: '0.5rem', color: 'hsl(var(--foreground))' };
  const ttItemStyle = { color: 'hsl(var(--foreground))' };

  if (isLoading) {
    return (
      <div className="container mx-auto px-4 py-6">
        <div className="space-y-6">
          <Skeleton className="h-12 w-64" />
          <div className="grid gap-4 md:grid-cols-2">{[...Array(4)].map((_, i) => <Skeleton key={i} className="h-96" />)}</div>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-3 sm:px-4 py-4 sm:py-6 space-y-4 sm:space-y-6 max-w-7xl">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <h1 className="text-2xl sm:text-3xl font-bold">Gráficos e Análises</h1>
        <Select value={selectedMonth.toString()} onValueChange={(v) => setSelectedMonth(parseInt(v))}>
          <SelectTrigger className="w-full sm:w-auto sm:min-w-[180px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="0">Mês atual</SelectItem>
            <SelectItem value="1">Mês passado</SelectItem>
            <SelectItem value="2">2 meses atrás</SelectItem>
            <SelectItem value="3">3 meses atrás</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <Tabs defaultValue="categories" className="space-y-4">
        <div className="overflow-x-auto -mx-4 px-4 sm:mx-0 sm:px-0">
          <TabsList className="inline-flex w-full sm:grid sm:grid-cols-3 lg:grid-cols-6 gap-1 min-w-max sm:min-w-full">
            <TabsTrigger value="categories" className="text-xs sm:text-sm">Categorias</TabsTrigger>
            <TabsTrigger value="payments" className="text-xs sm:text-sm">Pagamentos</TabsTrigger>
            <TabsTrigger value="banks" className="text-xs sm:text-sm">Bancos</TabsTrigger>
            <TabsTrigger value="monthly" className="text-xs sm:text-sm">Mensal</TabsTrigger>
            <TabsTrigger value="goals" className="text-xs sm:text-sm">Metas</TabsTrigger>
            <TabsTrigger value="trends" className="text-xs sm:text-sm">Tendências</TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="categories" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <Card className="border-0 shadow-elegant">
              <CardHeader><CardTitle>Despesas por Categoria</CardTitle></CardHeader>
              <CardContent>
                {categoryData.length === 0 ? <div className="text-center py-12 text-muted-foreground">Nenhuma despesa neste período</div> : (
                  <ResponsiveContainer width="100%" height={350}>
                    <PieChart><Pie data={categoryData} cx="50%" cy="50%" labelLine={false} label={({ name, percent, x, y, textAnchor }) => <text x={x} y={y} textAnchor={textAnchor} fill="hsl(var(--foreground))" fontSize={12}>{`${name} ${(percent * 100).toFixed(0)}%`}</text>} outerRadius={100} dataKey="value">
                      {categoryData.map((e, i) => <Cell key={i} fill={e.color} />)}
                    </Pie><Tooltip formatter={fmt} contentStyle={ttStyle} itemStyle={ttItemStyle} labelStyle={ttItemStyle} /><Legend /></PieChart>
                  </ResponsiveContainer>
                )}
              </CardContent>
            </Card>
            <Card className="border-0 shadow-elegant">
              <CardHeader><CardTitle>Receitas por Categoria</CardTitle></CardHeader>
              <CardContent>
                {categoryIncomeData.length === 0 ? <div className="text-center py-12 text-muted-foreground">Nenhuma receita neste período</div> : (
                  <ResponsiveContainer width="100%" height={350}>
                    <PieChart><Pie data={categoryIncomeData} cx="50%" cy="50%" labelLine={false} label={({ name, percent, x, y, textAnchor }) => <text x={x} y={y} textAnchor={textAnchor} fill="hsl(var(--foreground))" fontSize={12}>{`${name} ${(percent * 100).toFixed(0)}%`}</text>} outerRadius={100} dataKey="value">
                      {categoryIncomeData.map((e, i) => <Cell key={i} fill={e.color} />)}
                    </Pie><Tooltip formatter={fmt} contentStyle={ttStyle} itemStyle={ttItemStyle} labelStyle={ttItemStyle} /><Legend /></PieChart>
                  </ResponsiveContainer>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="payments">
          <PaymentMethodChart transactions={filteredTransactions} />
        </TabsContent>

        <TabsContent value="banks">
          <BankChart transactions={filteredTransactions} />
        </TabsContent>

        <TabsContent value="monthly" className="space-y-4">
          <div className="flex justify-end mb-4">
            <Select value={selectedPeriod} onValueChange={(v: "6" | "12") => setSelectedPeriod(v)}>
              <SelectTrigger className="w-full sm:w-auto sm:min-w-[180px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="6">Últimos 6 meses</SelectItem>
                <SelectItem value="12">Últimos 12 meses</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <Card className="border-0 shadow-elegant">
              <CardHeader><CardTitle>Receitas vs Despesas</CardTitle></CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={350}>
                  <BarChart data={monthlyData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis dataKey="month" stroke="hsl(var(--muted-foreground))" />
                    <YAxis stroke="hsl(var(--muted-foreground))" />
                    <Tooltip formatter={fmt} contentStyle={ttStyle} itemStyle={ttItemStyle} labelStyle={ttItemStyle} /><Legend />
                    <Bar dataKey="receitas" fill="hsl(var(--success))" name="Receitas" />
                    <Bar dataKey="despesas" fill="hsl(var(--destructive))" name="Despesas" />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
            <Card className="border-0 shadow-elegant">
              <CardHeader><CardTitle>Evolução do Saldo</CardTitle></CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={350}>
                  <LineChart data={monthlyData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis dataKey="month" stroke="hsl(var(--muted-foreground))" />
                    <YAxis stroke="hsl(var(--muted-foreground))" />
                    <Tooltip formatter={fmt} contentStyle={ttStyle} itemStyle={ttItemStyle} labelStyle={ttItemStyle} /><Legend />
                    <Line type="monotone" dataKey="saldo" stroke="hsl(var(--primary))" strokeWidth={3} name="Saldo" />
                  </LineChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="goals">
          <Card className="border-0 shadow-elegant">
            <CardHeader><CardTitle>Progresso das Metas</CardTitle></CardHeader>
            <CardContent>
              {goalsData.length === 0 ? <div className="text-center py-12 text-muted-foreground">Nenhuma meta cadastrada</div> : (
                <ResponsiveContainer width="100%" height={400}>
                  <BarChart data={goalsData} layout="vertical">
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis type="number" stroke="hsl(var(--muted-foreground))" />
                    <YAxis dataKey="name" type="category" stroke="hsl(var(--muted-foreground))" width={120} />
                    <Tooltip formatter={fmt} contentStyle={ttStyle} itemStyle={ttItemStyle} labelStyle={ttItemStyle} /><Legend />
                    <Bar dataKey="atual" fill="hsl(var(--primary))" name="Valor Atual" />
                    <Bar dataKey="meta" fill="hsl(var(--muted))" name="Meta" />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="trends">
          <Card className="border-0 shadow-elegant">
            <CardHeader><CardTitle>Tendência Financeira</CardTitle></CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={400}>
                <AreaChart data={monthlyData}>
                  <defs>
                    <linearGradient id="colorReceitas" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="hsl(var(--success))" stopOpacity={0.8} />
                      <stop offset="95%" stopColor="hsl(var(--success))" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="colorDespesas" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="hsl(var(--destructive))" stopOpacity={0.8} />
                      <stop offset="95%" stopColor="hsl(var(--destructive))" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="month" stroke="hsl(var(--muted-foreground))" />
                  <YAxis stroke="hsl(var(--muted-foreground))" />
                  <Tooltip formatter={fmt} contentStyle={ttStyle} itemStyle={ttItemStyle} labelStyle={ttItemStyle} /><Legend />
                  <Area type="monotone" dataKey="receitas" stroke="hsl(var(--success))" fillOpacity={1} fill="url(#colorReceitas)" name="Receitas" />
                  <Area type="monotone" dataKey="despesas" stroke="hsl(var(--destructive))" fillOpacity={1} fill="url(#colorDespesas)" name="Despesas" />
                </AreaChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
