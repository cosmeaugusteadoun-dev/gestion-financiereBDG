-- ============================================================
-- MIGRATION — 23/08/2026
-- Ajoute la colonne "date_inscription" à la table enfants : date réelle
-- d'inscription de l'enfant, utilisée pour la Crèche afin de calculer le
-- rappel de renouvellement de l'abonnement annuel (inscription + assurance),
-- qui court sur 12 mois à partir de cette date et non sur l'année
-- scolaire — un enfant de crèche peut être admis à n'importe quel moment
-- de l'année.
--
-- À exécuter une seule fois dans Supabase > SQL Editor > Run.
-- Sans danger : les dossiers existants auront date_inscription = NULL
-- jusqu'à ce qu'elle soit renseignée (aucun rappel ne se déclenche tant
-- que la date n'est pas connue).
-- ============================================================

ALTER TABLE enfants ADD COLUMN IF NOT EXISTS date_inscription DATE;
