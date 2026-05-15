import { useState, useMemo, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Progress } from "@/components/ui/progress";
import { Plus, Target, Calendar, DollarSign, Trash2, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { parseLocalDate } from "@/lib/dateUtils";

interface Goal {
  id: string;
  title: string;
  target_amount: number;
  current_amount: number;
  deadline: string;
  category: string | null;
  completed: boolean;
}

export default function Goals() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [newGoal, setNewGoal] = useState({
    title: "",
    target_amount: "",
    deadline: "",
    category: "",
  });

  const { data: goals, isLoading } = useQuery({
    queryKey: ['goals', user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('financial_goals')
        .select('*')
        .eq('user_id', user!.id)
        .order('deadline', { ascending: true });

      if (error) throw error;
      return data as Goal[];
    },
    enabled: !!user,
  });

  const createGoalMutation = useMutation({
    mutationFn: async (goal: typeof newGoal) => {
      const { error } = await supabase
        .from('financial_goals')
        .insert({
          user_id: user!.id,
          title: goal.title,
          target_amount: parseFloat(goal.target_amount),
          deadline: goal.deadline,
          category: goal.category || null,
        });

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['goals'] });
      toast.success('Meta criada com sucesso!');
      setIsDialogOpen(false);
      setNewGoal({ title: "", target_amount: "", deadline: "", category: "" });
    },
    onError: (error) => {
      console.error('Error creating goal:', error);
      toast.error('Erro ao criar meta');
    },
  });

  const deleteGoalMutation = useMutation({
    mutationFn: async (goalId: string) => {
      const { error } = await supabase
        .from('financial_goals')
        .delete()
        .eq('id', goalId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['goals'] });
      toast.success('Meta excluída com sucesso!');
    },
    onError: (error) => {
      console.error('Error deleting goal:', error);
      toast.error('Erro ao excluir meta');
    },
  });

  const updateProgressMutation = useMutation({
    mutationFn: async ({ goalId, amount }: { goalId: string; amount: number }) => {
      const goal = goals?.find(g => g.id === goalId);
      if (!goal) return;

      const newAmount = goal.current_amount + amount;
      const completed = newAmount >= goal.target_amount;

      const { error } = await supabase
        .from('financial_goals')
        .update({
          current_amount: newAmount,
          completed,
          completed_at: completed ? new Date().toISOString() : null,
        })
        .eq('id', goalId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['goals'] });
      toast.success('Progresso atualizado!');
    },
    onError: (error) => {
      console.error('Error updating progress:', error);
      toast.error('Erro ao atualizar progresso');
    },
  });

  const handleCreateGoal = (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validação de campos obrigatórios
    if (!newGoal.title || !newGoal.target_amount || !newGoal.deadline) {
      toast.error('Preencha todos os campos obrigatórios');
      return;
    }

    // Validação de valor positivo
    const amount = parseFloat(newGoal.target_amount);
    if (amount <= 0) {
      toast.error('O valor alvo deve ser maior que zero');
      return;
    }

    // Validação de data futura (usar parseLocalDate p/ evitar off-by-one UTC)
    const deadline = parseLocalDate(newGoal.deadline);
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    if (deadline < today) {
      toast.error('A data da meta deve ser futura');
      return;
    }

    createGoalMutation.mutate(newGoal);
  };

  const getProgressPercentage = useCallback((goal: Goal) => {
    return Math.min((goal.current_amount / goal.target_amount) * 100, 100);
  }, []);

  const activeGoals = useMemo(() => goals?.filter(g => !g.completed) || [], [goals]);
  const completedGoals = useMemo(() => goals?.filter(g => g.completed) || [], [goals]);

  return (
    <div className="container mx-auto px-3 sm:px-4 py-4 sm:py-8 max-w-7xl">
      
      
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6 sm:mb-8">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold flex items-center gap-2">
              <Target className="h-6 w-6 sm:h-8 sm:w-8 text-primary" />
              Metas Financeiras
            </h1>
            <p className="text-muted-foreground mt-1 sm:mt-2 text-sm sm:text-base">
              Defina objetivos e acompanhe seu progresso
            </p>
          </div>

          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button className="w-full sm:w-auto">
                <Plus className="mr-2 h-4 w-4" />
                Nova Meta
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Criar Nova Meta</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleCreateGoal} className="space-y-4">
                <div>
                  <Label htmlFor="title">Título da Meta *</Label>
                  <Input
                    id="title"
                    placeholder="Ex: Viagem para Europa"
                    value={newGoal.title}
                    onChange={(e) => setNewGoal({ ...newGoal, title: e.target.value })}
                  />
                </div>
                <div>
                  <Label htmlFor="target_amount">Valor Alvo (R$) *</Label>
                  <Input
                    id="target_amount"
                    type="number"
                    step="0.01"
                    placeholder="5000.00"
                    value={newGoal.target_amount}
                    onChange={(e) => setNewGoal({ ...newGoal, target_amount: e.target.value })}
                  />
                </div>
                <div>
                  <Label htmlFor="deadline">Prazo *</Label>
                  <Input
                    id="deadline"
                    type="date"
                    value={newGoal.deadline}
                    onChange={(e) => setNewGoal({ ...newGoal, deadline: e.target.value })}
                  />
                </div>
                <div>
                  <Label htmlFor="category">Categoria (opcional)</Label>
                  <Input
                    id="category"
                    placeholder="Ex: Viagem, Casa, Educação"
                    value={newGoal.category}
                    onChange={(e) => setNewGoal({ ...newGoal, category: e.target.value })}
                  />
                </div>
                <Button type="submit" className="w-full" disabled={createGoalMutation.isPending}>
                  {createGoalMutation.isPending ? 'Criando...' : 'Criar Meta'}
                </Button>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        {isLoading ? (
          <div className="flex justify-center py-12">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
          </div>
        ) : (
          <div className="space-y-6 sm:space-y-8">
            {activeGoals.length > 0 && (
              <div>
                <h2 className="text-lg sm:text-xl font-semibold mb-3 sm:mb-4">Metas Ativas</h2>
                <div className="grid gap-3 sm:gap-4 grid-cols-1 md:grid-cols-2">
                  {activeGoals.map((goal) => (
                    <GoalCard
                      key={goal.id}
                      goal={goal}
                      onDelete={() => setDeleteId(goal.id)}
                      onUpdateProgress={(amount) => updateProgressMutation.mutate({ goalId: goal.id, amount })}
                    />
                  ))}
                </div>
              </div>
            )}

            {completedGoals.length > 0 && (
              <div>
                <h2 className="text-lg sm:text-xl font-semibold mb-3 sm:mb-4 flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 sm:h-5 sm:w-5 text-success" />
                  Metas Concluídas
                </h2>
                <div className="grid gap-3 sm:gap-4 grid-cols-1 md:grid-cols-2">
                  {completedGoals.map((goal) => (
                    <GoalCard
                      key={goal.id}
                      goal={goal}
                      onDelete={() => setDeleteId(goal.id)}
                      onUpdateProgress={() => {}}
                    />
                  ))}
                </div>
              </div>
            )}

            {goals?.length === 0 && (
              <Card>
                <CardContent className="flex flex-col items-center justify-center py-8 sm:py-12">
                  <Target className="h-10 w-10 sm:h-12 sm:w-12 text-muted-foreground mb-3 sm:mb-4" />
                  <p className="text-muted-foreground text-center text-sm sm:text-base px-4">
                    Você ainda não tem metas financeiras.
                    <br />
                    Crie sua primeira meta para começar!
                  </p>
                </CardContent>
              </Card>
            )}
          </div>
        )}
      <ConfirmDialog
        open={!!deleteId}
        onOpenChange={(open) => { if (!open) setDeleteId(null); }}
        onConfirm={() => { if (deleteId) { deleteGoalMutation.mutate(deleteId); setDeleteId(null); } }}
        title="Excluir meta?"
        description="Esta meta será removida permanentemente junto com seu progresso."
      />
    </div>
  );
}

