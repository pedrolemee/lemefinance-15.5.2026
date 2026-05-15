
-- ============ PROFILES ============
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "profiles_select_own" ON public.profiles FOR SELECT USING (auth.uid() = id);
CREATE POLICY "profiles_insert_own" ON public.profiles FOR INSERT WITH CHECK (auth.uid() = id);
CREATE POLICY "profiles_update_own" ON public.profiles FOR UPDATE USING (auth.uid() = id);

-- ============ BANKS (global) ============
CREATE TABLE public.banks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  code TEXT,
  color TEXT NOT NULL DEFAULT '#3B82F6',
  icon TEXT NOT NULL DEFAULT 'Building2',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.banks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "banks_select_all" ON public.banks FOR SELECT TO authenticated USING (true);

-- ============ USER_BANKS ============
CREATE TABLE public.user_banks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  bank_id UUID NOT NULL REFERENCES public.banks(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, bank_id)
);
ALTER TABLE public.user_banks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ub_all_own" ON public.user_banks FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- ============ CATEGORIES ============
CREATE TABLE public.categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('income','expense')),
  color TEXT DEFAULT '#3B82F6',
  icon TEXT DEFAULT 'CircleDollarSign',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;
CREATE POLICY "cat_all_own" ON public.categories FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- ============ TRANSACTIONS ============
CREATE TABLE public.transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('income','expense')),
  amount NUMERIC(14,2) NOT NULL,
  description TEXT NOT NULL,
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  category_id UUID REFERENCES public.categories(id) ON DELETE SET NULL,
  bank_id UUID REFERENCES public.banks(id) ON DELETE SET NULL,
  payment_method TEXT,
  installments INTEGER,
  installment_number INTEGER,
  parent_transaction_id UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_tx_user_date ON public.transactions(user_id, date DESC);
ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tx_all_own" ON public.transactions FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- ============ RECURRING TRANSACTIONS ============
CREATE TABLE public.recurring_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  description TEXT NOT NULL,
  amount NUMERIC(14,2) NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('income','expense')),
  category_id UUID REFERENCES public.categories(id) ON DELETE SET NULL,
  frequency TEXT NOT NULL DEFAULT 'monthly',
  day_of_month INTEGER DEFAULT 1,
  start_date DATE NOT NULL DEFAULT CURRENT_DATE,
  end_date DATE,
  active BOOLEAN NOT NULL DEFAULT true,
  last_generated_date DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.recurring_transactions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "rec_all_own" ON public.recurring_transactions FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- ============ BUDGETS ============
CREATE TABLE public.budgets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  category_id UUID NOT NULL REFERENCES public.categories(id) ON DELETE CASCADE,
  amount NUMERIC(14,2) NOT NULL,
  month DATE NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, category_id, month)
);
ALTER TABLE public.budgets ENABLE ROW LEVEL SECURITY;
CREATE POLICY "bud_all_own" ON public.budgets FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- ============ FINANCIAL GOALS ============
CREATE TABLE public.financial_goals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  target_amount NUMERIC(14,2) NOT NULL,
  current_amount NUMERIC(14,2) NOT NULL DEFAULT 0,
  deadline DATE NOT NULL,
  category TEXT,
  completed BOOLEAN NOT NULL DEFAULT false,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.financial_goals ENABLE ROW LEVEL SECURITY;
CREATE POLICY "goal_all_own" ON public.financial_goals FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- ============ NOTIFICATIONS ============
CREATE TABLE public.notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  type TEXT NOT NULL DEFAULT 'general',
  read BOOLEAN NOT NULL DEFAULT false,
  related_id UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
CREATE POLICY "notif_all_own" ON public.notifications FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- ============ FINANCIAL INSIGHTS ============
CREATE TABLE public.financial_insights (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  month DATE NOT NULL,
  insights JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, month)
);
ALTER TABLE public.financial_insights ENABLE ROW LEVEL SECURITY;
CREATE POLICY "fi_all_own" ON public.financial_insights FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- ============ INVESTMENT PROFILE ============
CREATE TABLE public.investment_profile (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  profile_type TEXT NOT NULL,
  quiz_responses JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.investment_profile ENABLE ROW LEVEL SECURITY;
CREATE POLICY "inv_all_own" ON public.investment_profile FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- ============ HANDLE NEW USER ============
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'full_name', ''));

  INSERT INTO public.categories (user_id, name, type, color, icon) VALUES
    (NEW.id, 'Salário', 'income', '#10B981', 'Wallet'),
    (NEW.id, 'Freelance', 'income', '#14B8A6', 'Briefcase'),
    (NEW.id, 'Investimentos', 'income', '#3B82F6', 'TrendingUp'),
    (NEW.id, 'Alimentação', 'expense', '#F59E0B', 'UtensilsCrossed'),
    (NEW.id, 'Transporte', 'expense', '#6366F1', 'Car'),
    (NEW.id, 'Moradia', 'expense', '#8B5CF6', 'Home'),
    (NEW.id, 'Saúde', 'expense', '#EF4444', 'HeartPulse'),
    (NEW.id, 'Lazer', 'expense', '#EC4899', 'Gamepad2'),
    (NEW.id, 'Educação', 'expense', '#06B6D4', 'GraduationCap'),
    (NEW.id, 'Outros', 'expense', '#94A3B8', 'CircleDollarSign');
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ============ run_user_recurring RPC ============
CREATE OR REPLACE FUNCTION public.run_user_recurring(_user_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  r RECORD;
  occ_date DATE;
  d INT;
  last_day INT;
BEGIN
  IF _user_id IS NULL OR _user_id <> auth.uid() THEN
    RETURN;
  END IF;

  FOR r IN
    SELECT * FROM public.recurring_transactions
    WHERE user_id = _user_id AND active = true AND frequency = 'monthly'
  LOOP
    last_day := EXTRACT(DAY FROM (date_trunc('month', CURRENT_DATE) + INTERVAL '1 month - 1 day'))::INT;
    d := LEAST(COALESCE(r.day_of_month, 1), last_day);
    occ_date := make_date(EXTRACT(YEAR FROM CURRENT_DATE)::INT, EXTRACT(MONTH FROM CURRENT_DATE)::INT, d);

    IF occ_date > CURRENT_DATE THEN CONTINUE; END IF;
    IF occ_date < r.start_date THEN CONTINUE; END IF;
    IF r.end_date IS NOT NULL AND occ_date > r.end_date THEN CONTINUE; END IF;
    IF r.last_generated_date IS NOT NULL AND r.last_generated_date >= occ_date THEN CONTINUE; END IF;

    INSERT INTO public.transactions (user_id, type, amount, description, date, category_id)
    VALUES (_user_id, r.type, r.amount, r.description, occ_date, r.category_id);

    UPDATE public.recurring_transactions SET last_generated_date = occ_date WHERE id = r.id;
  END LOOP;
END;
$$;

-- ============ SEED BANKS ============
INSERT INTO public.banks (name, color) VALUES
  ('Nubank', '#8A05BE'),
  ('Banco do Brasil', '#FFEF38'),
  ('Bradesco', '#CC092F'),
  ('Itaú', '#EC7000'),
  ('Santander', '#EC0000'),
  ('Caixa', '#1B61B0'),
  ('Inter', '#FF7A00'),
  ('C6 Bank', '#000000'),
  ('PicPay', '#21C25E'),
  ('Mercado Pago', '#00B1EA'),
  ('PagBank', '#048700'),
  ('Neon', '#00D5BB'),
  ('Original', '#00B26A'),
  ('BTG Pactual', '#0A2E5C'),
  ('Sicoob', '#003641'),
  ('Sicredi', '#3FA535');
