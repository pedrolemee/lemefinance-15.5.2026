import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Plus, Repeat, Trash2, Calendar, Edit } from "lucide-react";
import { toast } from "sonner";
import { ConfirmDialog } from "@/components/ConfirmDialog";

const todayISO = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

const emptyForm = {
  description: "",
  amount: "",
  type: "expense" as "income" | "expense",
  category_id: "",
  frequency: "monthly",
  day_of_month: "1",
  start_date: todayISO(),
  end_date: "",
};

export default function RecurringTransactions() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);

  const { data: categories } = useQuery({
    queryKey: ['categories', user?.id],
    queryFn: async () => {
      const { data, error } = await supabase.from('categories').select('*').eq('user_id', user!.id);
      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });

  const { data: recurring, isLoading } = useQuery({
    queryKey: ['recurring-transactions', user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('recurring_transactions')
        .select('*, categories(name, color)')
        .eq('user_id', user!.id)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['recurring-transactions'] });
    queryClient.invalidateQueries({ queryKey: ['forecast-data'] });
    queryClient.invalidateQueries({ queryKey: ['transactions'] });
    queryClient.invalidateQueries({ queryKey: ['transactions-balance'] });
    queryClient.invalidateQueries({ queryKey: ['transactions-by-bank'] });
    queryClient.invalidateQueries({ queryKey: ['dashboard-transactions'] });
  };

  const todayStr = todayISO();

  const upsertMutation = useMutation({
    mutationFn: async () => {
      const payload = {
        description: form.description.trim(),
        amount: parseFloat(form.amount),
        type: form.type,
        category_id: form.category_id || null,
        frequency: form.frequency,
        day_of_month: parseInt(form.day_of_month),
        start_date: form.start_date,
        end_date: form.end_date || null,
      };
      if (editingId) {
        // Find old recurring to match generated transactions
        const old = recurring?.find((r: any) => r.id === editingId);
        const { error } = await supabase.from('recurring_transactions').update(payload).eq('id', editingId);
        if (error) throw error;
        // Update matching future transactions (date >= today) so dashboard reflects new value/desc
        if (old) {
          // Match estrito: descrição + tipo + valor + categoria, evita afetar
          // transações manuais com nome parecido.
          let q = supabase.from('transactions')
            .update({ amount: payload.amount, description: payload.description, category_id: payload.category_id, type: payload.type })
            .eq('user_id', user!.id)
            .eq('description', old.description)
            .eq('type', old.type)
            .eq('amount', old.amount)
            .gte('date', todayStr)
            .is('parent_transaction_id', null);
          q = old.category_id ? q.eq('category_id', old.category_id) : q.is('category_id', null);
          await q;
        }
      } else {
        const { error } = await supabase.from('recurring_transactions').insert({ ...payload, user_id: user!.id });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      invalidate();
      toast.success(editingId ? 'Recorrente atualizada!' : 'Recorrente criada!');
      setIsDialogOpen(false);
      setEditingId(null);
      setForm(emptyForm);
    },
    onError: () => toast.error('Erro ao salvar'),
  });

  const toggleActiveMutation = useMutation({
    mutationFn: async ({ id, active }: { id: string; active: boolean }) => {
      const rec = recurring?.find((r: any) => r.id === id);
      const { error } = await supabase.from('recurring_transactions').update({ active }).eq('id', id);
      if (error) throw error;
      // When disabling, remove future occurrences already generated to avoid them showing.
      // Match estrito: descrição + tipo + valor + categoria.
      if (!active && rec) {
        let q = supabase.from('transactions')
          .delete()
          .eq('user_id', user!.id)
          .eq('description', rec.description)
          .eq('type', rec.type)
          .eq('amount', rec.amount)
          .gte('date', todayStr)
          .is('parent_transaction_id', null);
        q = rec.category_id ? q.eq('category_id', rec.category_id) : q.is('category_id', null);
        await q;
      }
    },
    onSuccess: () => { invalidate(); toast.success('Status atualizado!'); },
    onError: () => toast.error('Erro ao atualizar status'),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('recurring_transactions').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => { invalidate(); toast.success('Recorrente excluída!'); },
    onError: () => toast.error('Erro ao excluir'),
  });

  const handleEdit = (rec: any) => {
    setEditingId(rec.id);
    setForm({
      description: rec.description,
      amount: String(rec.amount),
      type: rec.type,
      category_id: rec.category_id || "",
      frequency: rec.frequency,
      day_of_month: String(rec.day_of_month || 1),
      start_date: rec.start_date || todayISO(),
      end_date: rec.end_date || "",
    });
    setIsDialogOpen(true);
  };

  const handleNew = () => {
    setEditingId(null);
    setForm(emptyForm);
    setIsDialogOpen(true);
  };

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.description.trim()) { toast.error('Informe uma descrição'); return; }
    const amount = parseFloat(form.amount);
    if (!amount || amount <= 0) { toast.error('Informe um valor válido maior que zero'); return; }
    if (!form.category_id) { toast.error('Selecione uma categoria'); return; }
    const day = parseInt(form.day_of_month);
    if (!day || day < 1 || day > 31) { toast.error('Dia do mês deve ser entre 1 e 31'); return; }
    if (!form.start_date) { toast.error('Informe a data de início'); return; }
    if (form.end_date && form.end_date < form.start_date) { toast.error('A data final deve ser após a data de início'); return; }
    upsertMutation.mutate();
  };

  return (
    <div className="container mx-auto px-3 sm:px-4 py-4 sm:py-8 max-w-7xl">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6 sm:mb-8">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold flex items-center gap-2">
            <Repeat className="h-6 w-6 sm:h-8 sm:w-8 text-primary" />
            Transações Recorrentes
          </h1>
          <p className="text-muted-foreground mt-1 sm:mt-2 text-sm sm:text-base">
            Configure transações que se repetem automaticamente
          </p>
        </div>

        <Dialog open={isDialogOpen} onOpenChange={(o) => { setIsDialogOpen(o); if (!o) { setEditingId(null); setForm(emptyForm); } }}>
          <DialogTrigger asChild>
            <Button className="w-full sm:w-auto" onClick={handleNew}>
              <Plus className="mr-2 h-4 w-4" /> Nova Recorrente
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{editingId ? 'Editar' : 'Criar'} Transação Recorrente</DialogTitle>
            </DialogHeader>
            <form onSubmit={submit} className="space-y-4">
              <div>
                <Label>Descrição</Label>
                <Input value={form.description} onChange={(e) => setForm({...form, description: e.target.value})} placeholder="Ex: Aluguel, Netflix" />
              </div>
              <div>
                <Label>Valor (R$)</Label>
                <Input type="number" step="0.01" value={form.amount} onChange={(e) => setForm({...form, amount: e.target.value})} />
              </div>
              <div>
                <Label>Tipo</Label>
                <Select value={form.type} onValueChange={(value: "income" | "expense") => setForm({...form, type: value, category_id: ""})}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="income">Receita</SelectItem>
                    <SelectItem value="expense">Despesa</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Categoria</Label>
                <Select value={form.category_id} onValueChange={(value) => setForm({...form, category_id: value})}>
                  <SelectTrigger><SelectValue placeholder="Selecione uma categoria" /></SelectTrigger>
                  <SelectContent>
                    {categories?.filter(c => c.type === form.type).map((cat) => (
                      <SelectItem key={cat.id} value={cat.id}>{cat.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Frequência</Label>
                <Select value={form.frequency} onValueChange={(value) => setForm({...form, frequency: value})}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="monthly">Mensal</SelectItem>
                    <SelectItem value="daily">Diária</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {form.frequency === "monthly" && (
                <div>
                  <Label>Dia do Mês</Label>
                  <Input type="number" min="1" max="31" value={form.day_of_month} onChange={(e) => setForm({...form, day_of_month: e.target.value})} />
                  <p className="text-[11px] text-muted-foreground mt-1">Em meses curtos, será aplicado no último dia disponível.</p>
                </div>
              )}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Data de início</Label>
                  <Input type="date" value={form.start_date} onChange={(e) => setForm({...form, start_date: e.target.value})} required />
                  <p className="text-[11px] text-muted-foreground mt-1">A partir desta data passa a gerar.</p>
                </div>
                <div>
                  <Label>Data final (opcional)</Label>
                  <Input type="date" value={form.end_date} onChange={(e) => setForm({...form, end_date: e.target.value})} />
                  <p className="text-[11px] text-muted-foreground mt-1">Deixe em branco para não ter fim.</p>
                </div>
              </div>
              <Button type="submit" className="w-full">{editingId ? 'Salvar alterações' : 'Criar'}</Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-12">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
        </div>
      ) : recurring?.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-8 sm:py-12">
            <Repeat className="h-10 w-10 sm:h-12 sm:w-12 text-muted-foreground mb-3 sm:mb-4" />
            <p className="text-muted-foreground text-center text-sm sm:text-base px-4">
              Nenhuma transação recorrente configurada.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-3 sm:gap-4">
          {recurring?.map((rec) => (
            <Card key={rec.id} className={!rec.active ? 'opacity-60' : ''}>
              <CardHeader className="pb-3 sm:pb-4">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <CardTitle className="text-base sm:text-lg flex items-center gap-2">
                      {rec.categories && (
                        <div className="h-3 w-3 rounded-full flex-shrink-0" style={{ backgroundColor: rec.categories.color }} />
                      )}
                      <span className="truncate">{rec.description}</span>
                    </CardTitle>
                    <p className="text-xs sm:text-sm text-muted-foreground mt-1">
                      {rec.categories?.name || 'Sem categoria'}
                    </p>
                  </div>
                  <div className="flex items-center gap-1 flex-shrink-0">
                    <Switch checked={rec.active} onCheckedChange={(checked) => toggleActiveMutation.mutate({ id: rec.id, active: checked })} />
                    <Button variant="ghost" size="icon" className="h-9 w-9" onClick={() => handleEdit(rec)}>
                      <Edit className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-9 w-9 text-destructive hover:text-destructive" onClick={() => setDeleteId(rec.id)}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-3 gap-2 sm:gap-4 text-xs sm:text-sm">
                  <div className="bg-muted/50 rounded-lg p-2 sm:p-3">
                    <p className="text-muted-foreground mb-1 text-xs">Valor</p>
                    <p className={`font-semibold text-xs sm:text-sm ${rec.type === 'income' ? 'text-success' : 'text-destructive'}`}>
                      {rec.type === 'income' ? '+' : '-'} R$ {Number(rec.amount).toFixed(2)}
                    </p>
                  </div>
                  <div className="bg-muted/50 rounded-lg p-2 sm:p-3">
                    <p className="text-muted-foreground mb-1 flex items-center gap-1 text-xs">
                      <Calendar className="h-3 w-3" />
                      {rec.frequency === 'monthly' ? 'Dia' : 'Freq.'}
                    </p>
                    <p className="font-semibold text-xs sm:text-sm">
                      {rec.frequency === 'monthly' ? `Dia ${rec.day_of_month}` : 'Diária'}
                    </p>
                  </div>
                  <div className="bg-muted/50 rounded-lg p-2 sm:p-3">
                    <p className="text-muted-foreground mb-1 text-xs">Status</p>
                    <p className={`font-semibold text-xs sm:text-sm ${rec.active ? 'text-success' : 'text-muted-foreground'}`}>
                      {rec.active ? 'Ativo' : 'Inativo'}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
      <ConfirmDialog
        open={!!deleteId}
        onOpenChange={(open) => { if (!open) setDeleteId(null); }}
        onConfirm={() => { if (deleteId) { deleteMutation.mutate(deleteId); setDeleteId(null); } }}
        title="Excluir transação recorrente?"
        description="Esta transação recorrente será removida permanentemente."
      />
    </div>
  );
}
