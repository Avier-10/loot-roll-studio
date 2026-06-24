
-- ============ Probability versioning ============
CREATE TABLE public.probability_versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  version INTEGER NOT NULL,
  config JSONB NOT NULL,
  note TEXT,
  restored_from_version INTEGER,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(version)
);
GRANT SELECT ON public.probability_versions TO authenticated;
GRANT ALL ON public.probability_versions TO service_role;
ALTER TABLE public.probability_versions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins and mods read probability versions" ON public.probability_versions
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'moderator'));

CREATE INDEX probability_versions_version_idx ON public.probability_versions (version DESC);

-- Seed initial version with defaults (matches src/config/probabilities.ts)
INSERT INTO public.probability_versions (version, config, note)
VALUES (1, '[
  {"type":"beneficio","category":"bueno","weight":30,"label":"Bueno","color":"cat-bueno"},
  {"type":"beneficio","category":"muy_bueno","weight":20,"label":"Muy Bueno","color":"cat-muy-bueno"},
  {"type":"beneficio","category":"excelente","weight":5,"label":"Excelente","color":"cat-excelente"},
  {"type":"castigo","category":"leve","weight":25,"label":"Leve","color":"cat-leve"},
  {"type":"castigo","category":"medio","weight":15,"label":"Medio","color":"cat-medio"},
  {"type":"castigo","category":"fuerte","weight":5,"label":"Fuerte","color":"cat-fuerte"}
]'::jsonb, 'Versión inicial');

-- ============ Spin history soft delete ============
ALTER TABLE public.spins
  ADD COLUMN deleted_at TIMESTAMPTZ,
  ADD COLUMN deleted_by UUID REFERENCES auth.users(id) ON DELETE SET NULL;

CREATE INDEX spins_not_deleted_idx ON public.spins (created_at DESC) WHERE deleted_at IS NULL;

-- Tighten read policy: streamers/admins see non-deleted; admins see all
DROP POLICY IF EXISTS "Admins streamers read spins" ON public.spins;
CREATE POLICY "Read non-deleted spins" ON public.spins
  FOR SELECT TO authenticated
  USING (
    (deleted_at IS NULL AND (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'streamer')))
    OR public.has_role(auth.uid(),'admin')
  );
