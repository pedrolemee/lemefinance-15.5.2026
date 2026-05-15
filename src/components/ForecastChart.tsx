import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, ReferenceLine } from "recharts";
import { ForecastMonth } from "@/hooks/useForecast";

const tooltipStyle = {
  backgroundColor: "hsl(var(--card))",
  border: "1px solid hsl(var(--border))",
  borderRadius: "0.5rem",
  boxShadow: "var(--shadow-md)",
  fontSize: "0.75rem",
  color: "hsl(var(--foreground))",
};

export function ForecastChart({ months }: { months: ForecastMonth[] }) {
  const data = months.map((m) => ({
    name: m.label,
    Acumulado: Number(m.cumulativeBalance.toFixed(2)),
    Mês: Number(m.monthBalance.toFixed(2)),
  }));

  return (
    <Card className="border-0 shadow-elegant">
      <CardHeader className="px-4 sm:px-6">
        <CardTitle className="text-base sm:text-lg md:text-xl">Projeção de Saldo</CardTitle>
      </CardHeader>
      <CardContent className="px-1 sm:px-6">
        <ResponsiveContainer width="100%" height={300}>
          <LineChart data={data}>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.3} />
            <XAxis dataKey="name" stroke="hsl(var(--muted-foreground))" fontSize={10} angle={-45} textAnchor="end" height={60} />
            <YAxis stroke="hsl(var(--muted-foreground))" fontSize={10} width={60} />
            <Tooltip
              formatter={(value) => `R$ ${Number(value).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`}
              contentStyle={tooltipStyle}
            />
            <Legend wrapperStyle={{ paddingTop: "0.5rem", fontSize: "0.75rem" }} />
            <ReferenceLine y={0} stroke="hsl(var(--destructive))" strokeDasharray="4 4" />
            <Line type="monotone" dataKey="Acumulado" stroke="hsl(var(--primary))" strokeWidth={3} dot={{ r: 3 }} activeDot={{ r: 5 }} />
            <Line type="monotone" dataKey="Mês" stroke="hsl(var(--accent-foreground))" strokeWidth={2} dot={{ r: 2 }} strokeDasharray="5 5" />
          </LineChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}
