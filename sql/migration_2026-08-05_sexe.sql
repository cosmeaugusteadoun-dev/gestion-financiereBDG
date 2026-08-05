-- ============================================================
-- MIGRATION — 05/08/2026
-- Ajoute la colonne "sexe" à la table enfants, utilisée pour le
-- diagramme de répartition Filles/Garçons du tableau de bord et
-- du bilan général.
--
-- À exécuter une seule fois dans Supabase > SQL Editor > Run.
-- Sans danger : les dossiers existants auront simplement sexe = NULL
-- ("Non renseigné" dans le diagramme) jusqu'à ce qu'ils soient édités.
-- ============================================================

ALTER TABLE enfants ADD COLUMN IF NOT EXISTS sexe TEXT;
