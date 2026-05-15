-- Create user_banks table for users to register their banks
CREATE TABLE public.user_banks (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  bank_id UUID NOT NULL REFERENCES public.banks(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(user_id, bank_id)
);

-- Enable RLS
ALTER TABLE public.user_banks ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view own banks"
ON public.user_banks FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can add own banks"
ON public.user_banks FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own banks"
ON public.user_banks FOR DELETE
USING (auth.uid() = user_id);