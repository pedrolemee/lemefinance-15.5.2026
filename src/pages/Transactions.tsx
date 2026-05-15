import { useState, useCallback, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Trash2, Edit, Plus, ArrowUpRight, ArrowDownRight, List, Search, X, ChevronDown, Layers } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { z } from "zod";
import { formatDateBR, getTodayLocalISO } from "@/lib/dateUtils";
import { formatCurrency } from "@/lib/formatters";
import { getPaymentMethodLabel, PAYMENT_METHODS } from "@/lib/constants";
import { ConfirmDialog } from "@/components/ConfirmDialog";

const transactionSchema = z.object({
  type: z.enum(["income", "expense"]),
  amount: z.number().positive("Valor deve ser positivo"),
  description: z.string().min(1, "Descrição é obrigatória").max(200, "Máximo 200 caracteres"),
  date: z.string(),
  category_id: z.string().optional(),
  bank_id: z.string().optional(),
  installments: z.number().min(1).max(60).optional(),
  payment_method: z.string().optional(),
});

export default function Transactions() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingGroup, setEditingGroup] = useState<{ ids: string[]; installments: number } | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [deleteGroupIds, setDeleteGroupIds] = useState<string[] | null>(null);
  const [formData, setFormData] = useState({
    type: "expense" as "income" | "expense",
    amount: "",
    description: "",
    date: getTodayLocalISO(),
    category_id: "",
    bank_id: "",
    installments: "",
    payment_method: "",
  });

  // Filters
  const [searchText, setSearchText] = useState("");
  const [filterType, setFilterType] = useState<string>("all");
  const [filterCategory, setFilterCategory] = useState<string>("all");
  const [filterBank, setFilterBank] = useState<string>("all");
  const [filterMonth, setFilterMonth] = useState<string>("all");

  const { data: transactions = [], isLoading } = useQuery({
    queryKey: ["transactions", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("transactions")
        .select("*, categories(name, color), banks(name)")
        .eq("user_id", user!.id)
        .order("date", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });

  const { data: categories = [] } = useQuery({
    queryKey: ["categories", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase.from("categories").select("*").eq("user_id", user!.id);
      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });

  const { data: banks = [] } = useQuery({
    queryKey: ["user-banks", user?.id],
    queryFn: async () => {
      if (!user) return [];
      const { data, error } = await supabase.from("user_banks").select("id, bank_id, banks(*)").eq("user_id", user.id);
      if (error) throw error;
      return data.map((ub: any) => ub.banks);
    },
    enabled: !!user,
  });

  const invalidateAll = () => {
    queryClient.invalidateQueries({ queryKey: ["transactions"] });
    queryClient.invalidateQueries({ queryKey: ["transactions-balance"] });
    queryClient.invalidateQueries({ queryKey: ["forecast-data"] });
    queryClient.invalidateQueries({ queryKey: ["transactions-by-bank"] });
  };

  // Generate month options from transactions
  const monthOptions = useMemo(() => {
    const months = new Set<string>();
    transactions.forEach((t: any) => {
      months.add(t.date.slice(0, 7));
    });
    return Array.from(months).sort().reverse().map(m => {
      const [y, mo] = m.split('-');
      const date = new Date(parseInt(y), parseInt(mo) - 1);
      return { value: m, label: date.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' }) };
    });
  }, [transactions]);

  // Filtered transactions
  const filteredTransactions = useMemo(() => {
    return transactions.filter((t: any) => {
      if (searchText && !t.description.toLowerCase().includes(searchText.toLowerCase())) return false;
      if (filterType !== "all" && t.type !== filterType) return false;
      if (filterCategory !== "all" && t.category_id !== filterCategory) return false;
      if (filterBank !== "all" && t.bank_id !== filterBank) return false;
      if (filterMonth !== "all") {
        if (t.date.slice(0, 7) !== filterMonth) return false;
      }
      return true;
    });
  }, [transactions, searchText, filterType, filterCategory, filterBank, filterMonth]);

  const hasFilters = searchText || filterType !== "all" || filterCategory !== "all" || filterBank !== "all" || filterMonth !== "all";

  const clearFilters = () => {
    setSearchText("");
    setFilterType("all");
    setFilterCategory("all");
    setFilterBank("all");
    setFilterMonth("all");
  };

  // Group installments together: by parent_transaction_id when present,
  // otherwise heuristic by description-without-suffix + installments + payment_method + bank_id
  type GroupItem = { kind: 'single'; tx: any } | { kind: 'group'; key: string; items: any[]; total: number; sortDate: string };
  const groupedItems: GroupItem[] = useMemo(() => {
    const stripSuffix = (s: string) => s.replace(/\s*\(\d+\/\d+\)\s*$/, '').trim();
    const buckets = new Map<string, any[]>();
    const singles: any[] = [];
    filteredTransactions.forEach((t: any) => {
      if (!t.installments || t.installments <= 1) { singles.push(t); return; }
      const key = t.parent_transaction_id
        ? `p:${t.parent_transaction_id}`
        : `h:${stripSuffix(t.description)}|${t.installments}|${t.payment_method || ''}|${t.bank_id || ''}|${t.type}`;
      if (!buckets.has(key)) buckets.set(key, []);
      buckets.get(key)!.push(t);
    });
    const groups: GroupItem[] = [];
    buckets.forEach((items, key) => {
      if (items.length === 1) {
        singles.push(items[0]);
        return;
      }
      items.sort((a, b) => (a.installment_number || 0) - (b.installment_number || 0));
      const total = items.reduce((s, it) => s + Number(it.amount), 0);
      const sortDate = items[items.length - 1].date;
      groups.push({ kind: 'group', key, items, total, sortDate });
    });
    const allItems: GroupItem[] = [
      ...singles.map((tx) => ({ kind: 'single' as const, tx })),
      ...groups,
    ];
    allItems.sort((a, b) => {
      const da = a.kind === 'single' ? a.tx.date : a.sortDate;
      const db = b.kind === 'single' ? b.tx.date : b.sortDate;
      return db.localeCompare(da);
    });
    return allItems;
  }, [filteredTransactions]);

  const createMutation = useMutation({
    mutationFn: async (data: any) => {
      const installments = data.installments || 1;
      if (data.amount <= 0) throw new Error('Valor deve ser maior que zero');
      if (installments > 1) {
        if (installments > 60) throw new Error('Número máximo de parcelas é 60');
        const txs = [];
        const [year, month, day] = data.date.split('-').map(Number);
        const totalCents = Math.round(data.amount * 100);
        const baseCents = Math.floor(totalCents / installments);
        const remainder = totalCents - baseCents * installments;
        const parentId = (typeof crypto !== 'undefined' && 'randomUUID' in crypto)
          ? (crypto as any).randomUUID() : undefined;
        for (let i = 0; i < installments; i++) {
          let newMonth = month - 1 + i;
          const newYear = year + Math.floor(newMonth / 12);
          newMonth = ((newMonth % 12) + 12) % 12;
          const daysInMonth = new Date(newYear, newMonth + 1, 0).getDate();
          const newDay = Math.min(day, daysInMonth);
          const cents = baseCents + (i === installments - 1 ? remainder : 0);
          txs.push({
            user_id: user!.id, type: data.type, amount: cents / 100,
            description: data.description,
            date: `${newYear}-${String(newMonth + 1).padStart(2, '0')}-${String(newDay).padStart(2, '0')}`,
            category_id: data.category_id || null, bank_id: data.bank_id || null,
            payment_method: data.payment_method || null, installments, installment_number: i + 1,
            parent_transaction_id: parentId || null,
          });
        }
        const { error } = await supabase.from("transactions").insert(txs);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("transactions").insert([{
          ...data, user_id: user!.id, category_id: data.category_id || null,
          bank_id: data.bank_id || null, payment_method: data.payment_method || null,
        }]);
        if (error) throw error;
      }
    },
    onSuccess: () => { invalidateAll(); toast({ title: "Transação criada!" }); setIsDialogOpen(false); resetForm(); },
    onError: (error: Error) => { toast({ title: "Erro", description: error.message, variant: "destructive" }); },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: any }) => {
      if (data.amount <= 0) throw new Error('Valor deve ser maior que zero');
      const { error } = await supabase.from("transactions").update({
        ...data, category_id: data.category_id || null, bank_id: data.bank_id || null, payment_method: data.payment_method || null,
      }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { invalidateAll(); toast({ title: "Transação atualizada!" }); setIsDialogOpen(false); resetForm(); },
    onError: (error: Error) => { toast({ title: "Erro", description: error.message, variant: "destructive" }); },
  });

  const updateGroupMutation = useMutation({
    mutationFn: async ({ ids, data, totalAmount, installments }: { ids: string[]; data: any; totalAmount: number; installments: number }) => {
      if (totalAmount <= 0) throw new Error('Valor total deve ser maior que zero');
      // Distribute total amount across installments evenly with last receiving remainder
      const totalCents = Math.round(totalAmount * 100);
      const baseCents = Math.floor(totalCents / installments);
      const remainder = totalCents - baseCents * installments;
      // Update each installment with shared fields + per-installment amount
      for (let i = 0; i < ids.length; i++) {
        const cents = baseCents + (i === ids.length - 1 ? remainder : 0);
        const { error } = await supabase.from("transactions").update({
          description: data.description,
          category_id: data.category_id || null,
          bank_id: data.bank_id || null,
          payment_method: data.payment_method || null,
          type: data.type,
          amount: cents / 100,
        }).eq("id", ids[i]);
        if (error) throw error;
      }
    },
    onSuccess: () => { invalidateAll(); toast({ title: "Parcelamento atualizado!" }); setIsDialogOpen(false); setEditingGroup(null); resetForm(); },
    onError: (error: Error) => { toast({ title: "Erro", description: error.message, variant: "destructive" }); },
  });

  const deleteGroupMutation = useMutation({
    mutationFn: async (ids: string[]) => {
      const { error } = await supabase.from("transactions").delete().in("id", ids);
      if (error) throw error;
    },
    onSuccess: () => { invalidateAll(); toast({ title: "Parcelamento excluído!" }); },
    onError: (error: Error) => { toast({ title: "Erro", description: error.message, variant: "destructive" }); },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("transactions").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { invalidateAll(); toast({ title: "Transação excluída!" }); },
    onError: (error: Error) => { toast({ title: "Erro", description: error.message, variant: "destructive" }); },
  });

  const resetForm = useCallback(() => {
    setFormData({ type: "expense", amount: "", description: "", date: getTodayLocalISO(), category_id: "", bank_id: "", installments: "", payment_method: "" });
    setEditingId(null);
    setEditingGroup(null);
  }, []);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const validData = transactionSchema.parse({ ...formData, amount: parseFloat(formData.amount), installments: formData.installments ? parseInt(formData.installments) : 1 });
      const normalizedData = {
        ...validData,
        bank_id: validData.bank_id && validData.bank_id !== "none" && validData.bank_id !== "" ? validData.bank_id : null,
        category_id: validData.category_id && validData.category_id !== "" ? validData.category_id : null,
        payment_method: validData.payment_method && validData.payment_method !== "" ? validData.payment_method : null,
      };
      if (editingGroup) {
        updateGroupMutation.mutate({
          ids: editingGroup.ids,
          data: normalizedData,
          totalAmount: parseFloat(formData.amount),
          installments: editingGroup.installments,
        });
      } else if (editingId) { updateMutation.mutate({ id: editingId, data: normalizedData }); }
      else { createMutation.mutate(normalizedData); }
    } catch (err) {
      if (err instanceof z.ZodError) { toast({ title: "Erro de validação", description: err.errors[0].message, variant: "destructive" }); }
    }
  };

  const handleEdit = useCallback((transaction: any) => {
    setEditingId(transaction.id);
    setEditingGroup(null);
    setFormData({ type: transaction.type, amount: transaction.amount.toString(), description: transaction.description, date: transaction.date, category_id: transaction.category_id || "", bank_id: transaction.bank_id || "", installments: transaction.installments?.toString() || "", payment_method: transaction.payment_method || "" });
    setIsDialogOpen(true);
  }, []);

  const handleEditGroup = useCallback((items: any[], total: number) => {
    const first = items[0];
    const baseDesc = first.description.replace(/\s*\(\d+\/\d+\)\s*$/, '');
    setEditingId(null);
    setEditingGroup({ ids: items.map(i => i.id), installments: items.length });
    setFormData({
      type: first.type,
      amount: total.toFixed(2),
      description: baseDesc,
      date: first.date,
      category_id: first.category_id || "",
      bank_id: first.bank_id || "",
      installments: String(items.length),
      payment_method: first.payment_method || "",
    });
    setIsDialogOpen(true);
  }, []);

  return (
    <div className="container mx-auto p-3 sm:p-4 md:p-6 space-y-4 sm:space-y-6 max-w-7xl">
      <Card className="shadow-sm">
        <CardHeader className="flex flex-col gap-4 pb-4">
          <div className="flex flex-row items-center justify-between">
            <CardTitle className="text-xl sm:text-2xl">Transações</CardTitle>
            <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
              <DialogTrigger asChild>
                <Button onClick={resetForm} size="sm">
                  <Plus className="h-4 w-4 sm:mr-2" />
                  <span className="hidden sm:inline">Nova Transação</span>
                  <span className="sm:hidden">Nova</span>
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>{editingGroup ? `Editar Parcelamento (${editingGroup.installments}x)` : editingId ? "Editar Transação" : "Nova Transação"}</DialogTitle>
                  {editingGroup && (
                    <p className="text-xs text-muted-foreground">As alterações serão aplicadas a todas as parcelas. O valor informado é o total e será dividido entre as parcelas.</p>
                  )}
                </DialogHeader>
                <form onSubmit={handleSubmit} className="space-y-4">
                  <div className="space-y-2">
                    <Label>Tipo</Label>
                    <Select value={formData.type} onValueChange={(value: any) => setFormData({ ...formData, type: value })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="income">Receita</SelectItem>
                        <SelectItem value="expense">Despesa</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Valor</Label>
                    <Input type="number" step="0.01" value={formData.amount} onChange={(e) => setFormData({ ...formData, amount: e.target.value })} required />
                  </div>
                  <div className="space-y-2">
                    <Label>Descrição</Label>
                    <Input value={formData.description} onChange={(e) => setFormData({ ...formData, description: e.target.value })} required />
                  </div>
                  <div className="space-y-2">
                    <Label>Data</Label>
                    <Input type="date" value={formData.date} onChange={(e) => setFormData({ ...formData, date: e.target.value })} required />
                  </div>
                  <div className="space-y-2">
                    <Label>Categoria</Label>
                    <Select value={formData.category_id} onValueChange={(value) => setFormData({ ...formData, category_id: value })}>
                      <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
                      <SelectContent>
                        {categories.filter(c => c.type === formData.type).map((cat) => (
                          <SelectItem key={cat.id} value={cat.id}>{cat.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Banco</Label>
                    <Select value={formData.bank_id || "none"} onValueChange={(value) => setFormData({ ...formData, bank_id: value === "none" ? "" : value })}>
                      <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">Não informar</SelectItem>
                        {banks.map((bank) => (<SelectItem key={bank.id} value={bank.id}>{bank.name}</SelectItem>))}
                      </SelectContent>
                    </Select>
                  </div>
                  {formData.type === "expense" && (
                    <div className="space-y-2">
                      <Label>Forma de Pagamento</Label>
                      <Select value={formData.payment_method} onValueChange={(value) => setFormData({ ...formData, payment_method: value })}>
                        <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
                        <SelectContent>
                          {Object.entries(PAYMENT_METHODS).map(([value, label]) => (
                            <SelectItem key={value} value={value}>{label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  )}
                  {!editingId && formData.type === "expense" && (
                    <div className="space-y-2">
                      <Label>Parcelas</Label>
                      <Input type="number" min="1" max="60" placeholder="1" value={formData.installments} onChange={(e) => setFormData({ ...formData, installments: e.target.value })} />
                      <p className="text-xs text-muted-foreground">Máximo 60 parcelas.</p>
                    </div>
                  )}
                  <Button type="submit" className="w-full">{editingId ? "Atualizar" : "Criar"}</Button>
                </form>
              </DialogContent>
            </Dialog>
          </div>

          {/* Filters */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-2">
            <div className="relative">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input placeholder="Buscar..." value={searchText} onChange={(e) => setSearchText(e.target.value)} className="pl-9" />
            </div>
            <Select value={filterType} onValueChange={setFilterType}>
              <SelectTrigger><SelectValue placeholder="Tipo" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os tipos</SelectItem>
                <SelectItem value="income">Receitas</SelectItem>
                <SelectItem value="expense">Despesas</SelectItem>
              </SelectContent>
            </Select>
            <Select value={filterCategory} onValueChange={setFilterCategory}>
              <SelectTrigger><SelectValue placeholder="Categoria" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas categorias</SelectItem>
                {categories.map(c => (<SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>))}
              </SelectContent>
            </Select>
            <Select value={filterBank} onValueChange={setFilterBank}>
              <SelectTrigger><SelectValue placeholder="Banco" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos bancos</SelectItem>
                {banks.map(b => (<SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>))}
              </SelectContent>
            </Select>
            <Select value={filterMonth} onValueChange={setFilterMonth}>
              <SelectTrigger><SelectValue placeholder="Mês" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os meses</SelectItem>
                {monthOptions.map(m => (<SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>))}
              </SelectContent>
            </Select>
          </div>
          {hasFilters && (
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">{filteredTransactions.length} resultado(s)</span>
              <Button variant="ghost" size="sm" onClick={clearFilters} className="h-7 text-xs">
                <X className="h-3 w-3 mr-1" /> Limpar filtros
              </Button>
            </div>
          )}
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-2">
              {[...Array(5)].map((_, i) => (
                <div key={i} className="flex items-center justify-between rounded-lg border p-3 gap-3">
                  <div className="flex items-center gap-3 flex-1">
                    <Skeleton className="h-10 w-10 rounded-full" />
                    <div className="space-y-2 flex-1"><Skeleton className="h-4 w-32" /><Skeleton className="h-3 w-24" /></div>
                  </div>
                  <Skeleton className="h-6 w-20" />
                </div>
              ))}
            </div>
          ) : filteredTransactions.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
              <div className="h-16 w-16 rounded-full bg-muted flex items-center justify-center mb-4">
                <List className="h-8 w-8 text-muted-foreground" />
              </div>
              <h3 className="text-lg font-semibold mb-1">{hasFilters ? "Nenhum resultado" : "Nenhuma transação"}</h3>
              <p className="text-sm text-muted-foreground mb-4">
                {hasFilters ? "Tente ajustar os filtros" : "Comece adicionando sua primeira transação"}
              </p>
              {!hasFilters && (
                <Button onClick={() => { resetForm(); setIsDialogOpen(true); }} size="sm">
                  <Plus className="h-4 w-4 mr-2" /> Nova Transação
                </Button>
              )}
            </div>
          ) : (
            <div className="space-y-2">
              {groupedItems.map((item) => {
                if (item.kind === 'single') {
                  const transaction = item.tx;
                  return (
                    <div key={transaction.id} className="flex flex-col sm:flex-row items-start sm:items-center justify-between rounded-lg border p-3 hover:bg-muted/50 transition-colors gap-3">
                      <div className="flex items-center gap-3 w-full sm:w-auto min-w-0">
                        <div className={`flex h-10 w-10 items-center justify-center rounded-full shrink-0 ${transaction.type === "income" ? "bg-success/10" : "bg-destructive/10"}`}>
                          {transaction.type === "income" ? <ArrowUpRight className="h-5 w-5 text-success" /> : <ArrowDownRight className="h-5 w-5 text-destructive" />}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-medium truncate">{transaction.description}</p>
                          <div className="flex items-center gap-2 flex-wrap">
                            <p className="text-sm text-muted-foreground">{formatDateBR(transaction.date)}</p>
                            {transaction.categories && <Badge variant="secondary" style={{ backgroundColor: transaction.categories.color + "20" }} className="text-xs">{transaction.categories.name}</Badge>}
                            {transaction.payment_method && <Badge variant="outline" className="text-xs">{getPaymentMethodLabel(transaction.payment_method)}</Badge>}
                            {transaction.banks && <Badge variant="outline" className="text-xs">{transaction.banks.name}</Badge>}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 w-full sm:w-auto justify-between sm:justify-end">
                        <p className={`text-base sm:text-lg font-semibold ${transaction.type === "income" ? "text-success" : "text-destructive"}`}>
                          {transaction.type === "income" ? "+" : "-"}R$ {formatCurrency(Number(transaction.amount))}
                        </p>
                        <div className="flex gap-1">
                          <Button variant="ghost" size="icon" className="h-9 w-9" onClick={() => handleEdit(transaction)}><Edit className="h-4 w-4" /></Button>
                          <Button variant="ghost" size="icon" className="h-9 w-9" onClick={() => setDeleteId(transaction.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                        </div>
                      </div>
                    </div>
                  );
                }
                // Group of installments
                const first = item.items[0];
                const today = getTodayLocalISO();
                const remaining = item.items.filter((i) => i.date > today).length;
                const baseDesc = first.description.replace(/\s*\(\d+\/\d+\)\s*$/, '');
                return (
                  <Collapsible key={item.key} className="rounded-lg border hover:bg-muted/30 transition-colors">
                    <CollapsibleTrigger className="w-full text-left">
                      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between p-3 gap-3">
                        <div className="flex items-center gap-3 w-full sm:w-auto min-w-0">
                          <div className={`flex h-10 w-10 items-center justify-center rounded-full shrink-0 ${first.type === "income" ? "bg-success/10" : "bg-destructive/10"}`}>
                            <Layers className={`h-5 w-5 ${first.type === "income" ? "text-success" : "text-destructive"}`} />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="font-medium truncate">{baseDesc}</p>
                            <div className="flex items-center gap-2 flex-wrap">
                              <Badge variant="secondary" className="text-xs">{first.installments}x parcelas</Badge>
                              {remaining > 0 && <Badge variant="outline" className="text-xs">{remaining} restante{remaining > 1 ? 's' : ''}</Badge>}
                              {first.categories && <Badge variant="secondary" style={{ backgroundColor: first.categories.color + "20" }} className="text-xs">{first.categories.name}</Badge>}
                              {first.payment_method && <Badge variant="outline" className="text-xs">{getPaymentMethodLabel(first.payment_method)}</Badge>}
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-2 w-full sm:w-auto justify-between sm:justify-end">
                          <div className="text-right">
                            <p className={`text-base sm:text-lg font-semibold ${first.type === "income" ? "text-success" : "text-destructive"}`}>
                              {first.type === "income" ? "+" : "-"}R$ {formatCurrency(item.total)}
                            </p>
                            <p className="text-[10px] text-muted-foreground">total</p>
                          </div>
                          <div className="flex gap-1" onClick={(e) => e.stopPropagation()}>
                            <Button variant="ghost" size="icon" className="h-9 w-9" onClick={(e) => { e.stopPropagation(); handleEditGroup(item.items, item.total); }}>
                              <Edit className="h-4 w-4" />
                            </Button>
                            <Button variant="ghost" size="icon" className="h-9 w-9" onClick={(e) => { e.stopPropagation(); setDeleteGroupIds(item.items.map((i: any) => i.id)); }}>
                              <Trash2 className="h-4 w-4 text-destructive" />
                            </Button>
                          </div>
                          <ChevronDown className="h-5 w-5 text-muted-foreground transition-transform data-[state=open]:rotate-180" />
                        </div>
                      </div>
                    </CollapsibleTrigger>
                    <CollapsibleContent>
                      <div className="border-t bg-muted/20 divide-y">
                        {item.items.map((tx: any) => {
                          const paid = tx.date <= today;
                          return (
                            <div key={tx.id} className="flex items-center justify-between p-2.5 pl-4 sm:pl-14 gap-2">
                              <div className="flex items-center gap-2 min-w-0 flex-1">
                                <Badge variant={paid ? "secondary" : "outline"} className="text-[10px] shrink-0">
                                  {tx.installment_number}/{tx.installments}
                                </Badge>
                                <span className="text-xs text-muted-foreground">{formatDateBR(tx.date)}</span>
                                <span className={`text-[10px] px-1.5 rounded ${paid ? 'bg-success/10 text-success' : 'bg-warning/10 text-warning'}`}>
                                  {paid ? 'paga' : 'futura'}
                                </span>
                              </div>
                              <div className="flex items-center gap-1">
                                <span className={`text-sm font-medium ${first.type === "income" ? "text-success" : "text-destructive"}`}>
                                  R$ {formatCurrency(Number(tx.amount))}
                                </span>
                                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleEdit(tx)}><Edit className="h-3.5 w-3.5" /></Button>
                                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setDeleteId(tx.id)}><Trash2 className="h-3.5 w-3.5 text-destructive" /></Button>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </CollapsibleContent>
                  </Collapsible>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
      <ConfirmDialog
        open={!!deleteId}
        onOpenChange={(open) => { if (!open) setDeleteId(null); }}
        onConfirm={() => { if (deleteId) { deleteMutation.mutate(deleteId); setDeleteId(null); } }}
        title="Excluir transação?"
        description="Esta transação será removida permanentemente."
      />
      <ConfirmDialog
        open={!!deleteGroupIds}
        onOpenChange={(open) => { if (!open) setDeleteGroupIds(null); }}
        onConfirm={() => { if (deleteGroupIds) { deleteGroupMutation.mutate(deleteGroupIds); setDeleteGroupIds(null); } }}
        title="Excluir todas as parcelas?"
        description="Todas as parcelas deste parcelamento serão removidas permanentemente."
      />
    </div>
  );
}
