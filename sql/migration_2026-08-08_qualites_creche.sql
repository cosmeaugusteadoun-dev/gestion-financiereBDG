-- ============================================================
-- MIGRATION — 08/08/2026
-- Ajoute le suivi qualitatif des enfants de crèche (2 mois - 2 ans et
-- demi) : traits de caractère positifs + attitudes à accompagner, cochés
-- par tranche d'âge, remplaçant la moyenne/appréciation (non pertinente à
-- cet âge) dans le bulletin envoyé aux parents.
--
-- À exécuter une seule fois dans Supabase > SQL Editor > Run.
-- Sans danger : nouvelles colonnes, les lignes existantes auront des
-- tableaux vides / NULL jusqu'à leur prochaine modification.
-- ============================================================

ALTER TABLE suivi ADD COLUMN IF NOT EXISTS qualites_positives JSONB DEFAULT '[]';
ALTER TABLE suivi ADD COLUMN IF NOT EXISTS qualites_accompagner JSONB DEFAULT '[]';
ALTER TABLE suivi ADD COLUMN IF NOT EXISTS tranche_age TEXT;
