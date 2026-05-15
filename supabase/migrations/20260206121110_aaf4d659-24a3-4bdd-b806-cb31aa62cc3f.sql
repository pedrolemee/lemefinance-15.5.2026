-- Add INSERT policy for profiles table to allow new users to create their profile
CREATE POLICY "Users can insert own profile"
ON public.profiles
FOR INSERT
WITH CHECK (auth.uid() = id);