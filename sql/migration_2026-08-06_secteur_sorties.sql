-- ============================================================
-- MIGRATION — 06/08/2026
-- Ajoute la colonne "secteur" à la table sorties, utilisée pour
-- imputer chaque dépense à un secteur de l'école (Crèche, Maternelle,
-- Primaire, ...) et l'inclure dans les bilans par secteur.
--
-- À exécuter une seule fois dans Supabase > SQL Editor > Run.
-- Sans danger : les dépenses existantes auront secteur = NULL
-- ("Administratif / Divers" par défaut à l'affichage) jusqu'à modification.
-- ============================================================

ALTER TABLE sorties ADD COLUMN IF NOT EXISTS secteur TEXT;
