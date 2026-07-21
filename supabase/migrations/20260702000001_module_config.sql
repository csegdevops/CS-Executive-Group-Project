CREATE TABLE IF NOT EXISTS public.module_config (
  module      text PRIMARY KEY CHECK (module IN ('regulatory', 'recruitment', 'crm')),
  is_enabled  boolean NOT NULL DEFAULT true,
  updated_by  uuid REFERENCES public.profiles(id),
  updated_at  timestamptz DEFAULT now()
);

-- Seed rows; skip if already present
INSERT INTO public.module_config (module)
  VALUES ('regulatory'), ('recruitment'), ('crm')
  ON CONFLICT (module) DO NOTHING;

ALTER TABLE public.module_config ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY "read module config" ON public.module_config
    FOR SELECT TO authenticated USING (true);
EXCEPTION WHEN duplicate_object THEN null;
END $$;
