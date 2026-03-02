
-- Create appointments table
CREATE TABLE public.appointments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  client_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  provider_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  service_id UUID REFERENCES public.provider_services(id) ON DELETE SET NULL,
  scheduled_date DATE NOT NULL,
  scheduled_time TIME NOT NULL,
  duration_minutes INTEGER NOT NULL DEFAULT 60,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'confirmed', 'cancelled', 'completed')),
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.appointments ENABLE ROW LEVEL SECURITY;

-- Policies: clients and providers can see their own appointments
CREATE POLICY "Users can view own appointments"
ON public.appointments FOR SELECT
USING (
  client_id = public.get_my_profile_id() OR provider_id = public.get_my_profile_id()
);

CREATE POLICY "Clients can create appointments"
ON public.appointments FOR INSERT
WITH CHECK (client_id = public.get_my_profile_id());

CREATE POLICY "Participants can update appointments"
ON public.appointments FOR UPDATE
USING (
  client_id = public.get_my_profile_id() OR provider_id = public.get_my_profile_id()
);

CREATE POLICY "Participants can delete appointments"
ON public.appointments FOR DELETE
USING (
  client_id = public.get_my_profile_id() OR provider_id = public.get_my_profile_id()
);

-- Trigger for updated_at
CREATE TRIGGER update_appointments_updated_at
BEFORE UPDATE ON public.appointments
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Also allow clients to be visible to providers for the professional mode map
-- Update profiles RLS to allow providers to see client profiles too
CREATE POLICY "Providers can view client profiles"
ON public.profiles FOR SELECT
TO authenticated
USING (true);

-- Drop the old restrictive select policy
DROP POLICY IF EXISTS "Public can view provider profiles" ON public.profiles;
