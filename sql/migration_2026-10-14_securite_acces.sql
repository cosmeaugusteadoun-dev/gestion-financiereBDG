-- Exécuter après avoir vérifié une connexion par email Supabase Auth.
-- INCOMPATIBLE AVEC L'ACCÈS HISTORIQUE : ne pas appliquer si vous le conservez.
-- Désactiver les inscriptions publiques dans Authentication avant application.
-- Pas de suppression de dossiers, paiements ou mots de passe Auth.
BEGIN;
DO $$
DECLARE nom TEXT; politique RECORD;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM auth.users WHERE email_confirmed_at IS NOT NULL AND coalesce(is_anonymous, false) = false) THEN
    RAISE EXCEPTION 'Créer et confirmer un compte Supabase Auth avant de protéger la base.';
  END IF;
  FOREACH nom IN ARRAY ARRAY['enfants','postes','entrees','sorties','suivi','suivi_classe','app_config'] LOOP
    IF to_regclass(format('public.%I', nom)) IS NULL THEN CONTINUE; END IF;
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', nom);
    FOR politique IN SELECT policyname FROM pg_policies WHERE schemaname = 'public' AND tablename = nom LOOP
      EXECUTE format('DROP POLICY %I ON public.%I', politique.policyname, nom);
    END LOOP;
    EXECUTE format('REVOKE ALL ON TABLE public.%I FROM PUBLIC, anon, authenticated', nom);
    IF nom <> 'app_config' THEN
      EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.%I TO authenticated', nom);
      EXECUTE format('CREATE POLICY comptes_connectes ON public.%I FOR ALL TO authenticated USING ((select auth.uid()) IS NOT NULL AND coalesce((select auth.jwt())->>''is_anonymous'', ''false'') = ''false'') WITH CHECK ((select auth.uid()) IS NOT NULL AND coalesce((select auth.jwt())->>''is_anonymous'', ''false'') = ''false'')', nom);
    END IF;
  END LOOP;
END $$;
COMMIT;
