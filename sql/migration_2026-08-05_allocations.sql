-- ============================================================
-- MIGRATION — 05/08/2026
-- Ajoute la colonne "allocations" à la table entrees, nécessaire
-- pour que la suppression d'un paiement retire automatiquement les
-- montants correspondants du dossier de l'enfant.
--
-- À exécuter une seule fois dans Supabase > SQL Editor > Run.
-- Sans danger : n'affecte aucune donnée existante.
-- ============================================================

ALTER TABLE entrees ADD COLUMN IF NOT EXISTS allocations JSONB DEFAULT '[]';
