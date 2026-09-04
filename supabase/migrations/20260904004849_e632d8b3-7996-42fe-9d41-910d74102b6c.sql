ALTER TABLE public.user_roles DISABLE TRIGGER USER;
INSERT INTO public.user_roles (user_id, role)
SELECT u.id, 'admin'::public.app_role FROM auth.users u WHERE u.email = 'joales.sousa@gmail.com'
ON CONFLICT (user_id, role) DO NOTHING;
ALTER TABLE public.user_roles ENABLE TRIGGER USER;