import { useState, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Progress } from "@/components/ui/progress";
import { Plus, Wallet, AlertTriangle, CheckCircle2, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { ConfirmDialog } from "@/components/ConfirmDialog";

export default function Budgets() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [selectedMonth, setSelectedMonth] = useState(format(new Date(), 'yyyy-MM'));
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [newBudget, setNewBudget] = useState({
    category_id: "",
    amount: "",
    month: format(new Date(), 'yyyy-MM-01')
  });

  const { data: categories } = useQuery({
    queryKey: ['categories', user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('categories')
        .select('*')
        .eq('user_id', user!.id)
        .eq('type', 'expense');
      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });

  const { data: budgets, isLoading } = useQuery({
    queryKey: ['budgets', user?.id, selectedMonth],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('budgets')
        .select('*, categories(name, color)')
        .eq('user_id', user!.id)
        .eq('month', `${selectedMonth}-01`);
      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });

  const { data: transactions } = useQuery({
    queryKey: ['transactions-by-month', user?.id, selectedMonth],
    queryFn: async () => {
      const [y, m] = selectedMonth.split('-').map(Number);
      const startDate = `${selectedMonth}-01`;
      // First day of NEXT month, used as exclusive upper bound
      const nextYear = m === 12 ? y + 1 : y;
      const nextMonth = m === 12 ? 1 : m + 1;
      const endDateExclusive = `${nextYear}-${String(nextMonth).padStart(2, '0')}-01`;
      const { data, error } = await supabase
        .from('transactions')
        .select('amount, category_id, type')
        .eq('user_id', user!.id)
        .eq('type', 'expense')
        .gte('date', startDate)
        .lt('date', endDateExclusive);
      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });

  const createBudgetMutation = useMutation({
    mutationFn: async (budget: typeof newBudget) => {
      const { error } = await supabase
        .from('budgets')
        .insert({
          user_id: user!.id,
          category_id: budget.category_id,
          amount: parseFloat(budget.amount),
          month: budget.month
        });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['budgets'] });
      toast.success('Orçamento criado!');
      setIsDialogOpen(false);
      setNewBudget({ category_id: "", amount: "", month: format(new Date(), 'yyyy-MM-01') });
    },
    onError: () => toast.error('Erro ao criar orçamento'),
  });

  const deleteBudgetMutation = useMutation({
    mutationFn: async (budgetId: string) => {
      const { error } = await supabase
        .from('budgets')
        .delete()
        .eq('id', budgetId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['budgets'] });
      toast.success('Orçamento excluído!');
    },
    onError: () => toast.error('Erro ao excluir orçamento'),
  });

  const getSpentAmount = useCallback((categoryId: string) => {
    if (!transactions) return 0;
    return transactions
      .filter(t => t.category_id === categoryId)
      .reduce((sum, t) => sum + Number(t.amount), 0);
  }, [transactions]);

  return (
    <div className="container mx-auto px-3 sm:px-4 py-4 sm:py-8 max-w-7xl">
      
      
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6 sm:mb-8">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold flex items-center gap-2">
              <Wallet className="h-6 w-6 sm:h-8 sm:w-8 text-primary" />
              Orçamentos
            </h1>
            <p className="text-muted-foreground mt-1 sm:mt-2 text-sm sm:text-base">
              Gerencie seus limites de gastos por categoria
            </p>
          </div>

          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button className="w-full sm:w-auto">
                <Plus className="mr-2 h-4 w-4" />
                Novo Orçamento
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Criar Orçamento</DialogTitle>
              </DialogHeader>
              <form onSubmit={(e) => {
                e.preventDefault();
                if (!newBudget.category_id) { toast.error('Selecione uma categoria'); return; }
                const amount = parseFloat(newBudget.amount);
                if (!amount || amount <= 0) { toast.error('Informe um valor válido maior que zero'); return; }
                createBudgetMutation.mutate(newBudget);
              }} className="space-y-4">
                <div>
                  <Label>Categoria</Label>
                  <Select value={newBudget.category_id} onValueChange={(value) => setNewBudget({...newBudget, category_id: value})}>
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione uma categoria" />
                    </SelectTrigger>
                    <SelectContent>
                      {categories?.map((cat) => (
                        <SelectItem key={cat.id} value={cat.id}>
                          {cat.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Valor Limite (R$)</Label>
                  <Input
                    type="number"
                    step="0.01"
                    value={newBudget.amount}
                    onChange={(e) => setNewBudget({...newBudget, amount: e.target.value})}
                  />
                </div>
                <div>
                  <Label>Mês</Label>
                  <Input
                    type="month"
                    value={newBudget.month.slice(0, 7)}
                    onChange={(e) => setNewBudget({...newBudget, month: `${e.target.value}-01`})}
                  />
                </div>
                <Button type="submit" className="w-full">Criar</Button>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        <div className="mb-4 sm:mb-6">
          <Label className="text-sm sm:text-base">Filtrar por Mês</Label>
          <Input
            type="month"
            value={selectedMonth}
            onChange={(e) => setSelectedMonth(e.target.value)}
            className="max-w-full sm:max-w-xs mt-1"
          />
        </div>

        {isLoading ? (
          <div className="flex justify-center py-12">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
          </div>
        ) : budgets?.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-8 sm:py-12">
              <Wallet className="h-10 w-10 sm:h-12 sm:w-12 text-muted-foreground mb-3 sm:mb-4" />
              <p className="text-muted-foreground text-center text-sm sm:text-base px-4">
                Nenhum orçamento definido para este mês.
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-3 sm:gap-4 grid-cols-1 md:grid-cols-2">
            {budgets?.map((budget) => {
              const spent = getSpentAmount(budget.category_id);
              const percentage = (spent / Number(budget.amount)) * 100;
              const isWarning = percentage >= 80 && percentage < 100;
              const isExceeded = percentage >= 100;

              return (
                <Card key={budget.id} className={isExceeded ? 'border-destructive' : isWarning ? 'border-warning' : ''}>
                  <CardHeader className="pb-3 sm:pb-4">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <CardTitle className="text-base sm:text-lg flex items-center gap-2">
                          <div
                            className="h-3 w-3 rounded-full flex-shrink-0"
                            style={{ backgroundColor: budget.categories?.color }}
                          />
                          <span className="truncate">{budget.categories?.name}</span>
                        </CardTitle>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setDeleteId(budget.id)}
                        className="text-destructive hover:text-destructive flex-shrink-0"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-3 sm:space-y-4">
                    <div>
                      <div className="flex justify-between text-xs sm:text-sm mb-2">
                        <span>Gasto</span>
                        <span className={`font-semibold ${isExceeded ? 'text-destructive' : isWarning ? 'text-warning' : 'text-success'}`}>
                          {percentage.toFixed(0)}%
                        </span>
                      </div>
                      <Progress 
                        value={Math.min(percentage, 100)} 
                        className={`h-2 ${isExceeded ? '[&>div]:bg-destructive' : isWarning ? '[&>div]:bg-warning' : '[&>div]:bg-success'}`}
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-2 sm:gap-4 text-xs sm:text-sm">
                      <div className="bg-muted/50 rounded-lg p-2 sm:p-3">
                        <p className="text-muted-foreground mb-1">Gasto</p>
                        <p className={`font-semibold text-sm sm:text-base ${isExceeded ? 'text-destructive' : 'text-foreground'}`}>
                          R$ {spent.toFixed(2)}
                        </p>
                      </div>
                      <div className="bg-muted/50 rounded-lg p-2 sm:p-3">
                        <p className="text-muted-foreground mb-1">Limite</p>
                        <p className="font-semibold text-sm sm:text-base">
                          R$ {Number(budget.amount).toFixed(2)}
                        </p>
                      </div>
                    </div>

                    {isExceeded && (
                      <div className="bg-destructive/10 border border-destructive/20 rounded-lg p-2 sm:p-3 flex items-start gap-2">
                        <AlertTriangle className="h-4 w-4 sm:h-5 sm:w-5 text-destructive flex-shrink-0 mt-0.5" />
                        <div className="text-xs sm:text-sm">
                          <p className="font-semibold text-destructive">Orçamento Ultrapassado!</p>
                          <p className="text-muted-foreground">
                            R$ {(spent - Number(budget.amount)).toFixed(2)} acima do limite
                          </p>
                        </div>
                      </div>
                    )}

                    {isWarning && !isExceeded && (
                      <div className="bg-warning/10 border border-warning/20 rounded-lg p-2 sm:p-3 flex items-start gap-2">
                        <AlertTriangle className="h-4 w-4 sm:h-5 sm:w-5 text-warning flex-shrink-0 mt-0.5" />
                        <div className="text-xs sm:text-sm">
                          <p className="font-semibold text-warning">Atenção!</p>
                          <p className="text-muted-foreground">
                            Faltam R$ {(Number(budget.amount) - spent).toFixed(2)}
                          </p>
                        </div>
                      </div>
                    )}

                    {!isWarning && !isExceeded && (
                      <div className="bg-success/10 border border-success/20 rounded-lg p-2 sm:p-3 flex items-start gap-2">
                        <CheckCircle2 className="h-4 w-4 sm:h-5 sm:w-5 text-success flex-shrink-0 mt-0.5" />
                        <div className="text-xs sm:text-sm">
                          <p className="font-semibold text-success">Dentro do Orçamento</p>
                          <p className="text-muted-foreground">
                            R$ {(Number(budget.amount) - spent).toFixed(2)} disponíveis
                          </p>
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      <ConfirmDialog
        open={!!deleteId}
        onOpenChange={(open) => { if (!open) setDeleteId(null); }}
        onConfirm={() => { if (deleteId) { deleteBudgetMutation.mutate(deleteId); setDeleteId(null); } }}
        title="Excluir orçamento?"
        description="Este orçamento será removido permanentemente."
      />
    </div>
  );
}
