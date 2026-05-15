import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { CreditCard, Smartphone, Wallet, DollarSign, LucideIcon } from "lucide-react";
import { PAYMENT_METHODS, PaymentMethod } from "@/lib/constants";

interface PaymentMethodDialogProps {
  open: boolean;
  onSelect: (method: string) => void;
  onCancel: () => void;
}

const PAYMENT_ICONS: Record<PaymentMethod, LucideIcon> = {
  credit_card: CreditCard,
  debit_card: CreditCard,
  pix: Smartphone,
  cash: Wallet,
  other: DollarSign,
};

export default function PaymentMethodDialog({ open, onSelect, onCancel }: PaymentMethodDialogProps) {
  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onCancel()}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Como foi feito o pagamento?</DialogTitle>
        </DialogHeader>
        <div className="grid gap-3 py-4">
          {(Object.entries(PAYMENT_METHODS) as [PaymentMethod, string][]).map(([id, label]) => {
            const Icon = PAYMENT_ICONS[id];
            return (
              <Button
                key={id}
                variant="outline"
                className="justify-start h-auto py-4 px-4 hover:bg-primary/10 hover:border-primary transition-all"
                onClick={() => onSelect(id)}
              >
                <Icon className="mr-3 h-5 w-5 text-primary" />
                <span className="text-base">{label}</span>
              </Button>
            );
          })}
        </div>
      </DialogContent>
    </Dialog>
  );
}
