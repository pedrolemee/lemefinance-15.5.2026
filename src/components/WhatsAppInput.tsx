import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Send, Sparkles } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

interface TransactionData {
  amount: number;
  description: string;
  type: 'income' | 'expense';
  date?: string;
  category?: string;
}

interface WhatsAppInputProps {
  onTransactionExtracted?: (data: TransactionData) => void;
}

export function WhatsAppInput({ onTransactionExtracted }: WhatsAppInputProps) {
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();
  const { user } = useAuth();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validar entrada
    const trimmedMessage = message.trim();
    if (!trimmedMessage || !user) return;

    // Validar tamanho máximo (500 caracteres)
    if (trimmedMessage.length > 500) {
      toast({
        title: "Mensagem muito longa",
        description: "Por favor, use no máximo 500 caracteres",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("parse-transaction", {
        body: { message: trimmedMessage },
      });

      if (error) {
        throw error;
      }

      if (data?.success && data?.transaction) {
        // Validar dados da transação antes de processar
        if (typeof data.transaction.amount !== 'number' || data.transaction.amount <= 0) {
          throw new Error('Valor inválido retornado pela IA');
        }

        if (!['income', 'expense'].includes(data.transaction.type)) {
          throw new Error('Tipo de transação inválido');
        }

        setMessage("");
        
        // Chamar callback se fornecido
        if (onTransactionExtracted) {
          const transactionData: TransactionData = {
            amount: data.transaction.amount,
            description: data.transaction.description,
            type: data.transaction.type,
            date: data.transaction.date,
            category: data.transaction.category,
          };
          onTransactionExtracted(transactionData);
        } else {
          // Fallback: mostrar sucesso se não houver callback
          const installmentText = data.transaction.installments > 1 
            ? ` em ${data.transaction.installments}x` 
            : '';
          toast({
            title: "Transação registrada!",
            description: `${data.transaction.type === 'income' ? 'Receita' : 'Despesa'} de R$ ${data.transaction.amount.toFixed(2)}${installmentText}`,
          });
        }
      } else {
        toast({
          title: "Não consegui entender",
          description: "Tente algo como: 'Gastei 50 no mercado' ou 'Recebi 2000 de salário'",
          variant: "destructive",
        });
      }
    } catch (error: any) {
      toast({
        title: "Erro ao processar",
        description: error.message || "Tente novamente mais tarde",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card className="border-0 shadow-elegant bg-gradient-to-br from-card to-card/50 animate-fade-in-up transition-all duration-300 hover:shadow-elegant-lg">
      <CardHeader className="px-4 sm:px-6 pt-4 sm:pt-6">
        <CardTitle className="flex items-center gap-2 text-base sm:text-lg">
          <Sparkles className="h-4 w-4 sm:h-5 sm:w-5 text-primary flex-shrink-0 animate-pulse" />
          Registre sua transação
        </CardTitle>
        <CardDescription className="text-xs sm:text-sm">
          Ex: "Gastei 50 no mercado" ou "Comprei TV por 1200 em 12x"
        </CardDescription>
      </CardHeader>
      <CardContent className="px-4 sm:px-6">
        <form onSubmit={handleSubmit} className="flex gap-2 sm:gap-3">
          <Textarea
            placeholder="Digite sua transação..."
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            maxLength={500}
            className="min-h-[56px] sm:min-h-[60px] resize-none border-border/50 focus-visible:ring-primary/20 text-sm sm:text-base"
          />
          <Button 
            type="submit" 
            size="icon" 
            disabled={loading || !message.trim()}
            className="h-[56px] w-[56px] sm:h-[60px] sm:w-[60px] shadow-md hover:shadow-lg transition-shadow flex-shrink-0"
          >
            <Send className="h-4 w-4 sm:h-5 sm:w-5" />
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
