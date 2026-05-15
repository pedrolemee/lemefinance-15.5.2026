// Formatação de moeda brasileira
export const formatCurrency = (value: number): string => {
  return value.toLocaleString('pt-BR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });
};

// Formatação compacta para valores grandes (suporta negativos)
export const formatCurrencyCompact = (value: number): string => {
  const sign = value < 0 ? '-' : '';
  const abs = Math.abs(value);
  if (abs >= 1000000) return `${sign}${(abs / 1000000).toFixed(1)}M`;
  if (abs >= 1000) return `${sign}${(abs / 1000).toFixed(1)}K`;
  return `${sign}${formatCurrency(abs)}`;
};

// Validação de valor numérico
export const isValidAmount = (value: any): boolean => {
  const num = Number(value);
  return !isNaN(num) && num > 0 && isFinite(num);
};

// Parse seguro de número
export const safeParseFloat = (value: string | number, defaultValue: number = 0): number => {
  const parsed = typeof value === 'string' ? parseFloat(value) : value;
  return isFinite(parsed) && !isNaN(parsed) ? parsed : defaultValue;
};
