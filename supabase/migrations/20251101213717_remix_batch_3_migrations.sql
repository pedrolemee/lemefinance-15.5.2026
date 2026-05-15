
-- Migration: 20251101211629

-- Migration: 20250930110259
-- Create profiles table for user data
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- RLS Policies for profiles
CREATE POLICY "Users can view own profile"
  ON public.profiles FOR SELECT
  USING (auth.uid() = id);

CREATE POLICY "Users can update own profile"
  ON public.profiles FOR UPDATE
  USING (auth.uid() = id);

-- Trigger to create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', 'Usuário')
  );
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Create categories table
CREATE TABLE public.categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('income', 'expense')),
  color TEXT DEFAULT '#14B8A6',
  icon TEXT DEFAULT 'CircleDollarSign',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;

-- RLS Policies for categories
CREATE POLICY "Users can view own categories"
  ON public.categories FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create own categories"
  ON public.categories FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own categories"
  ON public.categories FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own categories"
  ON public.categories FOR DELETE
  USING (auth.uid() = user_id);

-- Create transactions table
CREATE TABLE public.transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  category_id UUID REFERENCES public.categories(id) ON DELETE SET NULL,
  type TEXT NOT NULL CHECK (type IN ('income', 'expense')),
  amount DECIMAL(12, 2) NOT NULL CHECK (amount > 0),
  description TEXT NOT NULL,
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;

-- RLS Policies for transactions
CREATE POLICY "Users can view own transactions"
  ON public.transactions FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create own transactions"
  ON public.transactions FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own transactions"
  ON public.transactions FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own transactions"
  ON public.transactions FOR DELETE
  USING (auth.uid() = user_id);

-- Create indexes for performance
CREATE INDEX idx_transactions_user_id ON public.transactions(user_id);
CREATE INDEX idx_transactions_date ON public.transactions(date);
CREATE INDEX idx_categories_user_id ON public.categories(user_id);

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

-- Trigger for transactions updated_at
CREATE TRIGGER update_transactions_updated_at
  BEFORE UPDATE ON public.transactions
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Trigger for profiles updated_at
CREATE TRIGGER update_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Migration: 20251001114013
-- Add installment fields to transactions table
ALTER TABLE public.transactions
ADD COLUMN installments INTEGER DEFAULT 1,
ADD COLUMN installment_number INTEGER DEFAULT 1,
ADD COLUMN parent_transaction_id UUID REFERENCES public.transactions(id) ON DELETE CASCADE;

-- Create index for better performance when querying installments
CREATE INDEX idx_transactions_parent_id ON public.transactions(parent_transaction_id);

COMMENT ON COLUMN public.transactions.installments IS 'Total number of installments for this transaction';
COMMENT ON COLUMN public.transactions.installment_number IS 'Current installment number (e.g., 1 of 12)';
COMMENT ON COLUMN public.transactions.parent_transaction_id IS 'Reference to the parent transaction if this is part of an installment plan';

-- Migration: 20251003045811
-- Create financial_goals table
CREATE TABLE public.financial_goals (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  title TEXT NOT NULL,
  target_amount NUMERIC NOT NULL CHECK (target_amount > 0),
  current_amount NUMERIC NOT NULL DEFAULT 0 CHECK (current_amount >= 0),
  deadline DATE NOT NULL,
  category TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  completed BOOLEAN NOT NULL DEFAULT false,
  completed_at TIMESTAMP WITH TIME ZONE
);

-- Enable RLS
ALTER TABLE public.financial_goals ENABLE ROW LEVEL SECURITY;

-- RLS Policies for financial_goals
CREATE POLICY "Users can view own goals"
  ON public.financial_goals
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create own goals"
  ON public.financial_goals
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own goals"
  ON public.financial_goals
  FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own goals"
  ON public.financial_goals
  FOR DELETE
  USING (auth.uid() = user_id);

-- Trigger for updated_at
CREATE TRIGGER update_financial_goals_updated_at
  BEFORE UPDATE ON public.financial_goals
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Create financial_insights table for caching AI insights
CREATE TABLE public.financial_insights (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  month DATE NOT NULL,
  insights JSONB NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(user_id, month)
);

-- Enable RLS
ALTER TABLE public.financial_insights ENABLE ROW LEVEL SECURITY;

-- RLS Policies for financial_insights
CREATE POLICY "Users can view own insights"
  ON public.financial_insights
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own insights"
  ON public.financial_insights
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own insights"
  ON public.financial_insights
  FOR UPDATE
  USING (auth.uid() = user_id);

-- Migration: 20251004113158
-- Tabela de orçamentos por categoria
CREATE TABLE public.budgets (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  category_id UUID REFERENCES public.categories(id) ON DELETE CASCADE,
  amount NUMERIC NOT NULL,
  month DATE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(user_id, category_id, month)
);

