import { useState, useMemo, useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Download, FileSpreadsheet, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { formatDateBR, toLocalISO } from "@/lib/dateUtils";
import { useAuth } from "@/contexts/AuthContext";

export default function Reports() {
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth().toString());
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear().toString());
  const [isExporting, setIsExporting] = useState(false);

  const { user } = useAuth();

  const { data: transactions } = useQuery({
    queryKey: ["transactions-report", user?.id, selectedMonth, selectedYear],
    queryFn: async () => {
      const startDate = new Date(parseInt(selectedYear), parseInt(selectedMonth), 1);
      const endDate = new Date(parseInt(selectedYear), parseInt(selectedMonth) + 1, 0);

      const { data, error } = await supabase
        .from("transactions")
        .select("*, categories(name), banks(name)")
        .eq("user_id", user!.id)
        .gte("date", toLocalISO(startDate))
        .lte("date", toLocalISO(endDate))
        .order("date", { ascending: false });

      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });

  const exportToCSV = useCallback(() => {
    if (!transactions || transactions.length === 0) {
      toast.error("Não há transações para exportar neste período");
      return;
    }

    setIsExporting(true);

    try {
      const headers = ["Data", "Descrição", "Categoria", "Banco", "Tipo", "Valor"];
      const esc = (v: any) => `"${String(v ?? '').replace(/"/g, '""')}"`;
      const csvContent = [
        headers.join(","),
        ...transactions.map((t) => [
          esc(formatDateBR(t.date)),
          esc(t.description),
          esc(t.categories?.name || 'Sem categoria'),
          esc(t.banks?.name || 'Sem banco'),
          t.type === "income" ? "Receita" : "Despesa",
          Number(t.amount).toFixed(2)
        ].join(","))
      ].join("\n");

      const blob = new Blob(["\ufeff" + csvContent], { type: "text/csv;charset=utf-8;" });
      const link = document.createElement("a");
      const url = URL.createObjectURL(blob);
      
      link.setAttribute("href", url);
      const monthNum = String(parseInt(selectedMonth) + 1).padStart(2, "0");
      link.setAttribute("download", `relatorio_${selectedYear}-${monthNum}.csv`);
      link.style.visibility = "hidden";
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      toast.success("Relatório exportado com sucesso!");
    } catch (error) {
      console.error("Error exporting:", error);
      toast.error("Erro ao exportar relatório");
    } finally {
      setIsExporting(false);
    }
  }, [transactions, selectedMonth, selectedYear]);

  const months = [
    { value: "0", label: "Janeiro" },
    { value: "1", label: "Fevereiro" },
    { value: "2", label: "Março" },
    { value: "3", label: "Abril" },
    { value: "4", label: "Maio" },
    { value: "5", label: "Junho" },
    { value: "6", label: "Julho" },
    { value: "7", label: "Agosto" },
    { value: "8", label: "Setembro" },
    { value: "9", label: "Outubro" },
    { value: "10", label: "Novembro" },
    { value: "11", label: "Dezembro" },
  ];

  const currentYear = new Date().getFullYear();
  const years = useMemo(() => Array.from({ length: 5 }, (_, i) => currentYear - i), [currentYear]);

  const totalIncome = useMemo(() => 
    transactions?.reduce((sum, t) => 
      t.type === "income" ? sum + Number(t.amount) : sum, 0) || 0
  , [transactions]);
  
  const totalExpense = useMemo(() => 
    transactions?.reduce((sum, t) => 
      t.type === "expense" ? sum + Number(t.amount) : sum, 0) || 0
  , [transactions]);
  
  const balance = useMemo(() => totalIncome - totalExpense, [totalIncome, totalExpense]);

  return (
    <div className="container mx-auto px-3 sm:px-4 py-4 sm:py-8 max-w-7xl">
      
        <h1 className="text-2xl sm:text-3xl font-bold mb-4 sm:mb-6 text-foreground">Relatórios</h1>

        <div className="grid gap-3 sm:gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 mb-6 sm:mb-8">
          <Card className="animate-scale-in">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total de Receitas</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-success">
                R$ {totalIncome.toFixed(2)}
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                {transactions?.filter(t => t.type === "income").length || 0} transações
              </p>
            </CardContent>
          </Card>

          <Card className="animate-scale-in" style={{ animationDelay: "0.1s" }}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total de Despesas</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-destructive">
                R$ {totalExpense.toFixed(2)}
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                {transactions?.filter(t => t.type === "expense").length || 0} transações
              </p>
            </CardContent>
          </Card>

          <Card className="animate-scale-in" style={{ animationDelay: "0.2s" }}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Saldo</CardTitle>
            </CardHeader>
            <CardContent>
              <div className={`text-2xl font-bold ${balance >= 0 ? 'text-success' : 'text-destructive'}`}>
                R$ {balance.toFixed(2)}
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                {transactions?.length || 0} transações no total
              </p>
            </CardContent>
          </Card>
        </div>

        <Card className="animate-fade-in-up">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileSpreadsheet className="h-5 w-5" />
              Exportar Relatório
            </CardTitle>
            <CardDescription>
              Selecione o período e exporte suas transações para uma planilha CSV
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="month">Mês</Label>
                <Select value={selectedMonth} onValueChange={setSelectedMonth}>
                  <SelectTrigger id="month">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {months.map((month) => (
                      <SelectItem key={month.value} value={month.value}>
                        {month.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="year">Ano</Label>
                <Select value={selectedYear} onValueChange={setSelectedYear}>
                  <SelectTrigger id="year">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {years.map((year) => (
                      <SelectItem key={year} value={year.toString()}>
                        {year}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <Button 
              onClick={exportToCSV} 
              disabled={isExporting || !transactions || transactions.length === 0}
              className="w-full"
              size="lg"
            >
              {isExporting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Exportando...
                </>
              ) : (
                <>
                  <Download className="mr-2 h-4 w-4" />
                  Exportar para CSV
                </>
              )}
            </Button>

            {transactions && transactions.length > 0 && (
              <div className="mt-6 p-4 bg-muted rounded-lg">
                <h3 className="font-semibold mb-2">Preview dos Dados</h3>
                <div className="text-sm text-muted-foreground space-y-1">
                  <p>• {transactions.length} transações encontradas</p>
                  <p>• Período: {months[parseInt(selectedMonth)].label} de {selectedYear}</p>
                  <p>• Formato: CSV (compatível com Excel, Google Sheets)</p>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
  );
}