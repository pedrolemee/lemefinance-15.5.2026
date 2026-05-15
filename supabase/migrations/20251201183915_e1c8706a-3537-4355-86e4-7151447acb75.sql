-- Add payment_method column to transactions table
ALTER TABLE public.transactions 
ADD COLUMN payment_method TEXT CHECK (payment_method IN ('credit_card', 'debit_card', 'pix', 'cash', 'other'));