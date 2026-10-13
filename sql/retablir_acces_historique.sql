-- Retour aux accès du logiciel historique après migration_2026-10-14_securite_acces.sql.
-- ATTENTION : rétablit la lecture et l'écriture sans authentification serveur,
-- comme l'ancien schéma. Solution de compatibilité, pas une sécurisation.
-- Ne supprime aucune donnée, ne change aucun mot de passe ni compte Auth.
-- Ne modifie pas le journal privé whatsapp_envois.
BEGIN;
DO $$
DECLARE nom TEXT;
BEGIN
  FOREACH nom IN ARRAY ARRAY['enfants','postes','entrees','sorties','suivi','suivi_classe','app_config'] LOOP
    IF to_regclass(format('public.%I', nom)) IS NULL THEN CONTINUE; END IF;
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', nom);
    EXECUTE format('DROP POLICY IF EXISTS comptes_connectes ON public.%I', nom);
    EXECUTE format('DROP POLICY IF EXISTS acces_total ON public.%I', nom);
    EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.%I TO anon, authenticated', nom);
    EXECUTE format('CREATE POLICY acces_total ON public.%I FOR ALL TO anon, authenticated USING (true) WITH CHECK (true)', nom);
  END LOOP;
END $$;
COMMIT;
