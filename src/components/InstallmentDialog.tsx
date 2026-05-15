import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface InstallmentDialogProps {
  open: boolean;
  onSelect: (installments: number) => void;
  onCancel: () => void;
  amount: number;
}

export default function InstallmentDialog({ open, onSelect, onCancel, amount }: InstallmentDialogProps) {
  const [installments, setInstallments] = useState(1);
  const [customInput, setCustomInput] = useState("");

  const presetOptions = [1, 2, 3, 6, 10, 12];
  const installmentAmount = amount / (customInput ? parseInt(customInput) || 1 : installments);

  const handlePresetSelect = (value: number) => {
    setInstallments(value);
    setCustomInput("");
  };

  const handleConfirm = () => {
    const finalInstallments = customInput ? parseInt(customInput) || 1 : installments;
    onSelect(Math.min(Math.max(finalInstallments, 1), 60));
  };

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onCancel()}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Em quantas vezes?</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div className="grid grid-cols-3 gap-2">
            {presetOptions.map((option) => (
              <Button
                key={option}
                variant={installments === option && !customInput ? "default" : "outline"}
                className="h-12"
                onClick={() => handlePresetSelect(option)}
              >
                {option}x
              </Button>
            ))}
          </div>

          <div className="space-y-2">
            <Label>Ou digite o número de parcelas:</Label>
            <Input
              type="number"
              min="1"
              max="60"
              placeholder="Ex: 24"
              value={customInput}
              onChange={(e) => {
                setCustomInput(e.target.value);
                if (e.target.value) {
                  setInstallments(0);
                }
              }}
            />
          </div>

          <div className="p-4 bg-muted rounded-lg text-center">
            <p className="text-sm text-muted-foreground">Valor por parcela:</p>
            <p className="text-2xl font-bold text-primary">
              R$ {installmentAmount.toFixed(2)}
            </p>
          </div>

          <Button className="w-full" onClick={handleConfirm}>
            Confirmar
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
