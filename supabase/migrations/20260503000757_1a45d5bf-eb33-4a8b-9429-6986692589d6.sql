CREATE OR REPLACE FUNCTION public.run_user_recurring(_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  rec RECORD;
  target_date DATE;
  last_day INT;
  day_to_use INT;
BEGIN
  -- Only allow the authenticated user to run for themselves
  IF _user_id IS NULL OR _user_id <> auth.uid() THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  FOR rec IN
    SELECT * FROM recurring_transactions
    WHERE user_id = _user_id
      AND active = true
      AND (end_date IS NULL OR end_date >= CURRENT_DATE)
  LOOP
    IF rec.frequency = 'monthly' THEN
      last_day := EXTRACT(DAY FROM (DATE_TRUNC('month', CURRENT_DATE) + INTERVAL '1 month - 1 day'))::INT;
      day_to_use := LEAST(COALESCE(rec.day_of_month, 1), last_day);
      target_date := DATE_TRUNC('month', CURRENT_DATE)::DATE + (day_to_use - 1);
      IF target_date <= CURRENT_DATE
         AND target_date >= rec.start_date
         AND (rec.last_generated_date IS NULL OR rec.last_generated_date < target_date) THEN
        INSERT INTO transactions (user_id, category_id, description, amount, type, date)
        VALUES (rec.user_id, rec.category_id, rec.description, rec.amount, rec.type, target_date);
        UPDATE recurring_transactions SET last_generated_date = target_date WHERE id = rec.id;
      END IF;
    ELSIF rec.frequency = 'daily' THEN
      target_date := CURRENT_DATE;
      IF target_date >= rec.start_date
         AND (rec.last_generated_date IS NULL OR rec.last_generated_date < target_date) THEN
        INSERT INTO transactions (user_id, category_id, description, amount, type, date)
        VALUES (rec.user_id, rec.category_id, rec.description, rec.amount, rec.type, target_date);
        UPDATE recurring_transactions SET last_generated_date = target_date WHERE id = rec.id;
      END IF;
    END IF;
  END LOOP;
END;
$$;

GRANT EXECUTE ON FUNCTION public.run_user_recurring(uuid) TO authenticated;