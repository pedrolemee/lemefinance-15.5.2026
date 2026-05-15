-- 1) Extend run_user_recurring to also process daily frequency
CREATE OR REPLACE FUNCTION public.run_user_recurring(_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  r RECORD;
  occ_date DATE;
  d INT;
  last_day INT;
  cur DATE;
  range_start DATE;
BEGIN
  IF _user_id IS NULL OR _user_id <> auth.uid() THEN
    RETURN;
  END IF;

  -- Monthly recurrences
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

  -- Daily recurrences: backfill from last_generated_date+1 (or start_date) up to today
  FOR r IN
    SELECT * FROM public.recurring_transactions
    WHERE user_id = _user_id AND active = true AND frequency = 'daily'
  LOOP
    range_start := GREATEST(
      r.start_date,
      COALESCE(r.last_generated_date + 1, r.start_date)
    );
    cur := range_start;
    WHILE cur <= CURRENT_DATE LOOP
      IF r.end_date IS NOT NULL AND cur > r.end_date THEN EXIT; END IF;
      INSERT INTO public.transactions (user_id, type, amount, description, date, category_id)
      VALUES (_user_id, r.type, r.amount, r.description, cur, r.category_id);
      UPDATE public.recurring_transactions SET last_generated_date = cur WHERE id = r.id;
      cur := cur + 1;
    END LOOP;
  END LOOP;
END;
$function$;

-- 2) FK on transactions.bank_id -> banks.id ON DELETE SET NULL
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'transactions_bank_id_fkey' AND table_name = 'transactions'
  ) THEN
    -- Null out any orphan references first
    UPDATE public.transactions t
    SET bank_id = NULL
    WHERE bank_id IS NOT NULL
      AND NOT EXISTS (SELECT 1 FROM public.banks b WHERE b.id = t.bank_id);

    ALTER TABLE public.transactions
      ADD CONSTRAINT transactions_bank_id_fkey
      FOREIGN KEY (bank_id) REFERENCES public.banks(id) ON DELETE SET NULL;
  END IF;
END $$;

-- 3) FK profiles.id -> auth.users(id) ON DELETE CASCADE
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'profiles_id_fkey' AND table_name = 'profiles'
  ) THEN
    DELETE FROM public.profiles p
    WHERE NOT EXISTS (SELECT 1 FROM auth.users u WHERE u.id = p.id);

    ALTER TABLE public.profiles
      ADD CONSTRAINT profiles_id_fkey
      FOREIGN KEY (id) REFERENCES auth.users(id) ON DELETE CASCADE;
  END IF;
END $$;