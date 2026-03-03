
-- Create task_applications table to track professional applications to service requests
CREATE TABLE public.task_applications (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  service_request_id UUID NOT NULL REFERENCES public.service_requests(id) ON DELETE CASCADE,
  applicant_profile_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  conversation_id UUID REFERENCES public.conversations(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'pending', -- pending, accepted, rejected, completed
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE (service_request_id, applicant_profile_id)
);

-- Enable RLS
ALTER TABLE public.task_applications ENABLE ROW LEVEL SECURITY;

-- Applicants can view their own applications
CREATE POLICY "Applicants can view own applications"
ON public.task_applications
FOR SELECT
USING (applicant_profile_id = get_my_profile_id());

-- Task owners can view applications to their tasks
CREATE POLICY "Task owners can view applications to their tasks"
ON public.task_applications
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.service_requests
    WHERE id = service_request_id AND profile_id = get_my_profile_id()
  )
);

-- Applicants can create applications
CREATE POLICY "Applicants can create applications"
ON public.task_applications
FOR INSERT
WITH CHECK (applicant_profile_id = get_my_profile_id());

-- Task owners can update application status (accept/reject)
CREATE POLICY "Task owners can update application status"
ON public.task_applications
FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM public.service_requests
    WHERE id = service_request_id AND profile_id = get_my_profile_id()
  )
);

-- Applicants can update their own applications (e.g. mark completed)
CREATE POLICY "Applicants can update own applications"
ON public.task_applications
FOR UPDATE
USING (applicant_profile_id = get_my_profile_id());

-- Trigger for updated_at
CREATE TRIGGER update_task_applications_updated_at
BEFORE UPDATE ON public.task_applications
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();