-- Enable RLS
ALTER TABLE public.budgets ENABLE ROW LEVEL SECURITY;

-- RLS Policies para budgets
CREATE POLICY "Users can view own budgets"
  ON public.budgets FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create own budgets"
  ON public.budgets FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own budgets"
  ON public.budgets FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own budgets"
  ON public.budgets FOR DELETE
  USING (auth.uid() = user_id);

-- Tabela de transações recorrentes
CREATE TABLE public.recurring_transactions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  category_id UUID REFERENCES public.categories(id) ON DELETE SET NULL,
  description TEXT NOT NULL,
  amount NUMERIC NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('income', 'expense')),
  frequency TEXT NOT NULL CHECK (frequency IN ('monthly', 'weekly', 'daily')),
  day_of_month INTEGER CHECK (day_of_month BETWEEN 1 AND 31),
  day_of_week INTEGER CHECK (day_of_week BETWEEN 0 AND 6),
  active BOOLEAN NOT NULL DEFAULT true,
  start_date DATE NOT NULL DEFAULT CURRENT_DATE,
  end_date DATE,
  last_generated_date DATE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.recurring_transactions ENABLE ROW LEVEL SECURITY;

-- RLS Policies para recurring_transactions
CREATE POLICY "Users can view own recurring transactions"
  ON public.recurring_transactions FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create own recurring transactions"
  ON public.recurring_transactions FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own recurring transactions"
  ON public.recurring_transactions FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own recurring transactions"
  ON public.recurring_transactions FOR DELETE
  USING (auth.uid() = user_id);

-- Tabela de notificações
CREATE TABLE public.notifications (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('budget_warning', 'budget_exceeded', 'goal_deadline', 'recurring_transaction', 'unusual_spending')),
  read BOOLEAN NOT NULL DEFAULT false,
  related_id UUID,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

-- RLS Policies para notifications
CREATE POLICY "Users can view own notifications"
  ON public.notifications FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can update own notifications"
  ON public.notifications FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own notifications"
  ON public.notifications FOR DELETE
  USING (auth.uid() = user_id);

-- Trigger para atualizar updated_at
CREATE TRIGGER update_budgets_updated_at
  BEFORE UPDATE ON public.budgets
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_recurring_transactions_updated_at
  BEFORE UPDATE ON public.recurring_transactions
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Função para gerar transações recorrentes
CREATE OR REPLACE FUNCTION public.generate_recurring_transactions()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  rec RECORD;
  should_generate BOOLEAN;
  target_date DATE;
BEGIN
  FOR rec IN 
    SELECT * FROM public.recurring_transactions 
    WHERE active = true 
    AND (end_date IS NULL OR end_date >= CURRENT_DATE)
  LOOP
    should_generate := false;
    target_date := CURRENT_DATE;
    
    -- Verificar se deve gerar baseado na frequência
    IF rec.frequency = 'monthly' THEN
      IF rec.day_of_month IS NOT NULL THEN
        target_date := DATE_TRUNC('month', CURRENT_DATE) + (rec.day_of_month - 1) * INTERVAL '1 day';
        IF target_date <= CURRENT_DATE AND (rec.last_generated_date IS NULL OR rec.last_generated_date < target_date) THEN
          should_generate := true;
        END IF;
      END IF;
    ELSIF rec.frequency = 'weekly' THEN
      -- Implementar lógica semanal se necessário
      NULL;
    ELSIF rec.frequency = 'daily' THEN
      IF rec.last_generated_date IS NULL OR rec.last_generated_date < CURRENT_DATE THEN
        should_generate := true;
      END IF;
    END IF;
    
    -- Gerar transação se necessário
    IF should_generate THEN
      INSERT INTO public.transactions (
        user_id,
        category_id,
        description,
        amount,
        type,
        date
      ) VALUES (
        rec.user_id,
        rec.category_id,
        rec.description,
        rec.amount,
        rec.type,
        target_date
      );
      
      -- Atualizar data da última geração
      UPDATE public.recurring_transactions
      SET last_generated_date = target_date
      WHERE id = rec.id;
    END IF;
  END LOOP;
END;
$$;

-- Migration: 20251004113221
-- Corrigir search_path nas funções existentes
DROP FUNCTION IF EXISTS public.generate_recurring_transactions();

CREATE OR REPLACE FUNCTION public.generate_recurring_transactions()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  rec RECORD;
  should_generate BOOLEAN;
  target_date DATE;
