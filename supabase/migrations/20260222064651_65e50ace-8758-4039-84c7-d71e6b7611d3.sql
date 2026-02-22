
-- Enum for user types
CREATE TYPE public.user_type AS ENUM ('client', 'provider');

-- Enum for verification status
CREATE TYPE public.verification_status AS ENUM ('unverified', 'pending', 'verified');

-- Profiles table
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL UNIQUE,
  user_type public.user_type NOT NULL DEFAULT 'client',
  display_name TEXT NOT NULL,
  avatar_url TEXT,
  bio TEXT,
  phone TEXT,
  city TEXT,
  state TEXT,
  latitude DOUBLE PRECISION,
  longitude DOUBLE PRECISION,
  verification_status public.verification_status NOT NULL DEFAULT 'unverified',
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Service categories
CREATE TABLE public.service_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  slug TEXT NOT NULL UNIQUE,
  icon TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Provider services (links providers to categories)
CREATE TABLE public.provider_services (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  provider_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  category_id UUID REFERENCES public.service_categories(id) ON DELETE CASCADE NOT NULL,
  hourly_rate DECIMAL(10,2),
  description TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(provider_id, category_id)
);

-- Portfolio items
CREATE TABLE public.portfolio_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  provider_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  image_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Updated_at trigger
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_provider_services_updated_at BEFORE UPDATE ON public.provider_services
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Auto-create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (user_id, display_name, user_type)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'display_name', NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1)),
    COALESCE((NEW.raw_user_meta_data->>'user_type')::public.user_type, 'client')
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Helper: check profile ownership
CREATE OR REPLACE FUNCTION public.is_profile_owner(_profile_id UUID)
RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = _profile_id AND user_id = auth.uid()
  );
$$;

-- Helper: check if profile is a provider
CREATE OR REPLACE FUNCTION public.is_provider_profile(_profile_id UUID)
RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = _profile_id AND user_type = 'provider'
  );
$$;

-- Helper: get current user's profile id
CREATE OR REPLACE FUNCTION public.get_my_profile_id()
RETURNS UUID
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT id FROM public.profiles WHERE user_id = auth.uid() LIMIT 1;
$$;

-- RLS: profiles
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Anyone can see provider profiles (public listing), owners see their own
CREATE POLICY "Public can view provider profiles"
ON public.profiles FOR SELECT
USING (user_type = 'provider' OR user_id = auth.uid());

-- Users can insert their own profile (handled by trigger, but allow manual too)
CREATE POLICY "Users can insert own profile"
ON public.profiles FOR INSERT
TO authenticated
WITH CHECK (user_id = auth.uid());

-- Users can update their own profile
CREATE POLICY "Users can update own profile"
ON public.profiles FOR UPDATE
TO authenticated
USING (user_id = auth.uid());

-- RLS: service_categories (read-only for all)
ALTER TABLE public.service_categories ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view categories"
ON public.service_categories FOR SELECT
USING (true);

-- RLS: provider_services
ALTER TABLE public.provider_services ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view provider services"
ON public.provider_services FOR SELECT
USING (true);

CREATE POLICY "Providers can manage own services"
ON public.provider_services FOR INSERT
TO authenticated
WITH CHECK (public.is_profile_owner(provider_id));

CREATE POLICY "Providers can update own services"
ON public.provider_services FOR UPDATE
TO authenticated
USING (public.is_profile_owner(provider_id));

CREATE POLICY "Providers can delete own services"
ON public.provider_services FOR DELETE
TO authenticated
USING (public.is_profile_owner(provider_id));

-- RLS: portfolio_items
ALTER TABLE public.portfolio_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view portfolio items"
ON public.portfolio_items FOR SELECT
USING (true);

CREATE POLICY "Providers can manage own portfolio"
ON public.portfolio_items FOR INSERT
TO authenticated
WITH CHECK (public.is_profile_owner(provider_id));

CREATE POLICY "Providers can update own portfolio"
ON public.portfolio_items FOR UPDATE
TO authenticated
USING (public.is_profile_owner(provider_id));

CREATE POLICY "Providers can delete own portfolio"
ON public.portfolio_items FOR DELETE
TO authenticated
USING (public.is_profile_owner(provider_id));

-- Seed service categories
INSERT INTO public.service_categories (name, slug, icon) VALUES
  ('Limpeza', 'limpeza', 'sparkles'),
  ('Encanamento', 'encanamento', 'wrench'),
  ('Eletricista', 'eletricista', 'zap'),
  ('Pintura', 'pintura', 'paintbrush'),
  ('Jardinagem', 'jardinagem', 'leaf'),
  ('Mudanças', 'mudancas', 'truck'),
  ('Design Gráfico', 'design-grafico', 'palette'),
  ('Desenvolvimento Web', 'desenvolvimento-web', 'code'),
  ('Fotografia', 'fotografia', 'camera'),
  ('Aulas Particulares', 'aulas-particulares', 'book-open'),
  ('Mecânica', 'mecanica', 'settings'),
  ('Beleza & Estética', 'beleza-estetica', 'scissors'),
  ('Reformas', 'reformas', 'hammer'),
  ('Marketing Digital', 'marketing-digital', 'megaphone'),
  ('Assistência Técnica', 'assistencia-tecnica', 'monitor');
