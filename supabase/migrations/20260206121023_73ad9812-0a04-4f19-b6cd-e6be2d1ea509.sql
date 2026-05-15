-- Add date validation trigger for transactions table
-- Using a trigger instead of CHECK constraint since we need to reference CURRENT_DATE

CREATE OR REPLACE FUNCTION public.validate_transaction_date()
RETURNS TRIGGER AS $$
BEGIN
  -- Validate date is within reasonable range (not too far in past or future)
  IF NEW.date < '1900-01-01'::date THEN
    RAISE EXCEPTION 'Transaction date cannot be before 1900-01-01';
  END IF;
  
  IF NEW.date > (CURRENT_DATE + INTERVAL '10 years')::date THEN
    RAISE EXCEPTION 'Transaction date cannot be more than 10 years in the future';
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- Create trigger for INSERT and UPDATE on transactions
DROP TRIGGER IF EXISTS validate_transaction_date_trigger ON public.transactions;
CREATE TRIGGER validate_transaction_date_trigger
  BEFORE INSERT OR UPDATE ON public.transactions
  FOR EACH ROW
  EXECUTE FUNCTION public.validate_transaction_date();

-- Also add validation for recurring_transactions start_date and end_date
CREATE OR REPLACE FUNCTION public.validate_recurring_transaction_dates()
RETURNS TRIGGER AS $$
BEGIN
  -- Validate start_date is within reasonable range
  IF NEW.start_date < '1900-01-01'::date THEN
    RAISE EXCEPTION 'Start date cannot be before 1900-01-01';
  END IF;
  
  IF NEW.start_date > (CURRENT_DATE + INTERVAL '10 years')::date THEN
    RAISE EXCEPTION 'Start date cannot be more than 10 years in the future';
  END IF;
  
  -- Validate end_date if provided
  IF NEW.end_date IS NOT NULL THEN
    IF NEW.end_date < NEW.start_date THEN
      RAISE EXCEPTION 'End date cannot be before start date';
    END IF;
    
    IF NEW.end_date > (CURRENT_DATE + INTERVAL '50 years')::date THEN
      RAISE EXCEPTION 'End date cannot be more than 50 years in the future';
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- Create trigger for recurring_transactions
DROP TRIGGER IF EXISTS validate_recurring_transaction_dates_trigger ON public.recurring_transactions;
CREATE TRIGGER validate_recurring_transaction_dates_trigger
  BEFORE INSERT OR UPDATE ON public.recurring_transactions
  FOR EACH ROW
  EXECUTE FUNCTION public.validate_recurring_transaction_dates();