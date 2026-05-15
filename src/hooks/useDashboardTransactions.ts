import { useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { getTodayLocalISO } from "@/lib/dateUtils";

interface TransactionData {
  amount: number;
  description: string;
  type: 'income' | 'expense';
  date?: string;
  category?: string;
}

export function useDashboardTransactions(refetch: () => void) {
  const { user } = useAuth();
  const [pendingTransaction, setPendingTransaction] = useState<TransactionData | null>(null);
  const [showPaymentDialog, setShowPaymentDialog] = useState(false);
  const [showInstallmentDialog, setShowInstallmentDialog] = useState(false);
  const [showBankDialog, setShowBankDialog] = useState(false);
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState<string | null>(null);
  const [selectedInstallments, setSelectedInstallments] = useState<number>(1);

  const insertTransaction = useCallback(async (
    data: TransactionData,
    paymentMethod?: string,
    bankId?: string | null,
    installments: number = 1
  ) => {
    try {
      let transactionDate = getTodayLocalISO();
      if (data.date) {
        const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
        if (dateRegex.test(data.date)) {
          const parsedDate = new Date(data.date);
          if (!isNaN(parsedDate.getTime())) {
            transactionDate = data.date;
          }
        }
      }

      let categoryId = null;
      if (data.category && data.category.trim().length > 0) {
        const { data: categories } = await supabase
          .from('categories')
          .select('id')
          .eq('user_id', user!.id)
          .ilike('name', data.category.trim())
          .limit(1);
        categoryId = categories?.[0]?.id || null;
      }

      if (installments > 1) {
        const transactions = [];
        const [year, month, day] = transactionDate.split('-').map(Number);
        // Cents-safe split: spread remainder over the last installment
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
          const installmentDateStr = `${newYear}-${String(newMonth + 1).padStart(2, '0')}-${String(newDay).padStart(2, '0')}`;
          const cents = baseCents + (i === installments - 1 ? remainder : 0);

          transactions.push({
            user_id: user!.id,
            category_id: categoryId,
            description: data.description.trim(),
            amount: cents / 100,
            type: data.type,
            date: installmentDateStr,
            payment_method: paymentMethod || null,
            bank_id: bankId || null,
            installments,
            installment_number: i + 1,
            parent_transaction_id: parentId || null,
          });
        }

        const { error } = await supabase.from('transactions').insert(transactions);
        if (error) throw error;
        toast.success(`Transação parcelada em ${installments}x criada!`);
      } else {
        const { error } = await supabase.from('transactions').insert({
          user_id: user!.id,
          category_id: categoryId,
          description: data.description.trim(),
          amount: data.amount,
          type: data.type,
          date: transactionDate,
          payment_method: paymentMethod || null,
          bank_id: bankId || null,
        });
        if (error) throw error;
        toast.success('Transação criada com sucesso!');
      }

      refetch();
    } catch {
      toast.error('Erro ao criar transação');
    }
  }, [user, refetch]);

  const handleTransactionExtracted = useCallback(async (data: TransactionData) => {
    if (!data || typeof data.amount !== 'number' || data.amount <= 0) {
      toast.error('Dados inválidos: valor deve ser um número positivo');
      return;
    }
    if (!data.description || data.description.trim().length === 0) {
      toast.error('Dados inválidos: descrição é obrigatória');
      return;
    }
    if (!data.type || !['income', 'expense'].includes(data.type)) {
      toast.error('Dados inválidos: tipo deve ser receita ou despesa');
      return;
    }

    if (data.type === 'expense') {
      setPendingTransaction(data);
      setShowPaymentDialog(true);
    } else {
      await insertTransaction(data);
    }
  }, [insertTransaction]);

  const handlePaymentMethodSelect = useCallback((method: string) => {
    setShowPaymentDialog(false);
    setSelectedPaymentMethod(method);
    if (method === 'credit_card') {
      setShowInstallmentDialog(true);
    } else {
      setSelectedInstallments(1);
      setShowBankDialog(true);
    }
  }, []);

  const handleInstallmentSelect = useCallback((installments: number) => {
    setShowInstallmentDialog(false);
    setSelectedInstallments(installments);
    setShowBankDialog(true);
  }, []);

  const handleInstallmentCancel = useCallback(() => {
    setShowInstallmentDialog(false);
    setSelectedInstallments(1);
    setShowBankDialog(true);
  }, []);

  const handleBankSelect = useCallback(async (bankId: string | null) => {
    setShowBankDialog(false);
    if (pendingTransaction) {
      await insertTransaction(pendingTransaction, selectedPaymentMethod || undefined, bankId, selectedInstallments);
      setPendingTransaction(null);
      setSelectedPaymentMethod(null);
      setSelectedInstallments(1);
    }
  }, [pendingTransaction, selectedPaymentMethod, selectedInstallments, insertTransaction]);

  const handlePaymentDialogCancel = useCallback(() => {
    setShowPaymentDialog(false);
    setPendingTransaction(null);
  }, []);

  const handleBankDialogCancel = useCallback(() => {
    setShowBankDialog(false);
    if (pendingTransaction) {
      insertTransaction(pendingTransaction, selectedPaymentMethod || undefined, null, selectedInstallments);
      setPendingTransaction(null);
      setSelectedPaymentMethod(null);
      setSelectedInstallments(1);
    }
  }, [pendingTransaction, selectedPaymentMethod, selectedInstallments, insertTransaction]);

  return {
    pendingTransaction,
    showPaymentDialog,
    showInstallmentDialog,
    showBankDialog,
    handleTransactionExtracted,
    handlePaymentMethodSelect,
    handleInstallmentSelect,
    handleInstallmentCancel,
    handleBankSelect,
    handlePaymentDialogCancel,
    handleBankDialogCancel,
  };
}
