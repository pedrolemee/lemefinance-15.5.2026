import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Banknote } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Skeleton } from "@/components/ui/skeleton";
import { getBankLogo } from "@/lib/constants";

interface BankSelectionDialogProps {
  open: boolean;
  onSelect: (bankId: string | null) => void;
  onCancel: () => void;
}

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

export default function BankSelectionDialog({ open, onSelect, onCancel }: BankSelectionDialogProps) {
  const { user } = useAuth();
  
  // Fetch user's banks only
  const { data: userBanks = [], isLoading } = useQuery({
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
    enabled: !!user && open,
  });

  // Filter out any undefined banks to prevent runtime errors
  const banks = userBanks.map(ub => ub.banks).filter((bank): bank is Bank => bank != null);

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onCancel()}>
      <DialogContent className="sm:max-w-[425px] max-h-[85vh] overflow-hidden">
        <DialogHeader>
          <DialogTitle>Qual banco foi utilizado?</DialogTitle>
        </DialogHeader>
        <div className="grid gap-2 py-4 overflow-y-auto max-h-[60vh] pr-2">
          {isLoading ? (
            <>
              {[...Array(5)].map((_, i) => (
                <Skeleton key={i} className="h-14 w-full" />
              ))}
            </>
          ) : (
            <>
              <Button
                variant="outline"
                className="justify-start h-auto py-3 px-4 hover:bg-muted/50 hover:border-muted-foreground/30 transition-all"
                onClick={() => onSelect(null)}
              >
                <Banknote className="mr-3 h-5 w-5 text-muted-foreground" />
                <span className="text-base text-muted-foreground">Não informar</span>
              </Button>
              
              {banks.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">
                  Você ainda não adicionou nenhum banco. Vá em "Bancos" para adicionar.
                </p>
              ) : (
                banks.map((bank) => {
                  const logoUrl = getBankLogo(bank.name);
                  return (
                    <Button
                      key={bank.id}
                      variant="outline"
                      className="justify-start h-auto py-3 px-4 hover:bg-primary/10 hover:border-primary transition-all group"
                      onClick={() => onSelect(bank.id)}
                    >
                      {logoUrl ? (
                        <img
                          src={logoUrl}
                          alt={bank.name}
                          className="mr-3 h-8 w-8 object-contain rounded"
                          onError={(e) => {
                            e.currentTarget.style.display = 'none';
                          }}
                        />
                      ) : (
                        <div 
                          className="mr-3 h-8 w-8 rounded-full flex items-center justify-center text-white font-bold text-sm"
                          style={{ backgroundColor: bank.color }}
                        >
                          {bank.name.charAt(0)}
                        </div>
                      )}
                      <span className="text-base font-medium">{bank.name}</span>
                    </Button>
                  );
                })
              )}
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
