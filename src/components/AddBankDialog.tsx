import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import { Check } from "lucide-react";
import { getBankLogo } from "@/lib/constants";

interface AddBankDialogProps {
  open: boolean;
  onClose: () => void;
  userBankIds: string[];
}

export default function AddBankDialog({ open, onClose, userBankIds }: AddBankDialogProps) {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const { data: banks = [], isLoading } = useQuery({
    queryKey: ["all-banks"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("banks")
        .select("*")
        .order("name");
      if (error) throw error;
      return data;
    },
  });

  const addBankMutation = useMutation({
    mutationFn: async (bankId: string) => {
      const { error } = await supabase
        .from("user_banks")
        .insert({ user_id: user!.id, bank_id: bankId });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["user-banks"] });
      toast.success("Banco adicionado!");
    },
    onError: () => {
      toast.error("Erro ao adicionar banco");
    },
  });

  const removeBankMutation = useMutation({
    mutationFn: async (bankId: string) => {
      const { error } = await supabase
        .from("user_banks")
        .delete()
        .eq("user_id", user!.id)
        .eq("bank_id", bankId);
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

  const handleBankClick = (bankId: string) => {
    if (userBankIds.includes(bankId)) {
      removeBankMutation.mutate(bankId);
    } else {
      addBankMutation.mutate(bankId);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <DialogContent className="sm:max-w-[500px] max-h-[85vh] overflow-hidden">
        <DialogHeader>
          <DialogTitle>Gerenciar Meus Bancos</DialogTitle>
        </DialogHeader>
        <div className="overflow-y-auto max-h-[60vh] pr-2">
          {isLoading ? (
            <div className="space-y-2">
              {[...Array(6)].map((_, i) => (
                <Skeleton key={i} className="h-16 w-full" />
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-2">
              {banks.map((bank) => {
                const isSelected = userBankIds.includes(bank.id);
                const logoUrl = getBankLogo(bank.name);
                
                return (
                  <Button
                    key={bank.id}
                    variant={isSelected ? "default" : "outline"}
                    className={`h-auto py-3 px-3 flex items-center gap-3 justify-start relative ${
                      isSelected ? "ring-2 ring-primary" : ""
                    }`}
                    onClick={() => handleBankClick(bank.id)}
                  >
                    {logoUrl ? (
                      <img
                        src={logoUrl}
                        alt={bank.name}
                        className="h-8 w-8 object-contain rounded"
                        onError={(e) => {
                          e.currentTarget.style.display = 'none';
                        }}
                      />
                    ) : (
                      <div 
                        className="h-8 w-8 rounded flex items-center justify-center text-white font-bold text-sm"
                        style={{ backgroundColor: bank.color }}
                      >
                        {bank.name.charAt(0)}
                      </div>
                    )}
                    <span className="text-sm font-medium truncate flex-1 text-left">
                      {bank.name}
                    </span>
                    {isSelected && (
                      <Check className="h-4 w-4 absolute top-1 right-1" />
                    )}
                  </Button>
                );
              })}
            </div>
          )}
        </div>
        <div className="pt-4 border-t">
          <p className="text-sm text-muted-foreground text-center">
            Clique para adicionar ou remover bancos
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}
