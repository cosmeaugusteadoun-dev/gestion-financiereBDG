-- ============================================================
-- MIGRATION — 10/08/2026
-- Ajoute la table "app_config" : stocke l'empreinte SHA-256 du mot de
-- passe de connexion, pour permettre son changement depuis l'application
-- (Changer le mot de passe, dans l'en-tête). Remplace progressivement la
-- valeur statique APP_PASSWORD_HASH de config.js, qui reste utilisée en
-- secours si Supabase est injoignable au moment de la connexion.
--
-- À exécuter une seule fois dans Supabase > SQL Editor > Run.
-- La ligne insérée reprend l'empreinte actuellement définie dans
-- config.js (mot de passe "admin2026" au moment de cette migration) —
-- l'ancien mot de passe continue donc de fonctionner tant qu'il n'est
-- pas changé depuis l'application.
-- ============================================================

CREATE TABLE IF NOT EXISTS app_config (
  id             TEXT PRIMARY KEY,
  password_hash  TEXT NOT NULL,
  updated_at     TIMESTAMPTZ DEFAULT now()
);

INSERT INTO app_config (id, password_hash)
VALUES ('main', '6051fc84a7a0d74c225fb18a496b09952da5642e60723ecae543298edd7d82d6')
ON CONFLICT (id) DO NOTHING;

ALTER TABLE app_config ENABLE ROW LEVEL SECURITY;
CREATE POLICY "acces_total" ON app_config FOR ALL USING (true) WITH CHECK (true);

-- Corrige un oubli de la migration du 07/08/2026 : la table "suivi_classe"
-- avait été créée sans activer la sécurité au niveau ligne (RLS), à la
-- différence de toutes les autres tables du projet. Si elle a déjà été
-- protégée manuellement, cette section ne change rien (DO $$ ... $$ ignore
-- les policies déjà existantes).
ALTER TABLE suivi_classe ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'suivi_classe' AND policyname = 'acces_total') THEN
    CREATE POLICY "acces_total" ON suivi_classe FOR ALL USING (true) WITH CHECK (true);
  END IF;
END $$;