interface GoalCardProps {
  goal: Goal;
  onDelete: () => void;
  onUpdateProgress: (amount: number) => void;
}

function GoalCard({ goal, onDelete, onUpdateProgress }: GoalCardProps) {
  const [addAmount, setAddAmount] = useState("");
  const percentage = Math.min((goal.current_amount / goal.target_amount) * 100, 100);
  const remaining = Math.max(goal.target_amount - goal.current_amount, 0);
  
  const deadlineDate = parseLocalDate(goal.deadline);
  const todayLocal = new Date();
  todayLocal.setHours(0, 0, 0, 0);
  const daysUntilDeadline = Math.ceil(
    (deadlineDate.getTime() - todayLocal.getTime()) / (1000 * 60 * 60 * 24)
  );

  const handleAddProgress = (e: React.FormEvent) => {
    e.preventDefault();
    const amount = parseFloat(addAmount);
    
    if (isNaN(amount) || amount <= 0) {
      toast.error('Digite um valor válido maior que zero');
      return;
    }
    
    onUpdateProgress(amount);
    setAddAmount("");
  };

  return (
    <Card>
      <CardHeader className="pb-3 sm:pb-4">
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            <CardTitle className="text-base sm:text-lg truncate">{goal.title}</CardTitle>
            {goal.category && (
              <CardDescription className="mt-1 text-xs sm:text-sm">{goal.category}</CardDescription>
            )}
          </div>
          {!goal.completed && (
            <Button
              variant="ghost"
              size="sm"
              onClick={onDelete}
              className="text-destructive hover:text-destructive flex-shrink-0"
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-3 sm:space-y-4">
        <div>
          <div className="flex justify-between text-xs sm:text-sm mb-2">
            <span>Progresso</span>
            <span className="font-semibold">{percentage.toFixed(1)}%</span>
          </div>
          <Progress value={percentage} className="h-2" />
        </div>

        <div className="grid grid-cols-2 gap-2 sm:gap-4 text-xs sm:text-sm">
          <div className="bg-muted/50 rounded-lg p-2 sm:p-3">
            <div className="flex items-center gap-1 sm:gap-2 text-muted-foreground mb-1">
              <DollarSign className="h-3 w-3" />
              <span>Atual</span>
            </div>
            <p className="font-semibold text-success text-xs sm:text-sm">
              R$ {goal.current_amount.toFixed(2)}
            </p>
          </div>
          <div className="bg-muted/50 rounded-lg p-2 sm:p-3">
            <div className="flex items-center gap-1 sm:gap-2 text-muted-foreground mb-1">
              <Target className="h-3 w-3" />
              <span>Objetivo</span>
            </div>
            <p className="font-semibold text-xs sm:text-sm">
              R$ {goal.target_amount.toFixed(2)}
            </p>
          </div>
        </div>

        {!goal.completed && (
          <>
            <div className="bg-muted/50 rounded-lg p-2 sm:p-3">
              <div className="flex items-center gap-1 sm:gap-2 text-muted-foreground mb-1">
                <Calendar className="h-3 w-3" />
                <span className="text-xs sm:text-sm">Faltam</span>
              </div>
              <p className="font-semibold text-xs sm:text-sm">
                R$ {remaining.toFixed(2)} • {daysUntilDeadline} dias
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                até {format(parseLocalDate(goal.deadline), "dd 'de' MMMM 'de' yyyy", { locale: ptBR })}
              </p>
            </div>

            <form onSubmit={handleAddProgress} className="flex gap-2">
              <Input
                type="number"
                step="0.01"
                min="0.01"
                placeholder="R$ 0,00"
                value={addAmount}
                onChange={(e) => setAddAmount(e.target.value)}
                className="flex-1 text-sm"
              />
              <Button type="submit" size="sm">
                Adicionar
              </Button>
            </form>
          </>
        )}

        {goal.completed && (
          <div className="bg-success/10 border border-success/20 rounded-lg p-3 text-center">
            <CheckCircle2 className="h-6 w-6 text-success mx-auto mb-2" />
            <p className="text-sm font-semibold text-success">Meta Atingida! 🎉</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