BEGIN
  FOR rec IN 
    SELECT * FROM recurring_transactions 
    WHERE active = true 
    AND (end_date IS NULL OR end_date >= CURRENT_DATE)
  LOOP
    should_generate := false;
    target_date := CURRENT_DATE;
    
    IF rec.frequency = 'monthly' THEN
      IF rec.day_of_month IS NOT NULL THEN
        target_date := DATE_TRUNC('month', CURRENT_DATE) + (rec.day_of_month - 1) * INTERVAL '1 day';
        IF target_date <= CURRENT_DATE AND (rec.last_generated_date IS NULL OR rec.last_generated_date < target_date) THEN
          should_generate := true;
        END IF;
      END IF;
    ELSIF rec.frequency = 'daily' THEN
      IF rec.last_generated_date IS NULL OR rec.last_generated_date < CURRENT_DATE THEN
        should_generate := true;
      END IF;
    END IF;
    
    IF should_generate THEN
      INSERT INTO transactions (
        user_id,
        category_id,
        description,
        amount,
        type,
        date
      ) VALUES (
        rec.user_id,
        rec.category_id,
        rec.description,
        rec.amount,
        rec.type,
        target_date
      );
      
      UPDATE recurring_transactions
      SET last_generated_date = target_date
      WHERE id = rec.id;
    END IF;
  END LOOP;
END;
$$;

-- Migration: 20251004113240
-- Corrigir search_path na função handle_new_user
DROP FUNCTION IF EXISTS public.handle_new_user() CASCADE;

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO profiles (id, full_name)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', 'Usuário')
  );
  RETURN NEW;
END;
$$;

-- Recriar o trigger
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- Migration: 20251020130053
-- Create investment_profile table
CREATE TABLE public.investment_profile (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  profile_type TEXT NOT NULL CHECK (profile_type IN ('conservador', 'moderado', 'arrojado')),
  quiz_responses JSONB NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(user_id)
);

-- Enable Row Level Security
ALTER TABLE public.investment_profile ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Users can view own investment profile"
ON public.investment_profile
FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can create own investment profile"
ON public.investment_profile
FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own investment profile"
ON public.investment_profile
FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own investment profile"
ON public.investment_profile
FOR DELETE
USING (auth.uid() = user_id);

-- Create trigger for automatic timestamp updates
CREATE TRIGGER update_investment_profile_updated_at
BEFORE UPDATE ON public.investment_profile
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Migration: 20251021112734
-- Create banks table
CREATE TABLE public.banks (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  code TEXT,
  color TEXT NOT NULL DEFAULT '#14B8A6',
  icon TEXT NOT NULL DEFAULT 'Building2',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Add bank_id to transactions table
ALTER TABLE public.transactions 
ADD COLUMN bank_id UUID REFERENCES public.banks(id);

-- Create index for better performance
CREATE INDEX idx_transactions_bank_id ON public.transactions(bank_id);

-- Insert common Brazilian banks
INSERT INTO public.banks (name, code, color, icon) VALUES
  ('Nubank', '260', '#8A05BE', 'CreditCard'),
  ('Banco do Brasil', '001', '#FCD116', 'Landmark'),
  ('Itaú', '341', '#FF6600', 'Building2'),
  ('Bradesco', '237', '#CC092F', 'Building'),
  ('Caixa Econômica Federal', '104', '#0066A1', 'Home'),
  ('Santander', '033', '#EC0000', 'BadgeDollarSign'),
  ('Banco Inter', '077', '#FF7A00', 'Smartphone'),
  ('C6 Bank', '336', '#2E2E2E', 'Wallet'),
  ('PagBank', '290', '#00A868', 'DollarSign'),
  ('Mercado Pago', '323', '#009EE3', 'ShoppingCart'),
  ('Picpay', '380', '#21C25E', 'Zap'),
  ('Neon', '735', '#00D5D9', 'Sparkles');

-- Enable RLS on banks table
ALTER TABLE public.banks ENABLE ROW LEVEL SECURITY;

-- Create policy for banks (read-only for all authenticated users)
CREATE POLICY "Anyone can view banks" 
ON public.banks 
FOR SELECT 
USING (true);

-- Migration: 20251101210006
-- Add missing INSERT policy for notifications table
CREATE POLICY "Users can create own notifications" 
ON public.notifications 
FOR INSERT 
WITH CHECK (auth.uid() = user_id);


-- Migration: 20251101212621
-- Force types regeneration
-- Adding a comment to trigger types update
COMMENT ON TABLE banks IS 'Banking institutions for transactions';

-- Migration: 20251101212715
-- Force types regeneration by modifying table
ALTER TABLE banks ADD COLUMN IF NOT EXISTS temp_column TEXT;
ALTER TABLE banks DROP COLUMN IF EXISTS temp_column;
