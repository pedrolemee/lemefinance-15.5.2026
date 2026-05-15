import { useCallback, useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Plus, Trash2 } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { formatDateBR, getTodayLocalISO } from "@/lib/dateUtils";
import { getBankLogo } from "@/lib/constants";
import AddBankDialog from "@/components/AddBankDialog";
import { toast } from "sonner";

interface Bank {
  id: string;
  name: string;
  color: string;
  icon: string;
}

interface UserBank {
  id: string;
  bank_id: string;
  banks: Bank;
}

interface Transaction {
  id: string;
  description: string;
  amount: number;
  date: string;
  type: "income" | "expense";
  bank_id: string | null;
  categories: { name: string; icon: string; color: string } | null;
}

export default function Banks() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [showAddDialog, setShowAddDialog] = useState(false);
  
  // Fetch user's banks
  const { data: userBanks = [], isLoading: userBanksLoading } = useQuery({
    queryKey: ["user-banks", user?.id],
    queryFn: async () => {
      if (!user) return [];
      const { data, error } = await supabase
        .from("user_banks")
        .select("id, bank_id, banks(*)")
        .eq("user_id", user.id);
      
      if (error) throw error;
      return data as UserBank[];
    },
    enabled: !!user,
  });

  const { data: transactions, isLoading: transactionsLoading } = useQuery({
    queryKey: ["transactions-by-bank", user?.id],
    queryFn: async () => {
      if (!user) return [];
      
      const { data, error } = await supabase
        .from("transactions")
        .select("*, categories(name, icon, color)")
        .eq("user_id", user.id)
        .order("date", { ascending: false });
      
      if (error) throw error;
      return data as Transaction[];
    },
    enabled: !!user,
  });

  const removeBankMutation = useMutation({
    mutationFn: async (userBankId: string) => {
      const { error } = await supabase
        .from("user_banks")
        .delete()
        .eq("id", userBankId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["user-banks"] });
      toast.success("Banco removido!");
    },
    onError: () => {
      toast.error("Erro ao remover banco");
    },
  });

  const banks = useMemo(() => userBanks.map(ub => ub.banks).filter((b): b is Bank => !!b && !!b.id), [userBanks]);
  const userBankIds = useMemo(() => userBanks.filter(ub => !!ub.bank_id).map(ub => ub.bank_id), [userBanks]);

  const transactionsByBank = useMemo(() => 
    transactions?.reduce((acc, transaction) => {
      const bankId = transaction.bank_id || "no-bank";
      if (!acc[bankId]) {
        acc[bankId] = [];
      }
      acc[bankId].push(transaction);
      return acc;
    }, {} as Record<string, Transaction[]>)
  , [transactions]);

  // Saldo do banco considera apenas transações já realizadas (até hoje),
  // ignorando parcelas/agendados futuros — alinhado ao saldo do Dashboard.
  const todayStr = getTodayLocalISO();
  const calculateBankTotal = useCallback((bankTransactions: Transaction[]) => {
    return bankTransactions.reduce((sum, t) => {
      if (t.date > todayStr) return sum;
      return t.type === "income" ? sum + Number(t.amount) : sum - Number(t.amount);
    }, 0);
  }, [todayStr]);

  if (userBanksLoading || transactionsLoading) {
    return (
      <div className="container mx-auto px-3 sm:px-4 py-4 sm:py-8 max-w-7xl">
          <div className="space-y-4">
            <Skeleton className="h-10 w-48" />
            <Skeleton className="h-[400px] w-full" />
          </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-3 sm:px-4 py-4 sm:py-8 max-w-7xl">
      
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl sm:text-3xl font-bold text-foreground">Meus Bancos</h1>
          <Button onClick={() => setShowAddDialog(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Adicionar Banco
          </Button>
        </div>

        {banks.length === 0 ? (
          <Card className="animate-fade-in-up">
            <CardContent className="flex flex-col items-center justify-center py-12">
              <p className="text-muted-foreground text-center mb-4">
                Você ainda não adicionou nenhum banco.
              </p>
              <Button onClick={() => setShowAddDialog(true)}>
                <Plus className="h-4 w-4 mr-2" />
                Adicionar Meu Primeiro Banco
              </Button>
            </CardContent>
          </Card>
        ) : (
          <Tabs defaultValue="all" className="w-full">
            <TabsList className="mb-6 flex-wrap h-auto">
              <TabsTrigger value="all">Todos</TabsTrigger>
              {banks.map((bank) => (
                <TabsTrigger key={bank.id} value={bank.id}>
                  {bank.name}
                </TabsTrigger>
              ))}
              <TabsTrigger value="no-bank">Sem Banco</TabsTrigger>
            </TabsList>

            <TabsContent value="all" className="space-y-4">
              {banks.map((bank) => {
                const bankTransactions = transactionsByBank?.[bank.id] || [];
                const total = calculateBankTotal(bankTransactions);
                const logoUrl = getBankLogo(bank.name);
                const userBank = userBanks.find(ub => ub.bank_id === bank.id);
                
                return (
                  <Card key={bank.id} className="animate-fade-in-up">
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                      <div className="flex items-center gap-3">
                        {logoUrl ? (
                          <img
                            src={logoUrl}
                            alt={bank.name}
                            className="h-10 w-10 object-contain rounded"
                            onError={(e) => {
                              e.currentTarget.style.display = 'none';
                            }}
                          />
                        ) : (
                          <div 
                            className="p-2 rounded-lg"
                            style={{ backgroundColor: `${bank.color}20` }}
                          >
                            <div 
                              className="h-6 w-6 rounded flex items-center justify-center text-white font-bold text-sm"
                              style={{ backgroundColor: bank.color }}
                            >
                              {bank.name.charAt(0)}
                            </div>
                          </div>
                        )}
                        <CardTitle className="text-xl">{bank.name}</CardTitle>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant={total >= 0 ? "default" : "destructive"}>
                          R$ {total.toFixed(2)}
                        </Badge>
                        <Button 
                          variant="ghost" 
                          size="icon"
                          className="h-8 w-8"
                          onClick={() => userBank && removeBankMutation.mutate(userBank.id)}
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                    </CardHeader>
                    <CardContent>
                      {bankTransactions.length === 0 ? (
                        <p className="text-sm text-muted-foreground">Nenhuma transação neste banco</p>
                      ) : (
                        <div className="space-y-2">
                          {bankTransactions.slice(0, 5).map((transaction) => (
                            <div
                              key={transaction.id}
                              className="flex items-center justify-between p-3 rounded-lg bg-muted/50 hover:bg-muted transition-colors"
                            >
                              <div className="flex items-center gap-3">
                                {transaction.categories && (
                                  <div 
                                    className="p-2 rounded-lg"
                                    style={{ backgroundColor: `${transaction.categories.color}20` }}
                                  >
                                    <div 
                                      className="h-4 w-4 rounded-full"
                                      style={{ backgroundColor: transaction.categories.color }}
                                    />
                                  </div>
                                )}
                                <div>
                                  <p className="font-medium">{transaction.description}</p>
                                  <p className="text-xs text-muted-foreground">
                                    {formatDateBR(transaction.date)}
                                    {transaction.categories && ` • ${transaction.categories.name}`}
                                  </p>
                                </div>
                              </div>
                              <span
                                className={`font-semibold ${
                                  transaction.type === "income"
                                    ? "text-success"
                                    : "text-destructive"
                                }`}
                              >
                                {transaction.type === "income" ? "+" : "-"}R${" "}
                                {Number(transaction.amount).toFixed(2)}
                              </span>
                            </div>
                          ))}
                          {bankTransactions.length > 5 && (
                            <p className="text-sm text-muted-foreground text-center pt-2">
                              +{bankTransactions.length - 5} transações
                            </p>
                          )}
                        </div>
                      )}
                    </CardContent>
                  </Card>
                );
              })}
              
              {transactionsByBank?.["no-bank"]?.length > 0 && (
                <Card className="animate-fade-in-up">
                  <CardHeader>
                    <CardTitle className="text-xl">Sem Banco Definido</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      {transactionsByBank["no-bank"].slice(0, 5).map((transaction) => (
                        <div
                          key={transaction.id}
                          className="flex items-center justify-between p-3 rounded-lg bg-muted/50 hover:bg-muted transition-colors"
                        >
                          <div className="flex items-center gap-3">
                            {transaction.categories && (
                              <div 
                                className="p-2 rounded-lg"
                                style={{ backgroundColor: `${transaction.categories.color}20` }}
                              >
                                <div 
                                  className="h-4 w-4 rounded-full"
                                  style={{ backgroundColor: transaction.categories.color }}
                                />
                              </div>
                            )}
                            <div>
                              <p className="font-medium">{transaction.description}</p>
                              <p className="text-xs text-muted-foreground">
                                {formatDateBR(transaction.date)}
                                {transaction.categories && ` • ${transaction.categories.name}`}
                              </p>
                            </div>
                          </div>
                          <span
                            className={`font-semibold ${
                              transaction.type === "income"
                                ? "text-success"
                                : "text-destructive"
                            }`}
                          >
                            {transaction.type === "income" ? "+" : "-"}R${" "}
                            {Number(transaction.amount).toFixed(2)}
                          </span>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}
            </TabsContent>

            {banks.map((bank) => {
              const bankTransactions = transactionsByBank?.[bank.id] || [];
              const total = calculateBankTotal(bankTransactions);
              const logoUrl = getBankLogo(bank.name);
              
              return (
                <TabsContent key={bank.id} value={bank.id}>
                  <Card className="animate-fade-in-up">
                    <CardHeader className="flex flex-row items-center justify-between space-y-0">
                      <div className="flex items-center gap-3">
                        {logoUrl ? (
                          <img
                            src={logoUrl}
                            alt={bank.name}
                            className="h-12 w-12 object-contain rounded"
                            onError={(e) => {
                              e.currentTarget.style.display = 'none';
                            }}
                          />
                        ) : (
                          <div 
                            className="p-3 rounded-lg"
                            style={{ backgroundColor: `${bank.color}20` }}
                          >
                            <div 
                              className="h-8 w-8 rounded flex items-center justify-center text-white font-bold"
                              style={{ backgroundColor: bank.color }}
                            >
                              {bank.name.charAt(0)}
                            </div>
                          </div>
                        )}
                        <div>
                          <CardTitle className="text-2xl">{bank.name}</CardTitle>
                          <p className="text-sm text-muted-foreground">
                            {bankTransactions.length} transações
                          </p>
                        </div>
                      </div>
                      <Badge variant={total >= 0 ? "default" : "destructive"} className="text-lg px-4 py-2">
                        R$ {total.toFixed(2)}
                      </Badge>
                    </CardHeader>
                    <CardContent>
                      {bankTransactions.length === 0 ? (
                        <p className="text-center text-muted-foreground py-8">
                          Nenhuma transação neste banco
                        </p>
                      ) : (
                        <div className="space-y-2">
                          {bankTransactions.map((transaction) => (
                            <div
                              key={transaction.id}
                              className="flex items-center justify-between p-3 rounded-lg bg-muted/50 hover:bg-muted transition-colors"
                            >
                              <div className="flex items-center gap-3">
                                {transaction.categories && (
                                  <div 
                                    className="p-2 rounded-lg"
                                    style={{ backgroundColor: `${transaction.categories.color}20` }}
                                  >
                                    <div 
                                      className="h-4 w-4 rounded-full"
                                      style={{ backgroundColor: transaction.categories.color }}
                                    />
                                  </div>
                                )}
                                <div>
                                  <p className="font-medium">{transaction.description}</p>
                                  <p className="text-xs text-muted-foreground">
                                    {formatDateBR(transaction.date)}
                                    {transaction.categories && ` • ${transaction.categories.name}`}
                                  </p>
                                </div>
                              </div>
                              <span
                                className={`font-semibold ${
                                  transaction.type === "income"
                                    ? "text-success"
                                    : "text-destructive"
                                }`}
                              >
                                {transaction.type === "income" ? "+" : "-"}R${" "}
                                {Number(transaction.amount).toFixed(2)}
                              </span>
                            </div>
                          ))}
                        </div>
                      )}
                    </CardContent>
                  </Card>
                </TabsContent>
              );
            })}

            <TabsContent value="no-bank">
              <Card className="animate-fade-in-up">
                <CardHeader>
                  <CardTitle className="text-2xl">Transações Sem Banco</CardTitle>
                </CardHeader>
                <CardContent>
                  {!transactionsByBank?.["no-bank"] || transactionsByBank["no-bank"].length === 0 ? (
                    <p className="text-center text-muted-foreground py-8">
                      Todas as transações possuem banco definido
                    </p>
                  ) : (
                    <div className="space-y-2">
                      {transactionsByBank["no-bank"].map((transaction) => (
                        <div
                          key={transaction.id}
                          className="flex items-center justify-between p-3 rounded-lg bg-muted/50 hover:bg-muted transition-colors"
                        >
                          <div className="flex items-center gap-3">
                            {transaction.categories && (
                              <div 
                                className="p-2 rounded-lg"
                                style={{ backgroundColor: `${transaction.categories.color}20` }}
                              >
                                <div 
                                  className="h-4 w-4 rounded-full"
                                  style={{ backgroundColor: transaction.categories.color }}
                                />
                              </div>
                            )}
                            <div>
                              <p className="font-medium">{transaction.description}</p>
                              <p className="text-xs text-muted-foreground">
                                {formatDateBR(transaction.date)}
                                {transaction.categories && ` • ${transaction.categories.name}`}
                              </p>
                            </div>
                          </div>
                          <span
                            className={`font-semibold ${
                              transaction.type === "income"
                                ? "text-success"
                                : "text-destructive"
                            }`}
                          >
                            {transaction.type === "income" ? "+" : "-"}R${" "}
                            {Number(transaction.amount).toFixed(2)}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        )}
      
      <AddBankDialog
        open={showAddDialog}
        onClose={() => setShowAddDialog(false)}
        userBankIds={userBankIds}
      />
    </div>
  );
}
