// Payment Methods
export const PAYMENT_METHODS = {
  credit_card: "Cartão de Crédito",
  debit_card: "Cartão de Débito",
  pix: "PIX",
  cash: "Dinheiro",
  other: "Outro",
} as const;

export type PaymentMethod = keyof typeof PAYMENT_METHODS;

export const getPaymentMethodLabel = (method?: string | null): string => {
  if (!method) return "Não informado";
  return PAYMENT_METHODS[method as PaymentMethod] || "Outro";
};

// Transaction Types
export const TRANSACTION_TYPES = {
  income: "Receita",
  expense: "Despesa",
} as const;

export type TransactionType = keyof typeof TRANSACTION_TYPES;

// Transaction Data Interface (shared across components)
export interface TransactionData {
  amount: number;
  description: string;
  type: TransactionType;
  date?: string;
  category?: string;
  installments?: number;
}

// Chart Colors (semantic)
export const CHART_COLORS = [
  "hsl(var(--chart-1))",
  "hsl(var(--chart-2))",
  "hsl(var(--chart-3))",
  "hsl(var(--chart-4))",
  "hsl(var(--chart-5))",
  "hsl(262, 60%, 50%)",
  "hsl(180, 60%, 40%)",
  "hsl(320, 60%, 50%)",
] as const;

// Validation Constants
export const VALIDATION = {
  MAX_MESSAGE_LENGTH: 500,
  MAX_DESCRIPTION_LENGTH: 200,
  MAX_INSTALLMENTS: 60,
  MIN_AMOUNT: 0.01,
} as const;

// Date Formats
export const DATE_FORMATS = {
  API: "yyyy-MM-dd",
  DISPLAY: "dd/MM/yyyy",
  DISPLAY_SHORT: "dd/MM",
} as const;

// Brazilian Bank Logos - Using reliable PNG sources
export const BANK_LOGOS: Record<string, string> = {
  "Nubank": "https://nubank.com.br/images/nu-icon.png?v=2",
  "Banco do Brasil": "https://www.bb.com.br/docs/portal/img/bb-logo.png",
  "Bradesco": "https://banco.bradesco/assets/classic/img/logo-icon.svg",
  "Itaú": "https://www.itau.com.br/favicon-96x96.png",
  "Santander": "https://www.santander.com.br/favicon-96x96.png",
  "Caixa": "https://www.caixa.gov.br/Style%20Library/Default/images/favicon.ico",
  "Inter": "https://inter.co/favicon-96x96.png",
  "C6 Bank": "https://www.c6bank.com.br/favicon-96x96.png",
  "PicPay": "https://picpay.com/favicon-96x96.png",
  "Mercado Pago": "https://http2.mlstatic.com/frontend-assets/mp-web-navigation/ui-navigation/6.6.59/mercadopago/favicon.svg",
  "PagBank": "https://acesso.pagseguro.com.br/favicon-32x32.png",
  "Neon": "https://neon.com.br/favicon-96x96.png",
  "Original": "https://www.original.com.br/favicon-96x96.png",
  "BTG Pactual": "https://www.btgpactual.com/favicon-96x96.png",
  "Sicoob": "https://www.sicoob.com.br/web/sicoob/assets/img/ico/apple-touch-icon.png",
  "Sicredi": "https://www.sicredi.com.br/favicon-96x96.png",
};

export const getBankLogo = (bankName: string): string | null => {
  return BANK_LOGOS[bankName] || null;
};
